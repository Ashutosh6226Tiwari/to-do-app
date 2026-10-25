import { FocusSessionRecord, LevelTitle, TimerMode } from '../types';

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

  const [ty, tm, td] = todayKey.split('-').map(Number);
  const todayDate = new Date(ty, tm - 1, td);

  // Start of current week (Monday-based or last 7 days rolling)
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

  // 16 weeks (112 days) GitHub-style heatmap aligned so the last column ends on Saturday or today
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

  // Suppress unused variable lint on todayDate
  void todayDate;

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
