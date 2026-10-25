import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Crown,
  DoorOpen,
  LogOut,
  Pause,
  Play,
  PlusCircle,
  Radio,
  RotateCcw,
  Users,
} from 'lucide-react';
import {
  CloudUserDoc,
  MoodThemeConfig,
  RoomMemberItem,
  StudyRoomDoc,
  TimerMode,
} from '../types';
import {
  computeSharedRoomRemainingSeconds,
  formatTimeMMSS,
} from '../utils/focusLogic';

interface StudyRoomsViewProps {
  currentUser: CloudUserDoc;
  activeRoom: StudyRoomDoc | null;
  roomMembers: RoomMemberItem[];
  themeConfig: MoodThemeConfig;
  onCreateRoom: (durationMinutes: number) => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onHostUpdateTimer: (patch: {
    mode?: TimerMode;
    startedAt?: number | null;
    durationSec?: number;
    status?: 'idle' | 'running' | 'paused' | 'completed';
  }) => Promise<void>;
  onUpdateMyMemberStatus: (status: 'focusing' | 'break' | 'idle') => Promise<void>;
  onCompleteRoomSessionAwardXp: (
    roomCode: string,
    startedAtMs: number,
    durationMinutes: number,
    mode: TimerMode
  ) => void;
}

const ROOM_MODE_LABELS: Record<TimerMode, string> = {
  focus: 'Focus Session',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

export function StudyRoomsView({
  currentUser,
  activeRoom,
  roomMembers,
  themeConfig,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onHostUpdateTimer,
  onUpdateMyMemberStatus,
  onCompleteRoomSessionAwardXp,
}: StudyRoomsViewProps) {
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [customDurationMins, setCustomDurationMins] = useState(25);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    activeRoom
      ? computeSharedRoomRemainingSeconds(
          activeRoom.startedAt,
          activeRoom.durationSec,
          activeRoom.status,
          Date.now()
        )
      : 25 * 60
  );

  // Every client computes remaining time from startedAt using the same timestamp method as the main timer
  useEffect(() => {
    if (!activeRoom) return;

    const tick = () => {
      const nowMs = Date.now();
      const rem = computeSharedRoomRemainingSeconds(
        activeRoom.startedAt,
        activeRoom.durationSec,
        activeRoom.status,
        nowMs
      );
      setRemainingSeconds(rem);

      if (
        activeRoom.status === 'running' &&
        activeRoom.startedAt &&
        rem <= 0
      ) {
        const durationMins = Math.max(
          1,
          Math.round(activeRoom.durationSec / 60)
        );
        onCompleteRoomSessionAwardXp(
          activeRoom.code,
          activeRoom.startedAt,
          durationMins,
          activeRoom.mode
        );
      }
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [activeRoom, onCompleteRoomSessionAwardXp]);

  const handleCreate = async () => {
    setRoomError(null);
    setIsBusy(true);
    try {
      await onCreateRoom(customDurationMins);
    } catch (err) {
      setRoomError(
        err instanceof Error ? err.message : 'Could not create room.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCodeInput.trim().toUpperCase();
    if (cleaned.length !== 6) {
      setRoomError('Please enter a valid 6-character room code.');
      return;
    }
    setRoomError(null);
    setIsBusy(true);
    try {
      await onJoinRoom(cleaned);
      setJoinCodeInput('');
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Could not join room.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyCode = () => {
    if (!activeRoom) return;
    navigator.clipboard?.writeText(activeRoom.code).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  if (!activeRoom) {
    return (
      <div className="space-y-6">
        <div className={`p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
          <div className="flex items-center gap-2.5 mb-1">
            <Users
              className="w-5 h-5"
              style={{ color: themeConfig.accentHex }}
            />
            <h1
              className={`text-xl sm:text-2xl font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Collaborative Study Rooms
            </h1>
          </div>
          <p className={`text-xs sm:text-sm ${themeConfig.textSecondaryClass}`}>
            Create a room with a 6-character code or join classmates (up to 10
            members). Everyone syncs to the host&apos;s shared timer and earns XP
            when a session finishes!
          </p>
        </div>

        {roomError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300"
          >
            {roomError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Room Card */}
          <div className={`p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-col justify-between`}>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <PlusCircle
                  className="w-5 h-5"
                  style={{ color: themeConfig.accentHex }}
                />
                <h2
                  className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
                  style={{ fontFamily: themeConfig.fontDisplay }}
                >
                  Create a Study Room
                </h2>
              </div>
              <p className={`text-xs mb-4 ${themeConfig.textSecondaryClass}`}>
                Become the room host, generate an instant 6-character invite code,
                and control the shared Pomodoro timer for up to 10 students.
              </p>

              <div className="mb-4">
                <label
                  htmlFor="create-room-duration"
                  className={`block text-xs font-semibold mb-1.5 ${themeConfig.textPrimaryClass}`}
                >
                  Default Focus Duration (minutes)
                </label>
                <input
                  id="create-room-duration"
                  type="number"
                  min={5}
                  max={90}
                  value={customDurationMins}
                  onChange={(e) =>
                    setCustomDurationMins(
                      Math.max(5, Math.min(90, Number(e.target.value) || 25))
                    )
                  }
                  className={`w-32 px-3 py-2 rounded-xl text-sm font-mono outline-none ${themeConfig.glassInputClass}`}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={isBusy}
              className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 ${themeConfig.buttonBgClass}`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isBusy ? 'Creating Room...' : 'Create 6-Char Study Room'}</span>
            </button>
          </div>

          {/* Join Room by Code Card */}
          <div className={`p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-col justify-between`}>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DoorOpen
                  className="w-5 h-5"
                  style={{ color: themeConfig.accentHex }}
                />
                <h2
                  className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
                  style={{ fontFamily: themeConfig.fontDisplay }}
                >
                  Join by 6-Character Code
                </h2>
              </div>
              <p className={`text-xs mb-4 ${themeConfig.textSecondaryClass}`}>
                Enter a classmate&apos;s 6-character room code to sync your countdown
                in real time and earn shared session XP.
              </p>

              <form id="join-room-form" onSubmit={handleJoin} className="mb-4">
                <label
                  htmlFor="join-room-code-input"
                  className={`block text-xs font-semibold mb-1.5 ${themeConfig.textPrimaryClass}`}
                >
                  Room Code (6 characters)
                </label>
                <input
                  id="join-room-code-input"
                  type="text"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(e.target.value.toUpperCase())
                  }
                  placeholder="e.g. FLOW42"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono uppercase tracking-widest outline-none ${themeConfig.glassInputClass}`}
                />
              </form>
            </div>

            <button
              type="submit"
              form="join-room-form"
              disabled={isBusy || joinCodeInput.trim().length !== 6}
              className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${themeConfig.buttonBgClass}`}
            >
              <DoorOpen className="w-4 h-4" />
              <span>Join Study Room</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isHost = activeRoom.hostUid === currentUser.uid;
  const myMemberDoc = roomMembers.find((m) => m.uid === currentUser.uid);

  const handleHostStart = async () => {
    const nowMs = Date.now();
    await onHostUpdateTimer({
      startedAt: nowMs,
      durationSec: activeRoom.durationSec,
      status: 'running',
    });
    await onUpdateMyMemberStatus(
      activeRoom.mode === 'focus' ? 'focusing' : 'break'
    );
  };

  const handleHostPause = async () => {
    await onHostUpdateTimer({
      startedAt: null,
      durationSec: Math.max(10, remainingSeconds),
      status: 'paused',
    });
    await onUpdateMyMemberStatus('idle');
  };

  const handleHostReset = async (mode: TimerMode = activeRoom.mode) => {
    const defaultSec =
      mode === 'focus' ? 25 * 60 : mode === 'shortBreak' ? 5 * 60 : 15 * 60;
    await onHostUpdateTimer({
      mode,
      startedAt: null,
      durationSec: defaultSec,
      status: 'idle',
    });
    await onUpdateMyMemberStatus('idle');
  };

  const handleHostCompleteNow = () => {
    const syntheticStartedAt =
      activeRoom.startedAt || Date.now() - activeRoom.durationSec * 1000 - 1000;
    const durationMins = Math.max(1, Math.round(activeRoom.durationSec / 60));
    onCompleteRoomSessionAwardXp(
      activeRoom.code,
      syntheticStartedAt,
      durationMins,
      activeRoom.mode
    );
    void onHostUpdateTimer({
      startedAt: null,
      status: 'completed',
    });
  };

  return (
    <div className="space-y-6">
      {/* Room Top Bar */}
      <div
        className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-wrap items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-3">
          <div
            className="px-3.5 py-2 rounded-xl font-mono text-base sm:text-lg font-bold text-white tracking-widest shadow-sm"
            style={{ backgroundColor: themeConfig.accentHex }}
            data-testid="active-room-code"
          >
            {activeRoom.code}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                Study Room #{activeRoom.code}
              </h1>
              {isHost && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300 text-xs font-semibold">
                  <Crown className="w-3.5 h-3.5" />
                  Host
                </span>
              )}
            </div>
            <p className={`text-xs ${themeConfig.textSecondaryClass}`}>
              {roomMembers.length} / {activeRoom.maxMembers} members · Shared
              timestamp countdown
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyCode}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave Room</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Shared Room Timer (7 cols) */}
        <div
          className={`lg:col-span-7 p-6 sm:p-8 rounded-2xl ${themeConfig.glassCardClass} flex flex-col items-center justify-center text-center`}
        >
          {/* Mode Tabs (Host can switch) */}
          <div className="inline-flex p-1 rounded-2xl bg-black/5 dark:bg-white/10 mb-6">
            {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
              <button
                key={m}
                type="button"
                disabled={!isHost}
                onClick={() => handleHostReset(m)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeRoom.mode === m
                    ? themeConfig.activeTabClass
                    : themeConfig.textSecondaryClass
                } disabled:cursor-default`}
              >
                {ROOM_MODE_LABELS[m]}
              </button>
            ))}
          </div>

          <div
            className={`text-xs uppercase tracking-widest font-semibold mb-1 ${themeConfig.textMutedClass}`}
          >
            {ROOM_MODE_LABELS[activeRoom.mode]} · {activeRoom.status.toUpperCase()}
          </div>

          <div
            data-testid="room-shared-countdown"
            className={`text-5xl sm:text-6xl font-bold font-mono tabular-nums my-3 ${themeConfig.textPrimaryClass}`}
          >
            {formatTimeMMSS(remainingSeconds)}
          </div>

          <p className={`text-xs mb-6 ${themeConfig.textSecondaryClass}`}>
            {isHost
              ? 'You are the room host. Starting the timer broadcasts startedAt and durationSec to all members.'
              : 'Synced to host timer via real-time Firestore snapshot.'}
          </p>

          {isHost ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {activeRoom.status !== 'running' ? (
                <button
                  type="button"
                  onClick={handleHostStart}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md ${themeConfig.buttonBgClass}`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Shared Timer</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleHostPause}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md ${themeConfig.buttonBgClass}`}
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause Shared Timer</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleHostReset(activeRoom.mode)}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border flex items-center gap-1.5 ${themeConfig.borderClass} ${themeConfig.textSecondaryClass}`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={handleHostCompleteNow}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border flex items-center gap-1.5 ${themeConfig.borderClass} text-emerald-600 dark:text-emerald-400`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Room Session</span>
              </button>
            </div>
          ) : (
            <div className="text-xs font-medium px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10">
              Waiting for host to control shared timer...
            </div>
          )}
        </div>

        {/* Live Room Members List (5 cols) */}
        <div
          className={`lg:col-span-5 p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-col justify-between`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2
                className={`text-base font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                Room Members ({roomMembers.length}/10)
              </h2>

              {/* My Status Selector */}
              <div className="flex items-center gap-1">
                {(['focusing', 'break', 'idle'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onUpdateMyMemberStatus(st)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                      myMemberDoc?.status === st
                        ? themeConfig.activeTabClass
                        : `${themeConfig.textMutedClass} hover:opacity-80`
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {roomMembers.map((member) => {
                const isRoomHost = member.uid === activeRoom.hostUid;
                return (
                  <div
                    key={member.uid}
                    data-testid={`room-member-${member.uid}`}
                    className={`p-3 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0"
                        style={{ backgroundColor: themeConfig.accentHex }}
                      >
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs sm:text-sm font-semibold truncate ${themeConfig.textPrimaryClass}`}
                          >
                            {member.name}
                          </span>
                          {isRoomHost && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${
                        member.status === 'focusing'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                          : member.status === 'break'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                            : 'bg-black/10 dark:bg-white/10 text-slate-500'
                      }`}
                    >
                      <Radio className="w-3 h-3" />
                      {member.status}
                    </span>
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
