import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  Clock,
  Flame,
  Globe,
  History,
  Sparkles,
} from 'lucide-react';
import { FocusSessionRecord, MoodThemeConfig } from '../types';
import { StudyStatsSummary } from '../utils/focusLogic';
import {
  generateWeeklyInsightWithGemini,
  searchGroundedStudyQuery,
  SearchGroundingResponse,
  WeeklyInsightResponse,
} from '../utils/geminiClient';

interface StatsViewProps {
  stats: StudyStatsSummary;
  sessions: FocusSessionRecord[];
  studentName: string;
  themeConfig: MoodThemeConfig;
}

export function StatsView({
  stats,
  sessions,
  studentName,
  themeConfig,
}: StatsViewProps) {
  const [insight, setInsight] = useState<WeeklyInsightResponse | null>({
    headline: `Steady Academic Flow, ${studentName}!`,
    summary: `You have completed ${stats.hoursThisWeek} hours of focused study this week with a ${stats.currentStreak}-day active streak. Your top focus blocks are concentrated in ${stats.subjectBreakdown[0]?.subject || 'Physics'} and ${stats.subjectBreakdown[1]?.subject || 'Computer Science'}.`,
    tips: [
      'Schedule your most mathematically demanding subject during your first Pomodoro block of the day.',
      'Take a full 15-minute walk after every 4th Pomodoro to consolidate working memory into long-term recall.',
      'Protect your streak on busy days with at least one focused 25-minute review block.',
    ],
  });
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  // Google Search Grounding Study Assistant state (gemini-3.8-flash)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] =
    useState<SearchGroundingResponse | null>(null);

  const handleRefreshInsight = async () => {
    setIsLoadingInsight(true);
    try {
      const res = await generateWeeklyInsightWithGemini(
        {
          hoursToday: stats.hoursToday,
          hoursThisWeek: stats.hoursThisWeek,
          hoursThisMonth: stats.hoursThisMonth,
          currentStreak: stats.currentStreak,
          longestStreak: stats.longestStreak,
          topSubjects: stats.subjectBreakdown.slice(0, 3),
        },
        studentName
      );
      setInsight(res);
    } finally {
      setIsLoadingInsight(false);
    }
  };

  const handleSearchGrounding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await searchGroundedStudyQuery(searchQuery.trim());
      setSearchResult(res);
    } finally {
      setIsSearching(false);
    }
  };

  const maxDailyMinutes = Math.max(
    60,
    ...stats.dailyChart.map((d) => d.minutes)
  );

  // Organize 112 heatmap days into 16 columns of 7 days
  const heatmapWeeks: Array<typeof stats.heatmap> = [];
  for (let i = 0; i < stats.heatmap.length; i += 7) {
    heatmapWeeks.push(stats.heatmap.slice(i, i + 7));
  }

  const getIntensityClass = (intensity: 0 | 1 | 2 | 3 | 4) => {
    if (intensity === 0) return 'bg-black/10 dark:bg-white/10';
    if (intensity === 1) return 'bg-emerald-300 dark:bg-emerald-900/80';
    if (intensity === 2) return 'bg-emerald-400 dark:bg-emerald-700';
    if (intensity === 3) return 'bg-emerald-500 dark:bg-emerald-500';
    return 'bg-emerald-600 dark:bg-emerald-400';
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={`p-4 rounded-2xl ${themeConfig.glassCardClass}`}>
          <div
            className={`text-xs font-medium flex items-center gap-1.5 ${themeConfig.textMutedClass}`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Studied Today</span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-1 ${themeConfig.textPrimaryClass}`}
          >
            {stats.hoursToday}h
          </div>
          <div
            className={`text-xs font-mono tabular-nums mt-0.5 ${themeConfig.textMutedClass}`}
          >
            {stats.minutesToday} mins
          </div>
        </div>

        <div className={`p-4 rounded-2xl ${themeConfig.glassCardClass}`}>
          <div
            className={`text-xs font-medium flex items-center gap-1.5 ${themeConfig.textMutedClass}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>This Week</span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-1 ${themeConfig.textPrimaryClass}`}
          >
            {stats.hoursThisWeek}h
          </div>
          <div
            className={`text-xs font-mono tabular-nums mt-0.5 ${themeConfig.textMutedClass}`}
          >
            {stats.minutesThisWeek} mins
          </div>
        </div>

        <div className={`p-4 rounded-2xl ${themeConfig.glassCardClass}`}>
          <div
            className={`text-xs font-medium flex items-center gap-1.5 ${themeConfig.textMutedClass}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>This Month</span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-1 ${themeConfig.textPrimaryClass}`}
          >
            {stats.hoursThisMonth}h
          </div>
          <div
            className={`text-xs font-mono tabular-nums mt-0.5 ${themeConfig.textMutedClass}`}
          >
            {stats.totalSessionsCompleted} sessions
          </div>
        </div>

        <div className={`p-4 rounded-2xl ${themeConfig.glassCardClass}`}>
          <div
            className={`text-xs font-medium flex items-center gap-1.5 ${themeConfig.textMutedClass}`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Current Streak</span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-1 ${themeConfig.textPrimaryClass}`}
          >
            {stats.currentStreak} days
          </div>
          <div className={`text-xs mt-0.5 ${themeConfig.textMutedClass}`}>
            {stats.currentStreak >= 7
              ? '+25% XP active'
              : stats.currentStreak >= 3
                ? '+10% XP active'
                : 'Reach 3d for +10% XP'}
          </div>
        </div>

        <div
          className={`col-span-2 lg:col-span-1 p-4 rounded-2xl ${themeConfig.glassCardClass}`}
        >
          <div
            className={`text-xs font-medium flex items-center gap-1.5 ${themeConfig.textMutedClass}`}
          >
            <Award className="w-3.5 h-3.5 text-violet-500" />
            <span>Longest Streak</span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-1 ${themeConfig.textPrimaryClass}`}
          >
            {stats.longestStreak} days
          </div>
          <div className={`text-xs mt-0.5 ${themeConfig.textMutedClass}`}>
            Personal record
          </div>
        </div>
      </div>

      {/* Bar Chart by Day + Subject Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bar Chart by Day (7 cols) */}
        <div
          className={`lg:col-span-7 p-6 rounded-2xl ${themeConfig.glassCardClass}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                Daily Study Hours (Last 7 Days)
              </h2>
              <p className={`text-xs ${themeConfig.textMutedClass}`}>
                Focused Pomodoro hours logged per day
              </p>
            </div>
          </div>

          <div className="h-52 flex items-end justify-between gap-3 pt-6 px-2">
            {stats.dailyChart.map((point) => {
              const heightPercent = Math.max(
                6,
                Math.round((point.minutes / maxDailyMinutes) * 100)
              );
              return (
                <div
                  key={point.date}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
                >
                  <span
                    className={`text-[11px] font-mono tabular-nums ${themeConfig.textSecondaryClass}`}
                  >
                    {point.hours}h
                  </span>
                  <div className="w-full max-w-[2.75rem] bg-black/5 dark:bg-white/10 rounded-t-xl h-36 flex items-end overflow-hidden">
                    <div
                      className="w-full rounded-t-xl transition-all duration-500"
                      style={{
                        height: `${heightPercent}%`,
                        backgroundColor:
                          point.minutes > 0
                            ? themeConfig.accentHex
                            : 'rgba(148,163,184,0.25)',
                      }}
                      title={`${point.date}: ${point.minutes} mins (${point.sessionsCount} sessions)`}
                    />
                  </div>
                  <span
                    className={`text-xs font-semibold ${themeConfig.textPrimaryClass}`}
                  >
                    {point.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Breakdown by Subject (5 cols) */}
        <div
          className={`lg:col-span-5 p-6 rounded-2xl ${themeConfig.glassCardClass}`}
        >
          <h2
            className={`text-lg font-bold mb-1 ${themeConfig.textPrimaryClass}`}
            style={{ fontFamily: themeConfig.fontDisplay }}
          >
            Breakdown by Subject
          </h2>
          <p className={`text-xs mb-5 ${themeConfig.textMutedClass}`}>
            Proportion of total focused study time across courses
          </p>

          <div className="space-y-4">
            {stats.subjectBreakdown.length === 0 ? (
              <p className={`text-xs ${themeConfig.textMutedClass}`}>
                Complete your first focus session to see subject analytics.
              </p>
            ) : (
              stats.subjectBreakdown.map((item) => (
                <div key={item.subject} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-semibold ${themeConfig.textPrimaryClass}`}
                    >
                      {item.subject}
                    </span>
                    <span
                      className={`font-mono tabular-nums ${themeConfig.textSecondaryClass}`}
                    >
                      {item.hours}h ({item.percentage}%) · {item.sessionsCount}{' '}
                      sess
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(4, item.percentage)}%`,
                        backgroundColor: themeConfig.accentHex,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* GitHub-Style Study Heatmap */}
      <div className={`p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2
              className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Study Consistency Heatmap
            </h2>
            <p className={`text-xs ${themeConfig.textMutedClass}`}>
              16-week daily activity matrix (darker squares indicate more Pomodoro hours)
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className={themeConfig.textMutedClass}>Less</span>
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <span
                key={lvl}
                className={`w-3.5 h-3.5 rounded-sm ${getIntensityClass(lvl)}`}
              />
            ))}
            <span className={themeConfig.textMutedClass}>More</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-flex gap-1.5 min-w-full justify-between">
            {heatmapWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map((cell) => (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.minutes} minutes studied`}
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md transition-transform hover:scale-110 ${getIntensityClass(
                      cell.intensity
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gemini Weekly Insight + Google Search Grounding Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Insight Card (7 cols) */}
        <div
          className={`lg:col-span-7 p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-col justify-between`}
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h2
                  className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
                  style={{ fontFamily: themeConfig.fontDisplay }}
                >
                  AI Weekly Study Insight
                </h2>
              </div>

              <button
                type="button"
                onClick={handleRefreshInsight}
                disabled={isLoadingInsight}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${themeConfig.buttonBgClass}`}
              >
                {isLoadingInsight ? 'Analyzing...' : 'Refresh Insight'}
              </button>
            </div>

            {insight && (
              <div className="space-y-3">
                <h3
                  className={`text-base font-semibold ${themeConfig.textPrimaryClass}`}
                >
                  {insight.headline}
                </h3>
                <p
                  className={`text-sm leading-relaxed ${themeConfig.textSecondaryClass}`}
                >
                  {insight.summary}
                </p>
                <div className="pt-2">
                  <span
                    className={`text-xs font-semibold block mb-1.5 ${themeConfig.textPrimaryClass}`}
                  >
                    Personalized Coaching Tips:
                  </span>
                  <ul
                    className={`list-disc list-inside text-xs space-y-1.5 ${themeConfig.textSecondaryClass}`}
                  >
                    {insight.tips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Google Search Grounding Study Fact-Checker (5 cols) */}
        <div
          className={`lg:col-span-5 p-6 rounded-2xl ${themeConfig.glassCardClass}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-sky-500" />
            <h2
              className={`text-base font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Google Search Study Lookup
            </h2>
          </div>
          <p className={`text-xs mb-3 ${themeConfig.textSecondaryClass}`}>
            Verify exam dates, formulas, or syllabus topics with live Google Search grounding (<span className="font-mono">gemini-3.8-flash</span>).
          </p>

          <form onSubmit={handleSearchGrounding} className="flex gap-2">
            <input
              type="text"
              aria-label="Search study topic with Google Search grounding"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., AP Physics C rotational inertia formulas"
              className={`flex-1 px-3 py-2 rounded-xl text-xs outline-none ${themeConfig.glassInputClass}`}
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 disabled:opacity-50 ${themeConfig.buttonBgClass}`}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchResult && (
            <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/15 space-y-2 max-h-48 overflow-y-auto">
              <p className={`text-xs leading-relaxed ${themeConfig.textSecondaryClass}`}>
                {searchResult.answer}
              </p>
              {searchResult.sources.length > 0 && (
                <div className="pt-1">
                  <span
                    className={`text-[11px] font-semibold block ${themeConfig.textMutedClass}`}
                  >
                    Verified Web Sources:
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {searchResult.sources.map((src, i) =>
                      src.uri ? (
                        <a
                          key={i}
                          href={src.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] underline text-sky-600 dark:text-sky-400 truncate max-w-[14rem]"
                        >
                          {src.title || src.uri}
                        </a>
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Session History Log Table */}
      <div className={`p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <h2
              className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Focus Session History Log
            </h2>
          </div>
          <span
            className={`text-xs font-mono tabular-nums ${themeConfig.textMutedClass}`}
          >
            Showing latest {Math.min(12, sessions.length)} of {sessions.length}{' '}
            sessions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`border-b text-xs ${themeConfig.borderClass} ${themeConfig.textMutedClass}`}
              >
                <th className="py-2.5 pr-4 font-semibold">Task</th>
                <th className="py-2.5 px-4 font-semibold">Subject</th>
                <th className="py-2.5 px-4 font-semibold">Date</th>
                <th className="py-2.5 px-4 font-semibold text-right">
                  Duration
                </th>
                <th className="py-2.5 pl-4 font-semibold text-right">
                  XP Earned
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10 text-xs sm:text-sm">
              {sessions.slice(0, 12).map((sess) => (
                <tr key={sess.id}>
                  <td
                    className={`py-2.5 pr-4 font-medium ${themeConfig.textPrimaryClass}`}
                  >
                    {sess.taskTitle}
                  </td>
                  <td className={`py-2.5 px-4 ${themeConfig.textSecondaryClass}`}>
                    {sess.subject}
                  </td>
                  <td
                    className={`py-2.5 px-4 font-mono tabular-nums ${themeConfig.textMutedClass}`}
                  >
                    {sess.date}
                  </td>
                  <td
                    className={`py-2.5 px-4 font-mono tabular-nums text-right ${themeConfig.textSecondaryClass}`}
                  >
                    {sess.durationMinutes}m
                  </td>
                  <td
                    className={`py-2.5 pl-4 font-mono tabular-nums font-semibold text-right ${themeConfig.textPrimaryClass}`}
                  >
                    +{sess.xpEarned} XP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
