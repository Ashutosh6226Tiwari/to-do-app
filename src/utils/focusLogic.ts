import {
  FocusSessionRecord,
  LevelTitle,
  PersistedTimerState,
  TimerMode,
  TimerSettings,
} from '../types';

export interface LevelProgressInfo {
  level: number;
  title: LevelTitle;
  currentLevelXp: number;
  xpNeededForNextLevel: number;
  progressPercent: number;
  totalXp: number;
}

const LEVEL_TITLES: LevelTitle[] = [
  'Beginner',
  'Learner',
  'Scholar',
  'Expert',
  'Master',
];

/**
 * Level 1 -> 2 needs 100 XP.
 * Each next level needs 50 more than the last:
 * L1->2: 100
 * L2->3: 150
 * L3->4: 200
 * L4->5: 250
 */
export function getXpRequiredForLevelUp(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return 100 + (safeLevel - 1) * 50;
}

export function getLevelTitle(level: number): LevelTitle {
  if (level <= 1) return LEVEL_TITLES[0];
  if (level === 2) return LEVEL_TITLES[1];
  if (level === 3) return LEVEL_TITLES[2];
  if (level === 4) return LEVEL_TITLES[3];
  return LEVEL_TITLES[4];
}

export function getLevelInfo(totalXpInput: number): LevelProgressInfo {
  const totalXp = Math.max(0, Math.floor(totalXpInput));
  let level = 1;
  let remainingXp = totalXp;
  let needed = getXpRequiredForLevelUp(level);

  while (remainingXp >= needed) {
    remainingXp -= needed;
    level += 1;
    needed = getXpRequiredForLevelUp(level);
  }

  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((remainingXp / needed) * 100))
  );

  return {
    level,
    title: getLevelTitle(level),
    currentLevelXp: remainingXp,
    xpNeededForNextLevel: needed,
    progressPercent,
    totalXp,
  };
}

/**
 * XP rules:
 * - Only completed focus sessions give XP.
 * - 1 XP per focus minute + 10 bonus per completed session.
 * - Streak multiplier: +10% at 3 days (1.10x), +25% at 7 days (1.25x).
 */
export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 7) return 1.25;
  if (streakDays >= 3) return 1.1;
  return 1.0;
}

export function calculateSessionXP(
  durationMinutes: number,
  completed: boolean,
  mode: TimerMode,
  streakDays: number
): number {
  if (!completed || mode !== 'focus' || durationMinutes <= 0) {
    return 0;
  }
  const baseXp = Math.round(durationMinutes) + 10;
  const multiplier = getStreakMultiplier(streakDays);
  return Math.round(baseXp * multiplier);
}

// ============================================================================
// Timestamp-Based Pomodoro Timer Logic (Survives Background Tabs & Reloads)
// ============================================================================

export function getModeDurationMs(
  mode: TimerMode,
  settings: TimerSettings
): number {
  if (mode === 'focus') return Math.max(1, settings.focusMinutes) * 60 * 1000;
  if (mode === 'shortBreak')
    return Math.max(1, settings.shortBreakMinutes) * 60 * 1000;
  return Math.max(1, settings.longBreakMinutes) * 60 * 1000;
}

export function getModeDurationMinutes(
  mode: TimerMode,
  settings: TimerSettings
): number {
  if (mode === 'focus') return Math.max(1, settings.focusMinutes);
  if (mode === 'shortBreak') return Math.max(1, settings.shortBreakMinutes);
  return Math.max(1, settings.longBreakMinutes);
}

export function createInitialTimerState(
  settings: TimerSettings,
  selectedTaskId: string | null = 'task-1'
): PersistedTimerState {
  return {
    mode: 'focus',
    isRunning: false,
    endTimestamp: null,
    remainingMsWhenPaused: getModeDurationMs('focus', settings),
    completedFocusCycleCount: 0,
    selectedTaskId,
    activeRunId: 'run-initial',
    lastCompletedRunId: null,
  };
}

export function computeRemainingMs(
  state: PersistedTimerState,
  nowMs: number
): number {
  if (state.isRunning && state.endTimestamp !== null) {
    return Math.max(0, state.endTimestamp - nowMs);
  }
  return Math.max(0, state.remainingMsWhenPaused);
}

export function computeRemainingSeconds(
  state: PersistedTimerState,
  nowMs: number
): number {
  return Math.ceil(computeRemainingMs(state, nowMs) / 1000);
}

export function startTimerState(
  state: PersistedTimerState,
  nowMs: number
): PersistedTimerState {
  if (state.isRunning && state.endTimestamp !== null) {
    return state;
  }
  const durationToRun = Math.max(1000, state.remainingMsWhenPaused);
  const nextRunId =
    state.lastCompletedRunId === state.activeRunId
      ? `run-${nowMs}`
      : state.activeRunId || `run-${nowMs}`;
  return {
    ...state,
    isRunning: true,
    endTimestamp: nowMs + durationToRun,
    activeRunId: nextRunId,
  };
}

export function pauseTimerState(
  state: PersistedTimerState,
  nowMs: number
): PersistedTimerState {
  if (!state.isRunning || state.endTimestamp === null) {
    return state;
  }
  const remainingMs = Math.max(0, state.endTimestamp - nowMs);
  return {
    ...state,
    isRunning: false,
    endTimestamp: null,
    remainingMsWhenPaused: remainingMs,
  };
}

export function resetTimerState(
  state: PersistedTimerState,
  settings: TimerSettings,
  nowMs: number = Date.now()
): PersistedTimerState {
  return {
    ...state,
    isRunning: false,
    endTimestamp: null,
    remainingMsWhenPaused: getModeDurationMs(state.mode, settings),
    activeRunId: `run-${nowMs}-reset`,
  };
}

export function switchTimerModeState(
  state: PersistedTimerState,
  nextMode: TimerMode,
  settings: TimerSettings,
  nowMs: number = Date.now()
): PersistedTimerState {
  return {
    ...state,
    mode: nextMode,
    isRunning: false,
    endTimestamp: null,
    remainingMsWhenPaused: getModeDurationMs(nextMode, settings),
    activeRunId: `run-${nowMs}-${nextMode}`,
  };
}

export interface CompletedSessionOutcome {
  mode: TimerMode;
  durationMinutes: number;
  taskId: string | null;
  runId: string;
}

export interface TimerEvaluationResult {
  nextState: PersistedTimerState;
  remainingSeconds: number;
  completedSession: CompletedSessionOutcome | null;
}

/**
 * Evaluates a timer tick or visibilitychange event using endTimestamp - nowMs.
 * If the timer has expired (nowMs >= endTimestamp), transitions to the next mode,
 * guards against duplicate XP awards using activeRunId / lastCompletedRunId,
 * and returns the completedSession outcome once only.
 */
export function evaluateTimerTick(
  state: PersistedTimerState,
  settings: TimerSettings,
  nowMs: number
): TimerEvaluationResult {
  if (!state.isRunning || state.endTimestamp === null) {
    return {
      nextState: state,
      remainingSeconds: computeRemainingSeconds(state, nowMs),
      completedSession: null,
    };
  }

  const remainingMs = state.endTimestamp - nowMs;
  if (remainingMs > 0) {
    return {
      nextState: state,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      completedSession: null,
    };
  }

  // Guard against double-completion of the exact same runId
  if (state.lastCompletedRunId === state.activeRunId) {
    return {
      nextState: {
        ...state,
        isRunning: false,
        endTimestamp: null,
        remainingMsWhenPaused: getModeDurationMs(state.mode, settings),
      },
      remainingSeconds: Math.ceil(
        getModeDurationMs(state.mode, settings) / 1000
      ),
      completedSession: null,
    };
  }

  const finishedMode = state.mode;
  const finishedDurationMinutes = getModeDurationMinutes(
    finishedMode,
    settings
  );
  const completedRunId = state.activeRunId;

  const nextCycleCount =
    finishedMode === 'focus'
      ? state.completedFocusCycleCount + 1
      : state.completedFocusCycleCount;

  const nextMode: TimerMode =
    finishedMode === 'focus'
      ? nextCycleCount % 4 === 0
        ? 'longBreak'
        : 'shortBreak'
      : 'focus';

  const nextDurationMs = getModeDurationMs(nextMode, settings);
  const nextRunId = `run-${nowMs}-${nextMode}-${nextCycleCount}`;

  const nextState: PersistedTimerState = settings.autoSwitchModes
    ? {
        ...state,
        mode: nextMode,
        isRunning: true,
        endTimestamp: nowMs + nextDurationMs,
        remainingMsWhenPaused: nextDurationMs,
        completedFocusCycleCount: nextCycleCount,
        activeRunId: nextRunId,
        lastCompletedRunId: completedRunId,
      }
    : {
        ...state,
        mode: nextMode,
        isRunning: false,
        endTimestamp: null,
        remainingMsWhenPaused: nextDurationMs,
        completedFocusCycleCount: nextCycleCount,
        activeRunId: nextRunId,
        lastCompletedRunId: completedRunId,
      };

  return {
    nextState,
    remainingSeconds: Math.ceil(nextDurationMs / 1000),
    completedSession: {
      mode: finishedMode,
      durationMinutes: finishedDurationMinutes,
      taskId: state.selectedTaskId,
      runId: completedRunId,
    },
  };
}

export function formatTimeMMSS(totalSeconds: number): string {
  const safeSecs = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSecs / 60);
  const rem = safeSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

/**
 * Format Date object to local YYYY-MM-DD
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return formatDateKey(dt);
}

/**
 * Calculates current streak and longest streak from completed focus sessions.
 */
export function calculateStreaks(
  sessions: FocusSessionRecord[],
  todayKey: string
): { currentStreak: number; longestStreak: number } {
  const focusDatesSet = new Set<string>();
  for (const s of sessions) {
    if (s.completed && s.mode === 'focus' && s.durationMinutes > 0 && s.date) {
      focusDatesSet.add(s.date);
    }
  }

  if (focusDatesSet.size === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const sortedDates = Array.from(focusDatesSet).sort();

  // Longest streak
  let longestStreak = 1;
  let running = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const expectedNext = addDays(sortedDates[i - 1], 1);
    if (sortedDates[i] === expectedNext) {
      running += 1;
      if (running > longestStreak) {
        longestStreak = running;
      }
    } else {
      running = 1;
    }
  }

  // Current streak (starts from today if studied today, else yesterday if studied yesterday)
  const yesterdayKey = addDays(todayKey, -1);
  let cursor: string | null = null;
  if (focusDatesSet.has(todayKey)) {
    cursor = todayKey;
  } else if (focusDatesSet.has(yesterdayKey)) {
    cursor = yesterdayKey;
  }

  let currentStreak = 0;
  while (cursor && focusDatesSet.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
  };
}

export interface DailyStudyPoint {
  date: string;
  label: string;
  minutes: number;
  hours: number;
  sessionsCount: number;
}

export interface SubjectBreakdownItem {
  subject: string;
  minutes: number;
  hours: number;
  percentage: number;
  sessionsCount: number;
}

export interface HeatmapCell {
  date: string;
  minutes: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface StudyStatsSummary {
  hoursToday: number;
  minutesToday: number;
  hoursThisWeek: number;
  minutesThisWeek: number;
  hoursThisMonth: number;
  minutesThisMonth: number;
  totalSessionsCompleted: number;
  currentStreak: number;
  longestStreak: number;
  dailyChart: DailyStudyPoint[];
  subjectBreakdown: SubjectBreakdownItem[];
  heatmap: HeatmapCell[];
}

export function computeStudyStats(
  sessions: FocusSessionRecord[],
  todayKey: string
): StudyStatsSummary {
  const validSessions = sessions.filter(
    (s) => s.completed && s.mode === 'focus' && s.durationMinutes > 0
  );

  const sevenDaysAgoKey = addDays(todayKey, -6);
  const monthPrefix = todayKey.slice(0, 7); // YYYY-MM

  let minutesToday = 0;
  let minutesThisWeek = 0;
  let minutesThisMonth = 0;

  const byDateMinutes = new Map<string, { minutes: number; count: number }>();
  const bySubject = new Map<string, { minutes: number; count: number }>();

  for (const s of validSessions) {
    if (s.date === todayKey) {
      minutesToday += s.durationMinutes;
    }
    if (s.date >= sevenDaysAgoKey && s.date <= todayKey) {
      minutesThisWeek += s.durationMinutes;
    }
    if (s.date.startsWith(monthPrefix)) {
      minutesThisMonth += s.durationMinutes;
    }

    const prevDate = byDateMinutes.get(s.date) ?? { minutes: 0, count: 0 };
    byDateMinutes.set(s.date, {
      minutes: prevDate.minutes + s.durationMinutes,
      count: prevDate.count + 1,
    });

    const subj = (s.subject || 'General').trim();
    const prevSubj = bySubject.get(subj) ?? { minutes: 0, count: 0 };
    bySubject.set(subj, {
      minutes: prevSubj.minutes + s.durationMinutes,
      count: prevSubj.count + 1,
    });
  }

  // Last 7 days chart
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyChart: DailyStudyPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const dKey = addDays(todayKey, -i);
    const [y, m, d] = dKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const entry = byDateMinutes.get(dKey) ?? { minutes: 0, count: 0 };
    dailyChart.push({
      date: dKey,
      label: dayNames[dt.getDay()],
      minutes: entry.minutes,
      hours: Number((entry.minutes / 60).toFixed(1)),
      sessionsCount: entry.count,
    });
  }

  // Subject breakdown
  const totalSubjMinutes = Array.from(bySubject.values()).reduce(
    (acc, v) => acc + v.minutes,
    0
  );
  const subjectBreakdown: SubjectBreakdownItem[] = Array.from(
    bySubject.entries()
  )
    .map(([subject, data]) => ({
      subject,
      minutes: data.minutes,
      hours: Number((data.minutes / 60).toFixed(1)),
      percentage:
        totalSubjMinutes > 0
          ? Math.round((data.minutes / totalSubjMinutes) * 100)
          : 0,
      sessionsCount: data.count,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // 16 weeks (112 days) GitHub-style heatmap
  const totalHeatmapDays = 112;
  const heatmap: HeatmapCell[] = [];
  for (let i = totalHeatmapDays - 1; i >= 0; i--) {
    const dKey = addDays(todayKey, -i);
    const mins = byDateMinutes.get(dKey)?.minutes ?? 0;
    let intensity: 0 | 1 | 2 | 3 | 4 = 0;
    if (mins > 0 && mins < 30) intensity = 1;
    else if (mins >= 30 && mins < 60) intensity = 2;
    else if (mins >= 60 && mins < 120) intensity = 3;
    else if (mins >= 120) intensity = 4;

    heatmap.push({
      date: dKey,
      minutes: mins,
      intensity,
    });
  }

  const { currentStreak, longestStreak } = calculateStreaks(
    validSessions,
    todayKey
  );

  return {
    hoursToday: Number((minutesToday / 60).toFixed(1)),
    minutesToday,
    hoursThisWeek: Number((minutesThisWeek / 60).toFixed(1)),
    minutesThisWeek,
    hoursThisMonth: Number((minutesThisMonth / 60).toFixed(1)),
    minutesThisMonth,
    totalSessionsCompleted: validSessions.length,
    currentStreak,
    longestStreak,
    dailyChart,
    subjectBreakdown,
    heatmap,
  };
}

/**
 * Computes ISO 8601 week key in format "YYYY-Www" (e.g. "2026-W44").
 */
export function getIsoWeekKey(input: Date | string = new Date()): string {
  const d =
    typeof input === 'string'
      ? new Date(`${input.slice(0, 10)}T12:00:00Z`)
      : new Date(
          Date.UTC(input.getFullYear(), input.getMonth(), input.getDate())
        );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Resets weeklyMinutes to 0 when storedWeekKey differs from currentWeekKey.
 */
export function normalizeWeeklyMinutes(
  weeklyMinutes: number,
  storedWeekKey: string,
  currentWeekKey: string
): { weeklyMinutes: number; weekKey: string; didReset: boolean } {
  if (storedWeekKey !== currentWeekKey) {
    return {
      weeklyMinutes: 0,
      weekKey: currentWeekKey,
      didReset: true,
    };
  }
  return {
    weeklyMinutes: Math.max(0, Math.floor(weeklyMinutes)),
    weekKey: currentWeekKey,
    didReset: false,
  };
}

/**
 * Validates and normalizes a student username (3-20 alphanumeric/underscore chars).
 */
export function validateUsername(raw: string): {
  valid: boolean;
  trimmed: string;
  usernameLower: string;
  error?: string;
} {
  const trimmed = raw.trim();
  const usernameLower = trimmed.toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return {
      valid: false,
      trimmed,
      usernameLower,
      error: 'Username must be between 3 and 20 characters.',
    };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return {
      valid: false,
      trimmed,
      usernameLower,
      error: 'Only letters, numbers, and underscores (_) are allowed.',
    };
  }
  return { valid: true, trimmed, usernameLower };
}

/**
 * Generates a 6-character uppercase alphanumeric Study Room code.
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Computes remaining seconds in a shared Study Room from startedAt (epoch ms) and durationSec.
 * Uses the exact same timestamp-based calculation as the main timer.
 */
export function computeSharedRoomRemainingSeconds(
  startedAtMs: number | null,
  durationSec: number,
  status: 'idle' | 'running' | 'paused' | 'completed',
  nowMs: number
): number {
  const safeDuration = Math.max(10, Math.floor(durationSec));
  if (status !== 'running' || !startedAtMs) {
    return status === 'completed' ? 0 : safeDuration;
  }
  const endTimestampMs = startedAtMs + safeDuration * 1000;
  const remainingMs = Math.max(0, endTimestampMs - nowMs);
  return Math.ceil(remainingMs / 1000);
}

/**
 * Clamps a Study Room custom duration in minutes to an integer between 1 and 180.
 */
export function clampRoomCustomMinutes(rawMinutes: number): number {
  if (!Number.isFinite(rawMinutes)) return 25;
  return Math.max(1, Math.min(180, Math.round(rawMinutes)));
}

/**
 * Converts decimal dailyGoalHours into { hours: 0..16, minutes: 0..55 (5-min steps) }.
 */
export function splitDailyGoalHoursToHoursMinutes(dailyGoalHours: number): {
  hours: number;
  minutes: number;
} {
  const clampedTotalMinutes = Math.max(
    0,
    Math.min(16 * 60, Math.round((Number(dailyGoalHours) || 0) * 60))
  );
  const snappedTotalMinutes = Math.round(clampedTotalMinutes / 5) * 5;
  const hours = Math.min(16, Math.floor(snappedTotalMinutes / 60));
  const minutes = hours === 16 ? 0 : snappedTotalMinutes % 60;
  return { hours, minutes };
}

/**
 * Combines hours (0..16) and minutes (0..55, 5-min steps) into decimal dailyGoalHours (0..16).
 */
export function combineDailyGoalHoursAndMinutes(
  rawHours: number,
  rawMinutes: number
): number {
  const safeHours = Math.max(0, Math.min(16, Math.floor(Number(rawHours) || 0)));
  const snappedMinutes =
    safeHours === 16
      ? 0
      : Math.max(
          0,
          Math.min(55, Math.round((Number(rawMinutes) || 0) / 5) * 5)
        );
  const totalHours = safeHours + snappedMinutes / 60;
  return Number(Math.min(16, Math.max(0, totalHours)).toFixed(4));
}

/**
 * Formats decimal dailyGoalHours into a concise human-readable string (e.g. "2h", "2h 30m", "45m").
 */
export function formatDailyGoalLabel(dailyGoalHours: number): string {
  const { hours, minutes } = splitDailyGoalHoursToHoursMinutes(dailyGoalHours);
  if (hours === 0 && minutes === 0) return '0h';
  if (hours > 0 && minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export const ALLOWED_TRACK_CATEGORIES = [
  'Lo-Fi',
  'Nature',
  'Classical',
  'Ambient',
  'White Noise',
  'Instrumental',
] as const;

export type AllowedTrackCategory = (typeof ALLOWED_TRACK_CATEGORIES)[number];

/**
 * Sanitizes user-entered text (names, usernames, task titles, subjects, notes, room codes, track titles)
 * so that no HTML tags, script payloads, angle brackets, or control characters can ever be injected.
 */
export function sanitizePlainText(
  rawInput: unknown,
  maxLength: number = 120
): string {
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

/**
 * Validates that an audio URL is a safe, well-formed HTTPS URL before saving or playing it.
 */
export function isValidHttpsAudioUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (trimmed.length < 10 || trimmed.length > 500) return false;
  if (!trimmed.startsWith('https://')) return false;
  if (/[<>"'\s\u0000-\u001F\u007F]/.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return false;
    if (parsed.username || parsed.password) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Sliding-window per-user rate limiter (default: 20 requests per 60,000 ms).
 */
export function evaluatePerUserRateLimit(
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


