import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAiClient(): GoogleGenAI {
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
  app.use(express.json({ limit: '20mb' }));

  // 1. Study Plan Generator (with Google Search grounding support via gemini-3.8-flash)
  app.post('/api/gemini/study-plan', async (req, res) => {
    try {
      const { goal, startDate, useSearch } = req.body as {
        goal?: string;
        startDate?: string;
        useSearch?: boolean;
      };
      if (!goal || !goal.trim()) {
        res.status(400).json({ error: 'Please describe your study goal.' });
        return;
      }

      const baseDate = startDate || new Date().toISOString().slice(0, 10);
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
Available mood themes in FocusFlow:
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
    console.log(`FocusFlow server listening on http://localhost:${port}`);
  });
}

startServer();
