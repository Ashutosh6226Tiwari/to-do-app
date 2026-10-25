import React, { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Flame,
  Radio,
  Search,
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
import { getIsoWeekKey, normalizeWeeklyMinutes } from '../utils/focusLogic';

interface FriendsViewProps {
  currentUser: CloudUserDoc;
  friends: CloudUserDoc[];
  friendships: FriendshipItem[];
  incomingRequests: FriendRequestItem[];
  outgoingRequests: FriendRequestItem[];
  themeConfig: MoodThemeConfig;
  isCloudConnected: boolean;
  onSearchUsername: (username: string) => Promise<CloudUserDoc | null>;
  onSendFriendRequest: (targetUser: CloudUserDoc) => Promise<void>;
  onRespondRequest: (
    request: FriendRequestItem,
    decision: 'accepted' | 'declined'
  ) => Promise<void>;
  onRemoveFriend: (friendUid: string) => Promise<void>;
}

export function FriendsView({
  currentUser,
  friends,
  friendships,
  incomingRequests,
  outgoingRequests,
  themeConfig,
  isCloudConnected,
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
    useState<LeaderboardTab>('weeklyHours');

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

  const sortedLeaderboard = useMemo(() => {
    const list = [...normalizedParticipants];
    list.sort((a, b) => {
      if (leaderboardTab === 'weeklyHours') {
        return b.weeklyMinutes - a.weeklyMinutes || b.xp - a.xp;
      }
      if (leaderboardTab === 'streak') {
        return b.currentStreak - a.currentStreak || b.xp - a.xp;
      }
      return b.xp - a.xp;
    });
    return list;
  }, [normalizedParticipants, leaderboardTab]);

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
          <p className={`text-xs sm:text-sm mt-1 ${themeConfig.textSecondaryClass}`}>
            Your handle:{' '}
            <span className="font-mono font-semibold">
              @{currentUser.username}
            </span>{' '}
            · Active week:{' '}
            <span className="font-mono font-semibold">{currentWeekKey}</span>{' '}
            {isCloudConnected ? '(Live Cloud Sync)' : '(Local Workspace Preview)'}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div
            className={`px-3 py-2 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
          >
            <span className={themeConfig.textMutedClass}>Friends: </span>
            <span className={`font-mono font-bold ${themeConfig.textPrimaryClass}`}>
              {friends.length}
            </span>
          </div>
          <div
            className={`px-3 py-2 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5`}
          >
            <span className={themeConfig.textMutedClass}>Studying Now: </span>
            <span className="font-mono font-bold text-emerald-500">
              {normalizedParticipants.filter((p) => p.studyingNow).length}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search by Username, Requests & Friend Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Search by Username */}
          <div className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
            <h2
              className={`text-base font-bold mb-1 ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Find Classmates by Username
            </h2>
            <p className={`text-xs mb-4 ${themeConfig.textMutedClass}`}>
              Search exact handle in <span className="font-mono">usernames/</span> (e.g.{' '}
              <span className="font-mono">alex_chen</span>,{' '}
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
                  <span className={`text-xs font-medium ${themeConfig.textMutedClass}`}>
                    That&apos;s you
                  </span>
                ) : isAlreadyFriend(searchResult.uid) ? (
                  <span className="text-xs font-semibold text-emerald-500">
                    Already Friends
                  </span>
                ) : hasPendingOutgoing(searchResult.uid) ? (
                  <span className={`text-xs font-medium ${themeConfig.textMutedClass}`}>
                    Request Pending
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendRequest(searchResult)}
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
            <div className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
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
                        onClick={() => onRespondRequest(req, 'accepted')}
                        aria-label={`Accept friend request from ${req.fromUsername || req.fromUid}`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRespondRequest(req, 'declined')}
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
                    <span
                      className={`px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300 font-medium`}
                    >
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friend Cards */}
          <div className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
            <div className="flex items-center justify-between mb-4">
              <h2
                className={`text-base font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                Your Study Friends ({friends.length})
              </h2>
            </div>

            {friends.length === 0 ? (
              <p className={`text-xs ${themeConfig.textMutedClass}`}>
                No study friends added yet. Search by username above to connect!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {friends.map((friend) => {
                  const normWeek = normalizeWeeklyMinutes(
                    friend.weeklyMinutes,
                    friend.weekKey,
                    currentWeekKey
                  );
                  return (
                    <div
                      key={friend.uid}
                      data-testid={`friend-card-${friend.username}`}
                      className={`p-4 rounded-2xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 flex flex-col justify-between gap-3`}
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
                          onClick={() => onRemoveFriend(friend.uid)}
                          aria-label={`Remove friend ${friend.displayName}`}
                          title="Remove friend"
                          className={`p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors`}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-black/5 dark:border-white/10">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex items-center gap-1 font-mono font-semibold ${themeConfig.textSecondaryClass}`}
                          >
                            <Flame className="w-3.5 h-3.5 text-amber-500" />
                            {friend.currentStreak}d
                          </span>
                          <span
                            className={`font-mono ${themeConfig.textMutedClass}`}
                          >
                            {(normWeek.weeklyMinutes / 60).toFixed(1)}h wk
                          </span>
                        </div>

                        {friend.studyingNow ? (
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
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Friends + Me Leaderboard (5 cols) */}
        <div className="lg:col-span-5">
          <div className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
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

            {/* 3 Leaderboard Tabs */}
            <div
              className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10 mb-4"
              role="tablist"
              aria-label="Leaderboard ranking tabs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={leaderboardTab === 'weeklyHours'}
                onClick={() => setLeaderboardTab('weeklyHours')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  leaderboardTab === 'weeklyHours'
                    ? themeConfig.activeTabClass
                    : themeConfig.textSecondaryClass
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Weekly Hours</span>
              </button>
              <button
                type="button"
                role="tab"
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
                const rank = idx + 1;
                const metricText =
                  leaderboardTab === 'weeklyHours'
                    ? `${(entry.weeklyMinutes / 60).toFixed(1)} hrs`
                    : leaderboardTab === 'streak'
                      ? `${entry.currentStreak} days`
                      : `${entry.xp.toLocaleString()} XP`;

                return (
                  <div
                    key={entry.uid}
                    data-testid={`leaderboard-row-${rank}`}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
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
                          {entry.studyingNow && (
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
    </div>
  );
}
