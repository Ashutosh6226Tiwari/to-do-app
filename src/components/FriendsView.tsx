import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Check,
  Clock,
  Eye,
  EyeOff,
  Flame,
  Lock,
  Radio,
  Search,
  Sparkles,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  CloudUserDoc,
  FriendRequestItem,
  FriendshipItem,
  LeaderboardTab,
  MoodThemeConfig,
} from '../types';
import {
  formatDateKey,
  getIsoWeekKey,
  getTodayHoursForUser,
  getTodayMinutesForUser,
  normalizeWeeklyMinutes,
  PublicFriendProfileView,
  resolvePublicFriendProfileStats,
} from '../utils/focusLogic';

interface FriendsViewProps {
  currentUser: CloudUserDoc;
  friends: CloudUserDoc[];
  friendships: FriendshipItem[];
  incomingRequests: FriendRequestItem[];
  outgoingRequests: FriendRequestItem[];
  themeConfig: MoodThemeConfig;
  isCloudConnected: boolean;
  todayKey?: string;
  onSearchUsername: (username: string) => Promise<CloudUserDoc | null>;
  onSendFriendRequest: (targetUser: CloudUserDoc) => Promise<void>;
  onRespondRequest: (
    request: FriendRequestItem,
    decision: 'accepted' | 'declined'
  ) => Promise<void>;
  onRemoveFriend: (friendUid: string) => Promise<void>;
}

interface GlassStatsProfilePanelProps {
  profileView: PublicFriendProfileView;
  isSelf: boolean;
  themeConfig: MoodThemeConfig;
  onClose?: () => void;
  testId: string;
}

/**
 * Reusable Glass Profile Panel used for both:
 * 1. Tapping a friend card ("Friend profile" panel)
 * 2. Showing the user's own full stats in the exact same panel layout for consistency.
 *
 * Privacy guarantee:
 * - Never displays task names, subjects, or session history—only totals and 7-day daily hours.
 * - When `profileView.isStatsHiddenFromViewer` is true (`shareStatsWithFriends === false` for a friend),
 *   displays ONLY name, level, and streak.
 */
function GlassStatsProfilePanel({
  profileView,
  isSelf,
  themeConfig,
  onClose,
  testId,
}: GlassStatsProfilePanelProps) {
  const maxBarHours = useMemo(() => {
    if (profileView.sevenDayChart.length === 0) return 2;
    const highest = Math.max(
      ...profileView.sevenDayChart.map((d) => d.hours),
      0
    );
    return Math.max(2, Math.ceil(highest));
  }, [profileView.sevenDayChart]);

  return (
    <section
      data-testid={testId}
      aria-label={
        isSelf
          ? 'Your study stats profile panel'
          : `Friend profile for ${profileView.displayName}`
      }
      className={`p-5 sm:p-6 rounded-2xl border ${themeConfig.glassCardClass} space-y-5 transition-all`}
    >
      {/* Top Identity Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold text-white shrink-0 shadow-md"
            style={{ backgroundColor: themeConfig.accentHex }}
          >
            <span className="text-xs uppercase tracking-wider opacity-85 leading-none">
              Lv.{profileView.level}
            </span>
            <span className="text-[10px] font-mono opacity-90 mt-0.5">
              {profileView.levelTitle}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/10 ${themeConfig.textSecondaryClass}`}
              >
                {isSelf ? 'Your Public Stats Profile' : 'Friend Profile'}
              </span>
              {isSelf && (
                <span
                  data-testid="my-profile-sharing-badge"
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                    profileView.shareStatsWithFriends
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                  }`}
                >
                  {profileView.shareStatsWithFriends ? (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Shared with friends</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Private (friends see name, level & streak only)</span>
                    </>
                  )}
                </span>
              )}
            </div>

            <h2
              className={`text-lg sm:text-xl font-bold truncate mt-1 ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              {profileView.displayName}
              {isSelf ? ' (You)' : ''}
            </h2>
            <p className={`text-xs font-mono ${themeConfig.textMutedClass}`}>
              @{profileView.username}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Studying now badge (hidden when friend has stats sharing off) */}
          {!profileView.isStatsHiddenFromViewer && (
            <div data-testid={`${testId}-studying-status`}>
              {profileView.studyingNow ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold text-xs">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>Studying now</span>
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-medium ${themeConfig.borderClass} ${themeConfig.textMutedClass}`}
                >
                  <span>Offline / Idle</span>
                </span>
              )}
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close friend profile"
              data-testid="close-friend-profile-btn"
              className={`p-1.5 rounded-xl border transition-colors ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* When friend has turned off "Share my stats with friends": show ONLY name, level, and streak */}
      {profileView.isStatsHiddenFromViewer ? (
        <div
          data-testid="friend-profile-private-notice"
          className={`p-4 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 space-y-3`}
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span
                className={`text-xs font-semibold ${themeConfig.textSecondaryClass}`}
              >
                Level:
              </span>
              <span
                className={`text-sm font-mono font-bold ${themeConfig.textPrimaryClass}`}
              >
                Lv.{profileView.level} ({profileView.levelTitle})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span
                className={`text-xs font-semibold ${themeConfig.textSecondaryClass}`}
              >
                Current Streak:
              </span>
              <span
                className={`text-sm font-mono font-bold ${themeConfig.textPrimaryClass}`}
              >
                {profileView.currentStreak}d
              </span>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 text-xs pt-2 border-t border-black/5 dark:border-white/10 ${themeConfig.textMutedClass}`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {profileView.displayName} has turned off &ldquo;Share my stats
              with friends&rdquo;. Only name, level, and current streak are
              shown.
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Level & XP Progress Bar */}
          <div
            className={`p-3.5 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
          >
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="flex items-center gap-1.5">
                <Sparkles
                  className="w-3.5 h-3.5"
                  style={{ color: themeConfig.accentHex }}
                />
                <span className={themeConfig.textPrimaryClass}>
                  Level {profileView.level} · {profileView.levelTitle}
                </span>
              </span>
              <span
                data-testid={`${testId}-xp-text`}
                className={`font-mono tabular-nums ${themeConfig.textSecondaryClass}`}
              >
                {(profileView.xp ?? 0).toLocaleString()} Total XP (
                {profileView.currentLevelXp} /{' '}
                {profileView.xpNeededForNextLevel} XP)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${profileView.xpProgressPercent ?? 0}%`,
                  backgroundColor: themeConfig.accentHex,
                }}
              />
            </div>
          </div>

          {/* 5 Summary Metric Cards: Current Streak, Longest Streak, Hours Today, This Week, All-Time */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div
              className={`p-3 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
            >
              <div
                className={`text-[11px] font-medium flex items-center gap-1 ${themeConfig.textMutedClass}`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Current Streak</span>
              </div>
              <div
                data-testid={`${testId}-current-streak`}
                className={`text-base sm:text-lg font-mono font-bold mt-1 ${themeConfig.textPrimaryClass}`}
              >
                {profileView.currentStreak}d
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
            >
              <div
                className={`text-[11px] font-medium flex items-center gap-1 ${themeConfig.textMutedClass}`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Longest Streak</span>
              </div>
              <div
                data-testid={`${testId}-longest-streak`}
                className={`text-base sm:text-lg font-mono font-bold mt-1 ${themeConfig.textPrimaryClass}`}
              >
                {profileView.longestStreak ?? profileView.currentStreak}d
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
            >
              <div
                className={`text-[11px] font-medium flex items-center gap-1 ${themeConfig.textMutedClass}`}
              >
                <Calendar className="w-3.5 h-3.5 text-sky-500" />
                <span>Today</span>
              </div>
              <div
                data-testid={`${testId}-hours-today`}
                className={`text-base sm:text-lg font-mono font-bold mt-1 ${themeConfig.textPrimaryClass}`}
              >
                {(profileView.hoursToday ?? 0).toFixed(1)}h
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
            >
              <div
                className={`text-[11px] font-medium flex items-center gap-1 ${themeConfig.textMutedClass}`}
              >
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span>This Week</span>
              </div>
              <div
                data-testid={`${testId}-hours-week`}
                className={`text-base sm:text-lg font-mono font-bold mt-1 ${themeConfig.textPrimaryClass}`}
              >
                {(profileView.hoursThisWeek ?? 0).toFixed(1)}h
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 col-span-2 sm:col-span-1`}
            >
              <div
                className={`text-[11px] font-medium flex items-center gap-1 ${themeConfig.textMutedClass}`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                <span>All-Time</span>
              </div>
              <div
                data-testid={`${testId}-hours-alltime`}
                className={`text-base sm:text-lg font-mono font-bold mt-1 ${themeConfig.textPrimaryClass}`}
              >
                {(profileView.hoursAllTime ?? 0).toFixed(1)}h
              </div>
            </div>
          </div>

          {/* 7-Day Bar Chart of Daily Hours */}
          <div
            data-testid={`${testId}-7day-chart`}
            className={`p-4 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-xs font-bold flex items-center gap-1.5 ${themeConfig.textPrimaryClass}`}
              >
                <BarChart3
                  className="w-4 h-4"
                  style={{ color: themeConfig.accentHex }}
                />
                <span>Last 7 Days Study Hours</span>
              </span>
              <span className={`text-[11px] ${themeConfig.textMutedClass}`}>
                Totals only · tasks & subjects stay private
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2 items-end h-28 pt-4">
              {profileView.sevenDayChart.map((point) => {
                const heightPct =
                  point.hours > 0
                    ? Math.max(12, Math.min(100, (point.hours / maxBarHours) * 100))
                    : 6;
                return (
                  <div
                    key={point.date}
                    className="flex flex-col items-center justify-end h-full gap-1"
                  >
                    <span
                      className={`text-[10px] font-mono tabular-nums ${themeConfig.textSecondaryClass}`}
                    >
                      {point.hours > 0 ? `${point.hours}h` : '0h'}
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        title={`${point.date}: ${point.hours}h (${point.minutes}m)`}
                        className="w-full max-w-[28px] rounded-t-lg transition-all duration-500"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor:
                            point.hours > 0
                              ? themeConfig.accentHex
                              : 'rgba(148, 163, 184, 0.25)',
                        }}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${themeConfig.textMutedClass}`}
                    >
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function FriendsView({
  currentUser,
  friends,
  friendships,
  incomingRequests,
  outgoingRequests,
  themeConfig,
  isCloudConnected,
  todayKey: todayKeyProp,
  onSearchUsername,
  onSendFriendRequest,
  onRespondRequest,
  onRemoveFriend,
}: FriendsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<CloudUserDoc | null>(null);
  const [searchStatusMsg, setSearchStatusMsg] = useState<string | null>(null);
  const [leaderboardTab, setLeaderboardTab] =
    useState<LeaderboardTab>('today');
  const [selectedFriendUid, setSelectedFriendUid] = useState<string | null>(
    null
  );

  const todayKey = useMemo(
    () => todayKeyProp || formatDateKey(new Date()),
    [todayKeyProp]
  );
  const currentWeekKey = useMemo(() => getIsoWeekKey(new Date()), []);

  // Normalize weeklyMinutes when weekKey changes for all leaderboard participants (friends + me)
  const normalizedParticipants = useMemo(() => {
    const mapUser = (u: CloudUserDoc): CloudUserDoc => {
      const norm = normalizeWeeklyMinutes(
        u.weeklyMinutes,
        u.weekKey,
        currentWeekKey
      );
      return {
        ...u,
        weeklyMinutes: norm.weeklyMinutes,
        weekKey: norm.weekKey,
      };
    };
    const uniqueMap = new Map<string, CloudUserDoc>();
    uniqueMap.set(currentUser.uid, mapUser(currentUser));
    friends.forEach((f) => uniqueMap.set(f.uid, mapUser(f)));
    return Array.from(uniqueMap.values());
  }, [currentUser, friends, currentWeekKey]);

  // Privacy-aware leaderboard sorting:
  // If a friend has shareStatsWithFriends === false, their today/weekly/XP totals are private (-1 for sorting),
  // while their streak remains visible on the Streak tab.
  const sortedLeaderboard = useMemo(() => {
    const list = [...normalizedParticipants];
    const canSeeFullStats = (u: CloudUserDoc) =>
      u.uid === currentUser.uid || u.shareStatsWithFriends !== false;

    list.sort((a, b) => {
      if (leaderboardTab === 'today') {
        const aToday = canSeeFullStats(a)
          ? getTodayMinutesForUser(a, todayKey)
          : -1;
        const bToday = canSeeFullStats(b)
          ? getTodayMinutesForUser(b, todayKey)
          : -1;
        return bToday - aToday || b.level - a.level;
      }
      if (leaderboardTab === 'weeklyHours') {
        const aWeek = canSeeFullStats(a) ? a.weeklyMinutes : -1;
        const bWeek = canSeeFullStats(b) ? b.weeklyMinutes : -1;
        return bWeek - aWeek || b.level - a.level;
      }
      if (leaderboardTab === 'streak') {
        return b.currentStreak - a.currentStreak || b.level - a.level;
      }
      const aXp = canSeeFullStats(a) ? a.xp : -1;
      const bXp = canSeeFullStats(b) ? b.xp : -1;
      return bXp - aXp || b.level - a.level;
    });
    return list;
  }, [normalizedParticipants, leaderboardTab, currentUser.uid, todayKey]);

  const myProfileView = useMemo(
    () =>
      resolvePublicFriendProfileStats(
        currentUser,
        todayKey,
        currentWeekKey,
        true
      ),
    [currentUser, todayKey, currentWeekKey]
  );

  const selectedFriendProfileView = useMemo(() => {
    if (!selectedFriendUid) return null;
    const found = friends.find((f) => f.uid === selectedFriendUid);
    if (!found) return null;
    return resolvePublicFriendProfileStats(
      found,
      todayKey,
      currentWeekKey,
      false
    );
  }, [selectedFriendUid, friends, todayKey, currentWeekKey]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = searchQuery.trim().replace(/^@/, '');
    if (!cleaned) return;
    setIsSearching(true);
    setSearchStatusMsg(null);
    setSearchResult(null);
    try {
      const found = await onSearchUsername(cleaned);
      if (!found) {
        setSearchStatusMsg(`No student found with username "@${cleaned}".`);
      } else {
        setSearchResult(found);
      }
    } catch (err) {
      setSearchStatusMsg(
        err instanceof Error ? err.message : 'Failed to search username.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (target: CloudUserDoc) => {
    try {
      await onSendFriendRequest(target);
      setSearchStatusMsg(`Friend request sent to @${target.username}!`);
    } catch (err) {
      setSearchStatusMsg(
        err instanceof Error ? err.message : 'Could not send friend request.'
      );
    }
  };

  const isAlreadyFriend = (uid: string) =>
    friends.some((f) => f.uid === uid) ||
    friendships.some((fs) => fs.members.includes(uid));

  const hasPendingOutgoing = (uid: string) =>
    outgoingRequests.some((r) => r.toUid === uid && r.status === 'pending');

  const studyingNowCount = useMemo(
    () =>
      normalizedParticipants.filter(
        (p) =>
          (p.uid === currentUser.uid || p.shareStatsWithFriends !== false) &&
          p.studyingNow
      ).length,
    [normalizedParticipants, currentUser.uid]
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
      >
        <div>
          <div className="flex items-center gap-2">
            <Users
              className="w-5 h-5"
              style={{ color: themeConfig.accentHex }}
            />
            <h1
              className={`text-xl sm:text-2xl font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Friends & Study Leaderboards
            </h1>
          </div>
          <p
            className={`text-xs sm:text-sm mt-1 ${themeConfig.textSecondaryClass}`}
          >
            Your handle:{' '}
            <span className="font-mono font-semibold">
              @{currentUser.username}
            </span>{' '}
            · Active week:{' '}
            <span className="font-mono font-semibold">{currentWeekKey}</span>{' '}
            {isCloudConnected
              ? '(Live Cloud Sync)'
              : '(Local Workspace Preview)'}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div
            className={`px-3 py-2 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
          >
            <span className={themeConfig.textMutedClass}>Friends: </span>
            <span
              className={`font-mono font-bold ${themeConfig.textPrimaryClass}`}
            >
              {friends.length}
            </span>
          </div>
          <div
            className={`px-3 py-2 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
          >
            <span className={themeConfig.textMutedClass}>Studying Now: </span>
            <span className="font-mono font-bold text-emerald-500">
              {studyingNowCount}
            </span>
          </div>
        </div>
      </div>

      {/* Selected Friend Profile Glass Panel (opens when tapping any friend card) */}
      {selectedFriendProfileView && (
        <GlassStatsProfilePanel
          profileView={selectedFriendProfileView}
          isSelf={false}
          themeConfig={themeConfig}
          onClose={() => setSelectedFriendUid(null)}
          testId="friend-profile-panel"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Friend Cards, Search by Username & Requests (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Friend Cards */}
          <div
            className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass}`}
          >
            <div className="flex items-center justify-between mb-1">
              <h2
                className={`text-base font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                Your Study Friends ({friends.length})
              </h2>
              <span className={`text-[11px] ${themeConfig.textMutedClass}`}>
                Tap a friend card to view their profile
              </span>
            </div>
            <p className={`text-xs mb-4 ${themeConfig.textMutedClass}`}>
              Task names, subjects, and session history are never shared with
              friends—only aggregate study totals.
            </p>

            {friends.length === 0 ? (
              <p className={`text-xs ${themeConfig.textMutedClass}`}>
                No study friends added yet. Search by username below to connect!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {friends.map((friend) => {
                  const isStatsShared = friend.shareStatsWithFriends !== false;
                  const normWeek = normalizeWeeklyMinutes(
                    friend.weeklyMinutes,
                    friend.weekKey,
                    currentWeekKey
                  );
                  const todayHours = getTodayHoursForUser(friend, todayKey);
                  const isSelected = selectedFriendUid === friend.uid;

                  return (
                    <div
                      key={friend.uid}
                      data-testid={`friend-card-${friend.username}`}
                      onClick={() =>
                        setSelectedFriendUid((prev) =>
                          prev === friend.uid ? null : friend.uid
                        )
                      }
                      role="button"
                      tabIndex={0}
                      aria-expanded={isSelected}
                      aria-label={`View friend profile for ${friend.displayName}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedFriendUid((prev) =>
                            prev === friend.uid ? null : friend.uid
                          );
                        }
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'ring-2 border-sky-500/60 bg-sky-500/10'
                          : `${themeConfig.borderClass} bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10`
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm"
                            style={{ backgroundColor: themeConfig.accentHex }}
                          >
                            Lv.{friend.level}
                          </div>
                          <div className="min-w-0">
                            <div
                              className={`text-sm font-bold truncate ${themeConfig.textPrimaryClass}`}
                            >
                              {friend.displayName}
                            </div>
                            <div
                              className={`text-xs font-mono truncate ${themeConfig.textMutedClass}`}
                            >
                              @{friend.username}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onRemoveFriend(friend.uid);
                          }}
                          aria-label={`Remove friend ${friend.displayName}`}
                          title="Remove friend"
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-black/5 dark:border-white/10">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span
                            className={`flex items-center gap-1 font-mono font-semibold ${themeConfig.textSecondaryClass}`}
                          >
                            <Flame className="w-3.5 h-3.5 text-amber-500" />
                            {friend.currentStreak}d
                          </span>

                          {isStatsShared ? (
                            <>
                              <span
                                data-testid={`friend-card-today-${friend.username}`}
                                className={`font-mono font-semibold ${themeConfig.textPrimaryClass}`}
                              >
                                {todayHours.toFixed(1)}h today
                              </span>
                              <span
                                className={`font-mono ${themeConfig.textMutedClass}`}
                              >
                                {(normWeek.weeklyMinutes / 60).toFixed(1)}h wk
                              </span>
                            </>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] ${themeConfig.textMutedClass}`}
                            >
                              <Lock className="w-3 h-3" />
                              <span>Stats private</span>
                            </span>
                          )}
                        </div>

                        {isStatsShared ? (
                          friend.studyingNow ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold text-[11px]">
                              <Radio className="w-3 h-3 animate-pulse" />
                              Studying now
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] ${themeConfig.textMutedClass}`}
                            >
                              Offline / Idle
                            </span>
                          )
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search by Username */}
          <div
            className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass}`}
          >
            <h2
              className={`text-base font-bold mb-1 ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Find Classmates by Username
            </h2>
            <p className={`text-xs mb-4 ${themeConfig.textMutedClass}`}>
              Search exact handle in <span className="font-mono">usernames/</span>{' '}
              (e.g. <span className="font-mono">alex_chen</span>,{' '}
              <span className="font-mono">priya_patel</span>, or{' '}
              <span className="font-mono">sam_rivera</span>)
            </p>

            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${themeConfig.textMutedClass}`}
                />
                <input
                  type="text"
                  aria-label="Search student by username"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter username (e.g. sam_rivera)"
                  className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none ${themeConfig.glassInputClass}`}
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 disabled:opacity-50 ${themeConfig.buttonBgClass}`}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {searchStatusMsg && (
              <p
                role="status"
                className={`mt-3 text-xs font-medium ${themeConfig.textSecondaryClass}`}
              >
                {searchStatusMsg}
              </p>
            )}

            {searchResult && (
              <div
                className={`mt-4 p-4 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0"
                    style={{ backgroundColor: themeConfig.accentHex }}
                  >
                    Lv.{searchResult.level}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-bold truncate ${themeConfig.textPrimaryClass}`}
                    >
                      {searchResult.displayName}
                    </div>
                    <div
                      className={`text-xs font-mono ${themeConfig.textMutedClass}`}
                    >
                      @{searchResult.username} · {searchResult.currentStreak}d
                      streak
                    </div>
                  </div>
                </div>

                {searchResult.uid === currentUser.uid ? (
                  <span
                    className={`text-xs font-medium ${themeConfig.textMutedClass}`}
                  >
                    That&apos;s you
                  </span>
                ) : isAlreadyFriend(searchResult.uid) ? (
                  <span className="text-xs font-semibold text-emerald-500">
                    Already Friends
                  </span>
                ) : hasPendingOutgoing(searchResult.uid) ? (
                  <span
                    className={`text-xs font-medium ${themeConfig.textMutedClass}`}
                  >
                    Request Pending
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSendRequest(searchResult)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 ${themeConfig.buttonBgClass}`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Send Request</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pending Friend Requests */}
          {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
            <div
              className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass}`}
            >
              <h2
                className={`text-base font-bold mb-3 ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                Friend Requests
              </h2>

              <div className="space-y-3">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className={`p-3.5 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3`}
                  >
                    <div>
                      <div
                        className={`text-sm font-semibold ${themeConfig.textPrimaryClass}`}
                      >
                        {req.fromDisplayName || req.fromUsername || req.fromUid}
                      </div>
                      <div
                        className={`text-xs font-mono ${themeConfig.textMutedClass}`}
                      >
                        @{req.fromUsername || req.fromUid} wants to be study
                        friends
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onRespondRequest(req, 'accepted')}
                        aria-label={`Accept friend request from ${req.fromUsername || req.fromUid}`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void onRespondRequest(req, 'declined')}
                        aria-label={`Decline friend request from ${req.fromUsername || req.fromUid}`}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 ${themeConfig.borderClass} ${themeConfig.textSecondaryClass}`}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))}

                {outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className={`p-3 rounded-xl border ${themeConfig.borderClass} flex items-center justify-between text-xs`}
                  >
                    <span className={themeConfig.textSecondaryClass}>
                      Sent request to{' '}
                      <span className="font-mono font-semibold">
                        @{req.toUsername || req.toUid}
                      </span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300 font-medium">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Friends + Me Leaderboard (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div
            className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2
                className={`text-base sm:text-lg font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                Friends Leaderboard
              </h2>
            </div>
            <p className={`text-xs mb-4 ${themeConfig.textMutedClass}`}>
              Compete with your study circle (Friends + You)
            </p>

            {/* 4 Leaderboard Tabs: Today | Weekly Hours | Streak | All-time XP */}
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10 mb-4"
              role="tablist"
              aria-label="Leaderboard ranking tabs"
            >
              <button
                type="button"
                role="tab"
                data-testid="leaderboard-tab-today"
                aria-selected={leaderboardTab === 'today'}
                onClick={() => setLeaderboardTab('today')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  leaderboardTab === 'today'
                    ? themeConfig.activeTabClass
                    : themeConfig.textSecondaryClass
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Today</span>
              </button>
              <button
                type="button"
                role="tab"
                data-testid="leaderboard-tab-weekly"
                aria-selected={leaderboardTab === 'weeklyHours'}
                onClick={() => setLeaderboardTab('weeklyHours')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  leaderboardTab === 'weeklyHours'
                    ? themeConfig.activeTabClass
                    : themeConfig.textSecondaryClass
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Weekly</span>
              </button>
              <button
                type="button"
                role="tab"
                data-testid="leaderboard-tab-streak"
                aria-selected={leaderboardTab === 'streak'}
                onClick={() => setLeaderboardTab('streak')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  leaderboardTab === 'streak'
                    ? themeConfig.activeTabClass
                    : themeConfig.textSecondaryClass
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Streak</span>
              </button>
              <button
                type="button"
                role="tab"
                data-testid="leaderboard-tab-xp"
                aria-selected={leaderboardTab === 'allTimeXp'}
                onClick={() => setLeaderboardTab('allTimeXp')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  leaderboardTab === 'allTimeXp'
                    ? themeConfig.activeTabClass
                    : themeConfig.textSecondaryClass
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>All-time XP</span>
              </button>
            </div>

            {/* Leaderboard Rows */}
            <div className="space-y-2.5">
              {sortedLeaderboard.map((entry, idx) => {
                const isMe = entry.uid === currentUser.uid;
                const isStatsShared = isMe || entry.shareStatsWithFriends !== false;
                const rank = idx + 1;
                const todayHours = getTodayHoursForUser(entry, todayKey);

                let metricText = '';
                if (leaderboardTab === 'today') {
                  metricText = isStatsShared
                    ? `${todayHours.toFixed(1)} hrs`
                    : 'Private';
                } else if (leaderboardTab === 'weeklyHours') {
                  metricText = isStatsShared
                    ? `${(entry.weeklyMinutes / 60).toFixed(1)} hrs`
                    : 'Private';
                } else if (leaderboardTab === 'streak') {
                  metricText = `${entry.currentStreak} days`;
                } else {
                  metricText = isStatsShared
                    ? `${entry.xp.toLocaleString()} XP`
                    : 'Private';
                }

                return (
                  <div
                    key={entry.uid}
                    data-testid={`leaderboard-row-${rank}`}
                    onClick={() => {
                      if (!isMe) {
                        setSelectedFriendUid(entry.uid);
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      !isMe ? 'cursor-pointer hover:opacity-90' : ''
                    } ${
                      isMe
                        ? 'border-sky-500/50 bg-sky-500/10'
                        : `${themeConfig.borderClass} bg-black/5 dark:bg-white/5`
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                          rank === 1
                            ? 'bg-amber-500 text-white'
                            : rank === 2
                              ? 'bg-slate-400 text-white'
                              : rank === 3
                                ? 'bg-amber-700 text-white'
                                : 'bg-black/10 dark:bg-white/10'
                        }`}
                      >
                        #{rank}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs sm:text-sm font-bold truncate ${themeConfig.textPrimaryClass}`}
                          >
                            {entry.displayName}
                            {isMe ? ' (You)' : ''}
                          </span>
                          <span
                            className={`text-[11px] font-mono px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 ${themeConfig.textSecondaryClass}`}
                          >
                            Lv.{entry.level}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[11px] font-mono ${themeConfig.textMutedClass}`}
                          >
                            @{entry.username}
                          </span>
                          {isStatsShared && (
                            <span
                              className={`text-[10px] font-mono ${themeConfig.textSecondaryClass}`}
                            >
                              · {todayHours.toFixed(1)}h today
                            </span>
                          )}
                          {isStatsShared && entry.studyingNow && (
                            <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1">
                              ● Studying now
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`text-sm font-mono font-bold tabular-nums shrink-0 ${themeConfig.textPrimaryClass}`}
                    >
                      {metricText}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Requirement 5: Show the user's own full stats in the same glass panel layout for consistency */}
      <GlassStatsProfilePanel
        profileView={myProfileView}
        isSelf={true}
        themeConfig={themeConfig}
        testId="my-stats-profile-panel"
      />
    </div>
  );
}
