export type MoodThemeId = 'calm' | 'cozy' | 'deep-focus' | 'fresh' | 'energetic';

export type NavSection = 'planner' | 'focus' | 'stats' | 'settings';

export type CalendarViewMode = 'day' | 'week' | 'month';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export type LevelTitle = 'Beginner' | 'Learner' | 'Scholar' | 'Expert' | 'Master';

export interface SubtaskItem {
  id: string;
  title: string;
  estimatedPomodoros: number;
  completed: boolean;
}

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  color: string; // hex or theme token
  estimatedPomodoros: number;
  completedPomodoros: number;
  completed: boolean;
  notes?: string;
  subtasks?: SubtaskItem[];
}

export interface FocusSessionRecord {
  id: string;
  taskId?: string;
  taskTitle: string;
  subject: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string
  durationMinutes: number;
  mode: TimerMode;
  completed: boolean;
  xpEarned: number;
}

export interface TimerSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  autoSwitchModes: boolean;
  soundAlertEnabled: boolean;
  alertTone: 'chime' | 'bell' | 'marimba';
}

export interface UserProfile {
  name: string;
  majorOrGrade: string;
  dailyGoalHours: number;
  totalXp: number;
  theme: MoodThemeId;
  timerSettings: TimerSettings;
}

export interface MoodThemeConfig {
  id: MoodThemeId;
  name: string;
  subtitle: string;
  description: string;
  isDark: boolean;
  fontDisplay: string;
  fontBody: string;
  accentHex: string;
  accentSecondaryHex: string;
  buttonBgClass: string;
  buttonHoverClass: string;
  activeTabClass: string;
  ringStrokeColor: string;
  glassCardClass: string;
  glassHeaderClass: string;
  glassInputClass: string;
  textPrimaryClass: string;
  textSecondaryClass: string;
  textMutedClass: string;
  borderClass: string;
}
