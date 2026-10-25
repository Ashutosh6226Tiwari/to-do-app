import { Flame, Sparkles, Trophy } from 'lucide-react';
import { MoodThemeConfig, MoodThemeId } from '../types';
import { LevelProgressInfo } from '../utils/focusLogic';
import { MOOD_THEMES } from '../utils/themes';

interface HeaderBarProps {
  studentName: string;
  levelInfo: LevelProgressInfo;
  currentStreak: number;
  themeConfig: MoodThemeConfig;
  onSelectTheme: (theme: MoodThemeId) => void;
  levelUpBanner: { show: boolean; newLevel: number; title: string } | null;
  onDismissLevelUp: () => void;
}

export function HeaderBar({
  studentName,
  levelInfo,
  currentStreak,
  themeConfig,
  onSelectTheme,
  levelUpBanner,
  onDismissLevelUp,
}: HeaderBarProps) {
  const themeList = Object.values(MOOD_THEMES);

  return (
    <header
      className={`sticky top-0 z-30 px-4 sm:px-6 py-3 transition-colors duration-300 ${themeConfig.glassHeaderClass}`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Left: Student Greeting & Level Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm"
            style={{ backgroundColor: themeConfig.accentHex }}
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
                className="w-28 sm:w-44 h-2 rounded-full overflow-hidden bg-black/10 dark:bg-white/15"
                role="progressbar"
                aria-label="Level XP progress"
                aria-valuenow={levelInfo.currentLevelXp}
                aria-valuemin={0}
                aria-valuemax={levelInfo.xpNeededForNextLevel}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${levelInfo.progressPercent}%`,
                    backgroundColor: themeConfig.accentHex,
                  }}
                />
              </div>
              <span
                className={`text-xs font-mono tabular-nums whitespace-nowrap ${themeConfig.textMutedClass}`}
              >
                {levelInfo.currentLevelXp} / {levelInfo.xpNeededForNextLevel} XP
              </span>
            </div>
          </div>
        </div>

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
