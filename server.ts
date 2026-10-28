import 'dotenv/config';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { createVerify } from 'node:crypto';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

function sanitizePlainText(rawInput: unknown, maxLength: number = 120): string {
  if (typeof rawInput !== 'string') return '';
  const withoutScripts = rawInput
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/[<>]/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  return withoutScripts.trim().slice(0, Math.max(1, maxLength));
}

function evaluatePerUserRateLimit(
  buckets: Map<string, number[]>,
  userKey: string,
  nowMs: number,
  windowMs: number = 60_000,
  maxRequests: number = 20
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const cutoff = nowMs - windowMs;
  const existing = buckets.get(userKey) || [];
  const activeTimestamps = existing.filter((t) => t > cutoff);

  if (activeTimestamps.length >= maxRequests) {
    buckets.set(userKey, activeTimestamps);
    const oldest = activeTimestamps[0] ?? nowMs;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + windowMs - nowMs) / 1000)
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  activeTimestamps.push(nowMs);
  buckets.set(userKey, activeTimestamps);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - activeTimestamps.length),
    retryAfterSec: 0,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfigPath = path.resolve(
  __dirname,
  'firebase-applet-config.json'
);
const firebaseConfigRaw = fs.existsSync(firebaseConfigPath)
  ? JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'))
  : {};
const FIREBASE_PROJECT_ID: string =
  process.env.FIREBASE_PROJECT_ID ||
  firebaseConfigRaw.projectId ||
  'distributed-xanthometer-25v9p';
const FIREBASE_WEB_API_KEY: string = firebaseConfigRaw.apiKey || '';

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } = {
  certs: {},
  expiresAt: 0,
};

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (
    cachedGoogleCerts.expiresAt > now &&
    Object.keys(cachedGoogleCerts.certs).length > 0
  ) {
    return cachedGoogleCerts.certs;
  }
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error('Failed to fetch Google public certificates.');
  }
  const certs = (await res.json()) as Record<string, string>;
  cachedGoogleCerts = {
    certs,
    expiresAt: now + 50 * 60 * 1000,
  };
  return certs;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const json = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(json) as T;
}

/**
 * Verifies a Firebase Auth ID token on the server:
 * 1. Validates JWT header (alg === 'RS256', kid present) and claims (aud, iss, sub, exp).
 * 2. Verifies RSA-SHA256 cryptographic signature against Google's securetoken x509 public certs
 *    (with fallback to Identity Toolkit accounts:lookup if needed).
 */
export async function verifyFirebaseIdToken(
  idToken: string
): Promise<{ uid: string }> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Firebase ID token.');
  }

  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodeBase64UrlJson<{
    aud?: string;
    iss?: string;
    sub?: string;
    user_id?: string;
    exp?: number;
    iat?: number;
  }>(parts[1]);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid token algorithm or missing key ID.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Firebase ID token has expired.');
  }
  if (payload.iat && payload.iat > nowSec + 300) {
    throw new Error('Firebase ID token issued in the future.');
  }
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error('Invalid token audience.');
  }
  if (
    payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
  ) {
    throw new Error('Invalid token issuer.');
  }

  const uid = payload.sub || payload.user_id || '';
  if (!uid || typeof uid !== 'string' || uid.length > 128) {
    throw new Error('Invalid token subject (uid).');
  }

  try {
    const certs = await getGooglePublicCerts();
    const certPem = certs[header.kid];
    if (!certPem) {
      throw new Error('Matching public certificate not found for kid.');
    }
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const signatureValid = verifier.verify(
      certPem,
      Buffer.from(parts[2], 'base64url')
    );
    if (!signatureValid) {
      throw new Error('Invalid Firebase ID token cryptographic signature.');
    }
    return { uid };
  } catch (certErr) {
    if (!FIREBASE_WEB_API_KEY) {
      throw certErr;
    }
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        FIREBASE_WEB_API_KEY
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!lookupRes.ok) {
      throw new Error('Firebase ID token verification failed.');
    }
    const lookupData = (await lookupRes.json()) as {
      users?: Array<{ localId?: string }>;
    };
    const verifiedUid = lookupData.users?.[0]?.localId;
    if (!verifiedUid || verifiedUid !== uid) {
      throw new Error('Firebase ID token user mismatch.');
    }
    return { uid: verifiedUid };
  }
}

// Per-user rate limiting: max 20 requests per 60 seconds per authenticated uid
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const userRateLimitBuckets = new Map<string, number[]>();

interface AuthenticatedRequest extends Request {
  authenticatedUid?: string;
}

async function requireAuthenticatedRateLimitedUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required. Please sign in to use AI study tools.',
    });
    return;
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Missing Firebase ID token.' });
    return;
  }

  try {
    const { uid } = await verifyFirebaseIdToken(idToken);
    req.authenticatedUid = uid;

    const rateResult = evaluatePerUserRateLimit(
      userRateLimitBuckets,
      uid,
      Date.now(),
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_REQUESTS
    );

    res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(rateResult.remaining));

    if (!rateResult.allowed) {
      res.setHeader('Retry-After', String(rateResult.retryAfterSec));
      res.status(429).json({
        error: `Rate limit exceeded (max ${RATE_LIMIT_MAX_REQUESTS} AI requests per minute). Please wait ${rateResult.retryAfterSec}s.`,
      });
      return;
    }

    next();
  } catch (err) {
    res.status(401).json({
      error:
        err instanceof Error
          ? err.message
          : 'Invalid or expired Firebase ID token.',
    });
  }
}

function getAiClient(): GoogleGenAI {
  // GEMINI_API_KEY is read strictly from server environment secrets, never sent to the browser
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Require verified Firebase ID token and 20 req/min per-user rate limit on all /api/gemini/* endpoints
  app.use('/api/gemini', requireAuthenticatedRateLimitedUser);

  // 1. Study Plan Generator (with Google Search grounding support via gemini-3.8-flash)
  app.post('/api/gemini/study-plan', async (req, res) => {
    try {
      const { goal: rawGoal, startDate, useSearch } = req.body as {
        goal?: string;
        startDate?: string;
        useSearch?: boolean;
      };
      const goal = sanitizePlainText(rawGoal, 300);
      if (!goal) {
        res.status(400).json({ error: 'Please describe your study goal.' });
        return;
      }

      const baseDate =
        sanitizePlainText(startDate, 20) ||
        new Date().toISOString().slice(0, 10);
      const ai = getAiClient();

      if (useSearch) {
        const searchResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `You are an academic study planner. The student has the following study goal starting from ${baseDate}: "${goal}".
Use Google Search to verify accurate syllabus topics, exam structure, or up-to-date curriculum concepts if relevant.
Then return ONLY a valid JSON object (no markdown fences) with this exact structure:
{
  "summary": "Brief 1-2 sentence overview of the study strategy and curriculum insights",
  "tasks": [
    {
      "title": "Specific study session task title",
      "subject": "Subject name",
      "dateOffsetDays": 0,
      "time": "16:00",
      "estimatedPomodoros": 2,
      "notes": "Key concepts to cover"
    }
  ]
}
Create between 4 and 7 high-impact tasks spaced across the timeframe.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        const rawText = searchResponse.text || '{}';
        const cleaned = rawText
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();

        let parsed: { summary?: string; tasks?: unknown[] } = {};
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (match) {
            parsed = JSON.parse(match[0]);
          }
        }

        const groundingChunks =
          searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks ||
          [];
        const sources = groundingChunks
          .map((chunk: { web?: { uri?: string; title?: string } }) =>
            chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null
          )
          .filter(Boolean);

        res.json({
          summary:
            parsed.summary ||
            `Created a personalized study plan for "${goal}" grounded with Google Search.`,
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          sources,
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Create a structured, realistic study plan for a student with this goal: "${goal}". Today's date is ${baseDate}. Generate 5 to 7 concrete study tasks with specific topics, day offsets from today (0 = today, 1 = tomorrow, etc.), recommended start time (24h HH:mm format like "15:00" or "18:30"), and estimated 25-minute Pomodoros (1 to 4).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'Encouraging 1-2 sentence strategy overview.',
              },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    dateOffsetDays: { type: Type.INTEGER },
                    time: { type: Type.STRING },
                    estimatedPomodoros: { type: Type.INTEGER },
                    notes: { type: Type.STRING },
                  },
                  required: [
                    'title',
                    'subject',
                    'dateOffsetDays',
                    'time',
                    'estimatedPomodoros',
                  ],
                },
              },
            },
            required: ['summary', 'tasks'],
          },
        },
      });

      const data = JSON.parse(response.text || '{"summary":"","tasks":[]}');
      res.json({ ...data, sources: [] });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate study plan';
      res.status(500).json({ error: message });
    }
  });

  // 2. Task Breakdown into Pomodoro-sized subtasks
  app.post('/api/gemini/task-breakdown', async (req, res) => {
    try {
      const { title, subject, estimatedPomodoros } = req.body as {
        title?: string;
        subject?: string;
        estimatedPomodoros?: number;
      };
      if (!title) {
        res.status(400).json({ error: 'Task title is required.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Break down the student study task "${title}" (Subject: ${subject || 'General'}, Total estimated Pomodoros: ${estimatedPomodoros || 3}) into 3 to 5 bite-sized, actionable Pomodoro subtasks that each take 1 or 2 Pomodoros (25 mins each).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subtasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    estimatedPomodoros: { type: Type.INTEGER },
                  },
                  required: ['title', 'estimatedPomodoros'],
                },
              },
            },
            required: ['subtasks'],
          },
        },
      });

      const data = JSON.parse(response.text || '{"subtasks":[]}');
      res.json(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to break down task';
      res.status(500).json({ error: message });
    }
  });

  // 3. Mood-based Theme & Session Duration Suggestion
  app.post('/api/gemini/mood-suggestion', async (req, res) => {
    try {
      const { feeling } = req.body as { feeling?: string };
      if (!feeling || !feeling.trim()) {
        res.status(400).json({ error: 'Please share how you are feeling.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `A student says they feel: "${feeling}".
Available mood themes in Lumo:
- "calm": Misty blue lake, serene and low-stress for anxious or overwhelmed minds.
- "cozy": Warm sunset amber, comforting and gentle for tired or rainy evenings.
- "deep-focus": Dark purple night city, distraction-free high concentration for coding, math, or late-night cramming.
- "fresh": Green forest canopy, grounding and revitalizing when feeling sluggish or needing a reset.
- "energetic": Bright neon gradient, high-tempo momentum when feeling hyped or tackling rapid drills.

Suggest the single best theme ID, recommended focus duration in minutes (between 15 and 50), short break duration (between 5 and 15), and a warm 1-2 sentence explanation.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              theme: {
                type: Type.STRING,
                description:
                  'One of: calm, cozy, deep-focus, fresh, energetic',
              },
              focusMinutes: { type: Type.INTEGER },
              shortBreakMinutes: { type: Type.INTEGER },
              reason: { type: Type.STRING },
            },
            required: ['theme', 'focusMinutes', 'shortBreakMinutes', 'reason'],
          },
        },
      });

      const data = JSON.parse(response.text || '{}');
      res.json(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to suggest mood theme';
      res.status(500).json({ error: message });
    }
  });

  // 4. Weekly Insight Generator
  app.post('/api/gemini/weekly-insight', async (req, res) => {
    try {
      const { stats, studentName } = req.body as {
        stats?: Record<string, unknown>;
        studentName?: string;
      };
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are an encouraging study coach for ${studentName || 'a student'}.
Here are their real study statistics:
${JSON.stringify(stats || {}, null, 2)}

Write a warm, personalized weekly insight with:
1. A headline celebrating their momentum or encouraging their next step.
2. A concise 2-3 sentence friendly analysis of their study balance, streak, and top subjects.
3. Three concrete, science-backed study tips tailored to their numbers.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              tips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['headline', 'summary', 'tips'],
          },
        },
      });

      const data = JSON.parse(response.text || '{}');
      res.json(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate weekly insight';
      res.status(500).json({ error: message });
    }
  });

  // 5. Google Search Grounding Study Research Assistant (gemini-3.8-flash with googleSearch tool)
  app.post('/api/gemini/search-grounding', async (req, res) => {
    try {
      const { query } = req.body as { query?: string };
      if (!query || !query.trim()) {
        res.status(400).json({ error: 'Search query is required.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are a factual academic research assistant for school and college students. Answer the following study question or syllabus lookup clearly and concisely using up-to-date Google Search data: "${query}"`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((chunk: { web?: { uri?: string; title?: string } }) =>
          chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null
        )
        .filter(Boolean);

      res.json({
        answer: response.text || 'No response generated.',
        sources,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to perform grounded search';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Lumo server listening on http://localhost:${port}`);
  });
}

startServer();
