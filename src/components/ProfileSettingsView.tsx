import React, { useState } from 'react';
import {
  Bell,
  Check,
  Cloud,
  KeyRound,
  LogIn,
  LogOut,
  Palette,
  Pencil,
  RotateCcw,
  Sliders,
  Trophy,
  User,
} from 'lucide-react';
import {
  CloudUserDoc,
  MoodThemeConfig,
  MoodThemeId,
  UserProfile,
} from '../types';
import {
  formatDailyGoalLabel,
  getLevelInfo,
  getXpRequiredForLevelUp,
  LevelProgressInfo,
} from '../utils/focusLogic';
import { MOOD_THEMES } from '../utils/themes';
import { soundEngine } from '../utils/soundEngine';
import {
  APP_NAME,
  APP_VERSION,
  LumoLogo,
  MadeByAshuWatermark,
} from './LumoLogo';

interface ProfileSettingsViewProps {
  profile: UserProfile;
  levelInfo: LevelProgressInfo;
  currentStreak: number;
  hoursToday: number;
  themeConfig: MoodThemeConfig;
  onUpdateProfile: (next: UserProfile) => void;
  onOpenDailyGoalModal: () => void;
  onResetDemoData: () => void;
  cloudUser?: CloudUserDoc;
  isCloudConnected?: boolean;
  onGoogleSignIn?: () => void;
  onOpenSignInScreen?: () => void;
  onSignOut?: () => void;
}

const ALL_LEVEL_TIERS = [
  { level: 1, title: 'Beginner', minXp: 0 },
  { level: 2, title: 'Learner', minXp: 100 },
  { level: 3, title: 'Scholar', minXp: 250 },
  { level: 4, title: 'Expert', minXp: 450 },
  { level: 5, title: 'Master', minXp: 700 },
];

export function ProfileSettingsView({
  profile,
  levelInfo,
  currentStreak,
  hoursToday,
  themeConfig,
  onUpdateProfile,
  onOpenDailyGoalModal,
  onResetDemoData,
  cloudUser,
  isCloudConnected = false,
  onGoogleSignIn,
  onOpenSignInScreen,
  onSignOut,
}: ProfileSettingsViewProps) {
  const [nameInput, setNameInput] = useState(profile.name);
  const [majorInput, setMajorInput] = useState(profile.majorOrGrade);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...profile,
      name: nameInput.trim() || 'Student',
      majorOrGrade: majorInput.trim() || 'College Student',
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleThemeChange = (themeId: MoodThemeId) => {
    onUpdateProfile({
      ...profile,
      theme: themeId,
    });
  };

  // Suppress unused import lint
  void getLevelInfo;
  void getXpRequiredForLevelUp;

  const goalProgressPercent =
    profile.dailyGoalHours > 0
      ? Math.min(100, Math.round((hoursToday / profile.dailyGoalHours) * 100))
      : 100;

  return (
    <div className="space-y-6">
      {/* 1. Student Profile & XP Level Progression */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile Form (6 cols) */}
        <div
          className={`lg:col-span-6 p-6 rounded-2xl ${themeConfig.glassCardClass}`}
        >
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5" />
            <h2
              className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Student Profile
            </h2>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label
                htmlFor="profile-name-input"
                className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
              >
                Your Name
              </label>
              <input
                id="profile-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-xl text-sm outline-none ${themeConfig.glassInputClass}`}
              />
            </div>

            <div>
              <label
                htmlFor="profile-major-input"
                className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
              >
                School / Major / Grade
              </label>
              <input
                id="profile-major-input"
                type="text"
                value={majorInput}
                onChange={(e) => setMajorInput(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-xl text-sm outline-none ${themeConfig.glassInputClass}`}
              />
            </div>

            {/* Daily Study Goal Card inside Profile & Settings with Edit button */}
            <div
              className={`p-3.5 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span
                    className={`block text-xs font-semibold ${themeConfig.textPrimaryClass}`}
                  >
                    Daily Goal
                  </span>
                  <span
                    data-testid="settings-daily-goal-text"
                    className={`text-xs font-mono tabular-nums ${themeConfig.textSecondaryClass}`}
                  >
                    {hoursToday}h / {formatDailyGoalLabel(profile.dailyGoalHours)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenDailyGoalModal}
                  aria-label="Set daily goal from settings"
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Set daily goal</span>
                </button>
              </div>
              <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden mt-2.5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${goalProgressPercent}%`,
                    backgroundColor: themeConfig.accentHex,
                  }}
                />
              </div>
            </div>

            {/* Friend Stats Privacy Toggle */}
            <div
              className={`p-3.5 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
            >
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div className="space-y-0.5">
                  <span
                    className={`block text-xs font-semibold ${themeConfig.textPrimaryClass}`}
                  >
                    Share my stats with friends
                  </span>
                  <span className={`block text-[11px] ${themeConfig.textMutedClass}`}>
                    When on, friends can view your XP, study hours (today, this
                    week, all-time), 7-day chart, and &ldquo;Studying now&rdquo;
                    status. When off, friends see only your name, level, and
                    streak. Task names, subjects, and session history are never
                    shared.
                  </span>
                </div>
                <input
                  type="checkbox"
                  data-testid="share-stats-toggle"
                  checked={profile.shareStatsWithFriends !== false}
                  onChange={(e) =>
                    onUpdateProfile({
                      ...profile,
                      shareStatsWithFriends: e.target.checked,
                    })
                  }
                  className="mt-0.5 w-4 h-4 rounded accent-sky-600 shrink-0 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              {savedNotice ? (
                <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Profile saved to localStorage
                </span>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className={`px-5 py-2 rounded-xl text-xs font-semibold ${themeConfig.buttonBgClass}`}
              >
                Save Profile
              </button>
            </div>
          </form>
        </div>

        {/* XP & Level System Card (6 cols) */}
        <div
          className={`lg:col-span-6 p-6 rounded-2xl ${themeConfig.glassCardClass}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2
                className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                XP & Level Progression
              </h2>
            </div>
            <span
              className={`text-sm font-mono tabular-nums font-bold ${themeConfig.textPrimaryClass}`}
            >
              {levelInfo.totalXp} Total XP
            </span>
          </div>

          <div className="p-4 rounded-xl bg-black/5 dark:bg-white/10 mb-4">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className={themeConfig.textPrimaryClass}>
                Level {levelInfo.level} · {levelInfo.title}
              </span>
              <span
                className={`font-mono tabular-nums text-xs ${themeConfig.textSecondaryClass}`}
              >
                {levelInfo.currentLevelXp} / {levelInfo.xpNeededForNextLevel} XP
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${levelInfo.progressPercent}%`,
                  backgroundColor: themeConfig.accentHex,
                }}
              />
            </div>
            <p className={`text-xs mt-2 ${themeConfig.textMutedClass}`}>
              Earn 1 XP per focus minute + 10 bonus XP per completed session. Streak multipliers: +10% at 3 days, +25% at 7 days (Current streak: {currentStreak}d).
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2 text-center">
            {ALL_LEVEL_TIERS.map((tier) => {
              const unlocked = levelInfo.level >= tier.level;
              return (
                <div
                  key={tier.level}
                  className={`p-2.5 rounded-xl border text-xs ${
                    unlocked
                      ? `${themeConfig.borderClass} bg-white/50 dark:bg-slate-800/60 font-semibold ${themeConfig.textPrimaryClass}`
                      : `${themeConfig.borderClass} opacity-45 ${themeConfig.textMutedClass}`
                  }`}
                >
                  <div className="font-mono font-bold">Lv.{tier.level}</div>
                  <div className="truncate mt-0.5">{tier.title}</div>
                  <div className="text-[10px] font-mono tabular-nums opacity-75">
                    {tier.minXp} XP
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Mood Theme Switcher Gallery */}
      <div className={`p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-5 h-5" />
          <h2
            className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
            style={{ fontFamily: themeConfig.fontDisplay }}
          >
            Mood Themes
          </h2>
        </div>
        <p className={`text-xs mb-4 ${themeConfig.textSecondaryClass}`}>
          Switch your study atmosphere—each theme adapts the full-screen backdrop, glass tint, accent color, and typography.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.values(MOOD_THEMES).map((t) => {
            const isSelected = profile.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleThemeChange(t.id)}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  themeConfig.borderClass
                } ${
                  isSelected
                    ? 'ring-2 bg-white/60 dark:bg-slate-800/70'
                    : 'bg-white/30 dark:bg-slate-900/30 hover:opacity-90'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-bold ${themeConfig.textPrimaryClass}`}
                      style={{ fontFamily: t.fontDisplay }}
                    >
                      {t.name}
                    </span>
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: t.accentHex }}
                    />
                  </div>
                  <span
                    className={`text-xs font-medium block mt-0.5 ${themeConfig.textSecondaryClass}`}
                  >
                    {t.subtitle}
                  </span>
                  <p className={`text-[11px] mt-2 ${themeConfig.textMutedClass}`}>
                    {t.description}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/10 text-[11px] font-semibold">
                  {isSelected ? 'Active Theme' : 'Select Theme'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Pomodoro Durations & Sound Settings */}
      <div className={`p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-5 h-5" />
          <h2
            className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
            style={{ fontFamily: themeConfig.fontDisplay }}
          >
            Pomodoro Durations & Audio Alerts
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label
              htmlFor="settings-focus-mins"
              className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
            >
              Focus Duration (minutes)
            </label>
            <input
              id="settings-focus-mins"
              type="number"
              min={1}
              max={120}
              value={profile.timerSettings.focusMinutes}
              onChange={(e) =>
                onUpdateProfile({
                  ...profile,
                  timerSettings: {
                    ...profile.timerSettings,
                    focusMinutes: Math.max(1, Number(e.target.value) || 25),
                  },
                })
              }
              className={`w-full px-3.5 py-2 rounded-xl text-sm font-mono tabular-nums outline-none ${themeConfig.glassInputClass}`}
            />
          </div>

          <div>
            <label
              htmlFor="settings-short-mins"
              className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
            >
              Short Break (minutes)
            </label>
            <input
              id="settings-short-mins"
              type="number"
              min={1}
              max={60}
              value={profile.timerSettings.shortBreakMinutes}
              onChange={(e) =>
                onUpdateProfile({
                  ...profile,
                  timerSettings: {
                    ...profile.timerSettings,
                    shortBreakMinutes: Math.max(1, Number(e.target.value) || 5),
                  },
                })
              }
              className={`w-full px-3.5 py-2 rounded-xl text-sm font-mono tabular-nums outline-none ${themeConfig.glassInputClass}`}
            />
          </div>

          <div>
            <label
              htmlFor="settings-long-mins"
              className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
            >
              Long Break (minutes, every 4 sessions)
            </label>
            <input
              id="settings-long-mins"
              type="number"
              min={1}
              max={60}
              value={profile.timerSettings.longBreakMinutes}
              onChange={(e) =>
                onUpdateProfile({
                  ...profile,
                  timerSettings: {
                    ...profile.timerSettings,
                    longBreakMinutes: Math.max(1, Number(e.target.value) || 15),
                  },
                })
              }
              className={`w-full px-3.5 py-2 rounded-xl text-sm font-mono tabular-nums outline-none ${themeConfig.glassInputClass}`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-black/10 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-xs sm:text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={profile.timerSettings.autoSwitchModes}
                onChange={(e) =>
                  onUpdateProfile({
                    ...profile,
                    timerSettings: {
                      ...profile.timerSettings,
                      autoSwitchModes: e.target.checked,
                    },
                  })
                }
                className="rounded"
              />
              <span className={themeConfig.textPrimaryClass}>
                Auto-switch between Focus and Break modes
              </span>
            </label>

            <label className="flex items-center gap-2 text-xs sm:text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={profile.timerSettings.soundAlertEnabled}
                onChange={(e) =>
                  onUpdateProfile({
                    ...profile,
                    timerSettings: {
                      ...profile.timerSettings,
                      soundAlertEnabled: e.target.checked,
                    },
                  })
                }
                className="rounded"
              />
              <span className={themeConfig.textPrimaryClass}>
                Play completion sound alert when timer ends
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Alert sound tone"
              value={profile.timerSettings.alertTone}
              onChange={(e) =>
                onUpdateProfile({
                  ...profile,
                  timerSettings: {
                    ...profile.timerSettings,
                    alertTone: e.target.value as 'chime' | 'bell' | 'marimba',
                  },
                })
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-medium outline-none ${themeConfig.glassInputClass}`}
            >
              <option value="chime">Crystal Chime</option>
              <option value="bell">Zen Bell</option>
              <option value="marimba">Warm Marimba</option>
            </select>

            <button
              type="button"
              onClick={() =>
                soundEngine.playAlert(profile.timerSettings.alertTone)
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Test Sound</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Firebase Cloud Sync & Account Role */}
      {cloudUser && (
        <div
          className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-wrap items-center justify-between gap-4`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cloud
                className="w-4 h-4"
                style={{ color: themeConfig.accentHex }}
              />
              <h3
                className={`text-sm font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                Firebase Cloud Account & Role
              </h3>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase ${
                  cloudUser.role === 'admin'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                    : 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
                }`}
              >
                role: {cloudUser.role}
              </span>
            </div>
            <p className={`text-xs ${themeConfig.textSecondaryClass}`}>
              Username:{' '}
              <span className="font-mono font-semibold">
                @{cloudUser.username}
              </span>{' '}
              · Week:{' '}
              <span className="font-mono font-semibold">
                {cloudUser.weekKey}
              </span>{' '}
              ({isCloudConnected ? 'Connected to Firestore' : 'Local Workspace Mode'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isCloudConnected && onOpenSignInScreen && (
              <button
                type="button"
                onClick={onOpenSignInScreen}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Admin Login</span>
              </button>
            )}

            {isCloudConnected && onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              onGoogleSignIn && (
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${themeConfig.buttonBgClass}`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign in with Google</span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* 5. LocalStorage Data Controls */}
      <div
        className={`p-5 rounded-2xl ${themeConfig.glassCardClass} flex flex-wrap items-center justify-between gap-4`}
      >
        <div>
          <h3
            className={`text-sm font-bold ${themeConfig.textPrimaryClass}`}
            style={{ fontFamily: themeConfig.fontDisplay }}
          >
            Local Storage Data
          </h3>
          <p className={`text-xs ${themeConfig.textMutedClass}`}>
            All tasks, Pomodoro sessions, XP, and theme preferences are automatically saved in your browser's localStorage and synced to Firestore on sign-in.
          </p>
        </div>
        <button
          type="button"
          onClick={onResetDemoData}
          className={`px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Data</span>
        </button>
      </div>

      {/* 6. About Card with App Name, Version, and Made by Ashu Watermark */}
      <div
        data-testid="settings-about-card"
        className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-wrap items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-3.5">
          <LumoLogo
            themeConfig={themeConfig}
            variant="wide"
            size="md"
            subtitle={`About ${APP_NAME} · Version ${APP_VERSION}`}
            dataTestId="settings-about-logo"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            data-testid="settings-about-version"
            className={`text-xs font-mono tabular-nums ${themeConfig.textSecondaryClass}`}
          >
            {APP_NAME} {APP_VERSION}
          </span>
          <span aria-hidden="true" className={themeConfig.textMutedClass}>
            ·
          </span>
          <MadeByAshuWatermark
            themeConfig={themeConfig}
            dataTestId="settings-about-watermark"
          />
        </div>
      </div>
    </div>
  );
}
