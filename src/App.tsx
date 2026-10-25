import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Calendar,
  Settings,
  Timer,
} from 'lucide-react';
import {
  FocusSessionRecord,
  MoodThemeId,
  NavSection,
  StudyTask,
  TimerMode,
  TimerSettings,
  UserProfile,
} from './types';
import {
  calculateSessionXP,
  computeStudyStats,
  formatDateKey,
  getLevelInfo,
} from './utils/focusLogic';
import {
  getInitialProfile,
  getInitialSessions,
  getInitialTasks,
} from './utils/seedData';
import { MOOD_THEMES } from './utils/themes';
import { MoodBackground } from './components/MoodBackground';
import { HeaderBar } from './components/HeaderBar';
import { PlannerView } from './components/PlannerView';
import { FocusView } from './components/FocusView';
import { StatsView } from './components/StatsView';
import { ProfileSettingsView } from './components/ProfileSettingsView';

const STORAGE_KEYS = {
  PROFILE: 'focusflow_profile_v1',
  TASKS: 'focusflow_tasks_v1',
  SESSIONS: 'focusflow_sessions_v1',
};

export default function App() {
  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  const [activeSection, setActiveSection] = useState<NavSection>('planner');
  const [selectedFocusTaskId, setSelectedFocusTaskId] = useState<string | null>(
    'task-1'
  );

  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name && MOOD_THEMES[parsed.theme as MoodThemeId]) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return getInitialProfile();
  });

  const [tasks, setTasks] = useState<StudyTask[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return getInitialTasks(todayKey);
  });

  const [sessions, setSessions] = useState<FocusSessionRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return getInitialSessions(todayKey);
  });

  const [levelUpBanner, setLevelUpBanner] = useState<{
    show: boolean;
    newLevel: number;
    title: string;
  } | null>(null);

  // Save state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch {
      // ignore
    }
  }, [sessions]);

  const themeConfig = MOOD_THEMES[profile.theme] || MOOD_THEMES.calm;
  const levelInfo = useMemo(
    () => getLevelInfo(profile.totalXp),
    [profile.totalXp]
  );
  const stats = useMemo(
    () => computeStudyStats(sessions, todayKey),
    [sessions, todayKey]
  );

  // Task handlers
  const handleAddTask = (
    newTaskData: Omit<StudyTask, 'id' | 'completedPomodoros'>
  ) => {
    const newTask: StudyTask = {
      ...newTaskData,
      id: `task-${Date.now()}`,
      completedPomodoros: 0,
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleAddMultipleTasks = (
    items: Array<Omit<StudyTask, 'id' | 'completedPomodoros'>>
  ) => {
    const created: StudyTask[] = items.map((item, idx) => ({
      ...item,
      id: `task-${Date.now()}-${idx}`,
      completedPomodoros: 0,
    }));
    setTasks((prev) => [...created, ...prev]);
  };

  const handleUpdateTask = (updated: StudyTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedFocusTaskId === taskId) {
      setSelectedFocusTaskId(null);
    }
  };

  const handleToggleTaskComplete = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      )
    );
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.subtasks) return t;
        return {
          ...t,
          subtasks: t.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          ),
        };
      })
    );
  };

  const handleStartFocusTask = (taskId: string) => {
    setSelectedFocusTaskId(taskId);
    setActiveSection('focus');
  };

  // Focus Session Completion Handler (Awards XP and triggers Level Up if threshold crossed)
  const handleSessionCompleted = (
    mode: TimerMode,
    durationMinutes: number,
    taskId?: string
  ) => {
    if (mode !== 'focus') return;

    const matchedTask = tasks.find((t) => t.id === taskId);
    const nextStreak = Math.max(1, stats.currentStreak);
    const xpEarned = calculateSessionXP(
      durationMinutes,
      true,
      'focus',
      nextStreak
    );

    const prevLevel = getLevelInfo(profile.totalXp).level;
    const nextTotalXp = profile.totalXp + xpEarned;
    const nextLevelObj = getLevelInfo(nextTotalXp);

    setProfile((prev) => ({
      ...prev,
      totalXp: nextTotalXp,
    }));

    if (nextLevelObj.level > prevLevel) {
      setLevelUpBanner({
        show: true,
        newLevel: nextLevelObj.level,
        title: nextLevelObj.title,
      });
    }

    if (matchedTask) {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== matchedTask.id) return t;
          const nextDone = t.completedPomodoros + 1;
          return {
            ...t,
            completedPomodoros: nextDone,
            completed:
              nextDone >= t.estimatedPomodoros ? true : t.completed,
          };
        })
      );
    }

    const newRecord: FocusSessionRecord = {
      id: `sess-${Date.now()}`,
      taskId: matchedTask?.id,
      taskTitle: matchedTask?.title || 'Focused Study Session',
      subject: matchedTask?.subject || 'General Study',
      date: todayKey,
      timestamp: new Date().toISOString(),
      durationMinutes,
      mode: 'focus',
      completed: true,
      xpEarned,
    };

    setSessions((prev) => [newRecord, ...prev]);
  };

  const handleSelectTheme = (theme: MoodThemeId) => {
    setProfile((prev) => ({ ...prev, theme }));
  };

  const handleUpdateTimerSettings = (timerSettings: TimerSettings) => {
    setProfile((prev) => ({ ...prev, timerSettings }));
  };

  const handleResetDemoData = () => {
    const freshProfile = getInitialProfile();
    const freshTasks = getInitialTasks(todayKey);
    const freshSessions = getInitialSessions(todayKey);
    setProfile(freshProfile);
    setTasks(freshTasks);
    setSessions(freshSessions);
  };

  const navItems: Array<{
    id: NavSection;
    label: string;
    Icon: typeof Calendar;
  }> = [
    { id: 'planner', label: 'Planner', Icon: Calendar },
    { id: 'focus', label: 'Focus', Icon: Timer },
    { id: 'stats', label: 'Stats', Icon: BarChart3 },
    { id: 'settings', label: 'Profile & Settings', Icon: Settings },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col md:flex-row ${
        themeConfig.isDark ? 'dark' : ''
      } ${themeConfig.textPrimaryClass}`}
      style={{ fontFamily: themeConfig.fontBody }}
    >
      <MoodBackground theme={profile.theme} />

      {/* Desktop Sidebar Navigation */}
      <aside
        aria-label="Desktop sidebar navigation"
        className={`hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-40 p-5 ${themeConfig.glassCardClass} rounded-none border-y-0 border-l-0`}
      >
        {/* Brand Wordmark */}
        <div className="flex items-center gap-2.5 px-2 py-2 mb-6">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
            style={{ backgroundColor: themeConfig.accentHex }}
          >
            <BookOpen className="w-5 h-5" />
          </div>
          <span
            className={`text-xl font-bold tracking-tight whitespace-nowrap ${themeConfig.textPrimaryClass}`}
            style={{ fontFamily: themeConfig.fontDisplay }}
          >
            FocusFlow
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5" aria-label="Main sections">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  active
                    ? themeConfig.activeTabClass
                    : `${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Sidebar Summary */}
        <div
          className={`mt-auto p-3.5 rounded-xl border ${themeConfig.borderClass} bg-white/30 dark:bg-slate-900/30`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={themeConfig.textPrimaryClass}>Daily Goal</span>
            <span
              className={`font-mono tabular-nums ${themeConfig.textSecondaryClass}`}
            >
              {stats.hoursToday}h / {profile.dailyGoalHours}h
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden mt-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((stats.hoursToday / profile.dailyGoalHours) * 100)
                )}%`,
                backgroundColor: themeConfig.accentHex,
              }}
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen pb-20 md:pb-8">
        <HeaderBar
          studentName={profile.name}
          levelInfo={levelInfo}
          currentStreak={stats.currentStreak}
          themeConfig={themeConfig}
          onSelectTheme={handleSelectTheme}
          levelUpBanner={levelUpBanner}
          onDismissLevelUp={() => setLevelUpBanner(null)}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
          {activeSection === 'planner' && (
            <PlannerView
              tasks={tasks}
              todayKey={todayKey}
              themeConfig={themeConfig}
              onAddTask={handleAddTask}
              onAddMultipleTasks={handleAddMultipleTasks}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onToggleTaskComplete={handleToggleTaskComplete}
              onStartFocusTask={handleStartFocusTask}
            />
          )}

          {activeSection === 'focus' && (
            <FocusView
              tasks={tasks}
              selectedTaskId={selectedFocusTaskId}
              onSelectTaskId={setSelectedFocusTaskId}
              timerSettings={profile.timerSettings}
              onUpdateTimerSettings={handleUpdateTimerSettings}
              themeConfig={themeConfig}
              onSelectTheme={handleSelectTheme}
              onSessionCompleted={handleSessionCompleted}
              onToggleSubtask={handleToggleSubtask}
            />
          )}

          {activeSection === 'stats' && (
            <StatsView
              stats={stats}
              sessions={sessions}
              studentName={profile.name}
              themeConfig={themeConfig}
            />
          )}

          {activeSection === 'settings' && (
            <ProfileSettingsView
              profile={profile}
              levelInfo={levelInfo}
              currentStreak={stats.currentStreak}
              themeConfig={themeConfig}
              onUpdateProfile={setProfile}
              onResetDemoData={handleResetDemoData}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 px-2 py-1.5 flex items-center justify-around ${themeConfig.glassHeaderClass} border-t`}
      >
        {navItems.map(({ id, label, Icon }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
                active
                  ? themeConfig.activeTabClass
                  : themeConfig.textSecondaryClass
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{id === 'settings' ? 'Settings' : label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
