import { useEffect, useRef, useState } from 'react';
import { Flame, Pause, Timer, Trophy } from 'lucide-react';
import { MoodThemeConfig, MoodThemeId, TimerMode } from '../types';
import { formatTimeMMSS, LevelProgressInfo } from '../utils/focusLogic';
import { MOOD_THEMES } from '../utils/themes';

interface HeaderBarProps {
  studentName: string;
  levelInfo: LevelProgressInfo;
  currentStreak: number;
  themeConfig: MoodThemeConfig;
  onSelectTheme: (theme: MoodThemeId) => void;
  levelUpBanner: { show: boolean; newLevel: number; title: string } | null;
  onDismissLevelUp: () => void;
  showMiniTimer: boolean;
  miniTimerMode: TimerMode;
  miniTimerRemainingSeconds: number;
  onJumpToFocus: () => void;
  onPauseMiniTimer: () => void;
}

const MINI_MODE_LABELS: Record<TimerMode, string> = {
  focus: 'Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

export function HeaderBar({
  studentName,
  levelInfo,
  currentStreak,
  themeConfig,
  onSelectTheme,
  levelUpBanner,
  onDismissLevelUp,
  showMiniTimer,
  miniTimerMode,
  miniTimerRemainingSeconds,
  onJumpToFocus,
  onPauseMiniTimer,
}: HeaderBarProps) {
  const themeList = Object.values(MOOD_THEMES);
  const prevTotalXpRef = useRef<number>(levelInfo.totalXp);
  const [xpGainDelta, setXpGainDelta] = useState<number | null>(null);

  useEffect(() => {
    if (levelInfo.totalXp > prevTotalXpRef.current) {
      const gained = levelInfo.totalXp - prevTotalXpRef.current;
      setXpGainDelta(gained);
      prevTotalXpRef.current = levelInfo.totalXp;
      const timer = window.setTimeout(() => setXpGainDelta(null), 2500);
      return () => window.clearTimeout(timer);
    }
    prevTotalXpRef.current = levelInfo.totalXp;
  }, [levelInfo.totalXp]);

  return (
    <header
      className={`sticky top-0 z-30 px-4 sm:px-6 py-3 transition-colors duration-300 ${themeConfig.glassHeaderClass}`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        {/* Left: Student Greeting & Level Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm transition-transform duration-500"
            style={{
              backgroundColor: themeConfig.accentHex,
              transform: xpGainDelta ? 'scale(1.08)' : 'scale(1)',
            }}
          >
            Lv.{levelInfo.level}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-semibold text-sm sm:text-base truncate ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                {studentName}
              </span>
              <span aria-hidden="true" className={themeConfig.textMutedClass}>
                ·
              </span>
              <span
                className={`text-xs sm:text-sm font-medium whitespace-nowrap ${themeConfig.textSecondaryClass}`}
              >
                {levelInfo.title}
              </span>
            </div>

            {/* XP Progress Bar */}
            <div className="flex items-center gap-2.5 mt-1">
              <div
                className="w-28 sm:w-44 h-2.5 rounded-full overflow-hidden bg-black/10 dark:bg-white/15 p-0.5"
                role="progressbar"
                aria-label="Level XP progress"
                aria-valuenow={levelInfo.currentLevelXp}
                aria-valuemin={0}
                aria-valuemax={levelInfo.xpNeededForNextLevel}
              >
                <div
                  data-testid="xp-progress-bar-fill"
                  className="h-full rounded-full transition-[width,background-color,box-shadow,transform] duration-700 ease-out"
                  style={{
                    width: `${levelInfo.progressPercent}%`,
                    backgroundColor: themeConfig.accentHex,
                    boxShadow: xpGainDelta
                      ? `0 0 12px ${themeConfig.accentHex}`
                      : 'none',
                  }}
                />
              </div>
              <span
                className={`text-xs font-mono tabular-nums whitespace-nowrap transition-colors duration-300 ${
                  xpGainDelta
                    ? 'font-bold text-emerald-500'
                    : themeConfig.textMutedClass
                }`}
              >
                {levelInfo.currentLevelXp} / {levelInfo.xpNeededForNextLevel} XP
                {xpGainDelta ? ` (+${xpGainDelta})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right: Floating Mini-Timer (visible when session is running outside Focus screen) */}
        {showMiniTimer && (
          <div
            data-testid="floating-mini-timer"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-sm ${themeConfig.borderClass} bg-white/80 dark:bg-slate-900/80`}
          >
            <button
              type="button"
              onClick={onJumpToFocus}
              aria-label="Return to running Focus timer"
              className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap"
            >
              <Timer
                className="w-4 h-4 shrink-0"
                style={{ color: themeConfig.accentHex }}
              />
              <span className={themeConfig.textSecondaryClass}>
                {MINI_MODE_LABELS[miniTimerMode]}
              </span>
              <span
                data-testid="mini-timer-countdown"
                className={`font-mono tabular-nums text-sm font-bold ${themeConfig.textPrimaryClass}`}
              >
                {formatTimeMMSS(miniTimerRemainingSeconds)}
              </span>
            </button>
            <button
              type="button"
              onClick={onPauseMiniTimer}
              aria-label="Pause timer from mini player"
              className={`p-1 rounded-lg ${themeConfig.buttonHoverClass}`}
              title="Pause timer"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Right: Streak & Mood Theme Switcher */}
        <div className="flex flex-wrap items-center justify-between w-full sm:w-auto gap-2 sm:gap-4">
          <div
            className={`flex items-center gap-1.5 text-xs sm:text-sm font-medium whitespace-nowrap ${themeConfig.textSecondaryClass}`}
            title="Current daily focus streak (3+ days: +10% XP, 7+ days: +25% XP)"
          >
            <Flame className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="tabular-nums font-semibold">{currentStreak}d</span>
            <span className="hidden sm:inline">streak</span>
            {currentStreak >= 3 && (
              <span
                className={`text-xs font-mono tabular-nums ${themeConfig.textMutedClass}`}
              >
                ({currentStreak >= 7 ? '+25% XP' : '+10% XP'})
              </span>
            )}
          </div>

          {/* Mood Theme Segmented Switcher */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10 overflow-x-auto max-w-full"
            role="group"
            aria-label="Mood Theme Selector"
          >
            {themeList.map((t) => {
              const active = t.id === themeConfig.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTheme(t.id)}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                    active
                      ? themeConfig.activeTabClass
                      : `${themeConfig.textSecondaryClass} hover:opacity-85`
                  }`}
                  aria-pressed={active}
                  title={`${t.name} — ${t.subtitle}`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Celebratory Level-Up Banner */}
      {levelUpBanner?.show && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 max-w-2xl mx-auto px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg flex items-center justify-between gap-4 animate-bounce"
        >
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 shrink-0" />
            <div className="text-sm font-medium">
              <span className="font-bold">Level Up!</span> You reached{' '}
              <span className="underline">
                Level {levelUpBanner.newLevel} ({levelUpBanner.title})
              </span>
              ! Keep your focus flow going!
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissLevelUp}
            className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            Awesome
          </button>
        </div>
      )}
    </header>
  );
}
