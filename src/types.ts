export type MoodThemeId = 'calm' | 'cozy' | 'deep-focus' | 'fresh' | 'energetic';

export type NavSection =
  | 'planner'
  | 'focus'
  | 'friends'
  | 'rooms'
  | 'stats'
  | 'settings'
  | 'admin';

export type LeaderboardTab = 'weeklyHours' | 'streak' | 'allTimeXp';

export type CalendarViewMode = 'day' | 'week' | 'month';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export type LevelTitle = 'Beginner' | 'Learner' | 'Scholar' | 'Expert' | 'Master';

export interface CloudUserDoc {
  uid: string;
  displayName: string;
  photoURL: string;
  username: string;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalMinutes: number;
  weeklyMinutes: number;
  weekKey: string; // e.g. "2026-W44"
  studyingNow: boolean;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface FriendRequestItem {
  id: string;
  fromUid: string;
  toUid: string;
  fromUsername?: string;
  fromDisplayName?: string;
  toUsername?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface FriendshipItem {
  id: string;
  members: [string, string];
  createdAt: string;
}

export interface StudyRoomDoc {
  code: string;
  hostUid: string;
  memberUids: string[];
  maxMembers: number;
  mode: TimerMode;
  startedAt: number | null;
  durationSec: number;
  status: 'idle' | 'running' | 'paused' | 'completed';
  createdAt?: string;
}

export interface RoomMemberItem {
  uid: string;
  name: string;
  photoURL: string;
  status: 'focusing' | 'break' | 'idle';
  joinedAt: string;
}

export interface CloudAudioTrack {
  id: string;
  title: string;
  category: string;
  url: string;
  createdAt: string;
}

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

export interface PersistedTimerState {
  mode: TimerMode;
  isRunning: boolean;
  endTimestamp: number | null;
  remainingMsWhenPaused: number;
  completedFocusCycleCount: number;
  selectedTaskId: string | null;
  activeRunId: string;
  lastCompletedRunId: string | null;
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
