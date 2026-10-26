import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  DoorOpen,
  LogOut,
  Pause,
  Play,
  PlusCircle,
  Radio,
  RotateCcw,
  Sliders,
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
  clampRoomCustomMinutes,
  computeSharedRoomRemainingSeconds,
  formatTimeMMSS,
} from '../utils/focusLogic';

interface StudyRoomsViewProps {
  currentUser: CloudUserDoc;
  activeRoom: StudyRoomDoc | null;
  roomMembers: RoomMemberItem[];
  themeConfig: MoodThemeConfig;
  onCreateRoom: (
    durationMinutes: number,
    roomDurations?: {
      focusMinutes: number;
      shortBreakMinutes: number;
      longBreakMinutes: number;
    }
  ) => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onHostUpdateTimer: (patch: {
    mode?: TimerMode;
    startedAt?: number | null;
    durationSec?: number;
    focusMinutes?: number;
    shortBreakMinutes?: number;
    longBreakMinutes?: number;
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

const ROOM_DURATION_PRESETS = [
  { label: '25 / 5 / 15', focus: 25, shortBreak: 5, longBreak: 15 },
  { label: '50 / 10 / 30', focus: 50, shortBreak: 10, longBreak: 30 },
] as const;

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
  const [createFocusMins, setCreateFocusMins] = useState(25);
  const [createShortBreakMins, setCreateShortBreakMins] = useState(5);
  const [createLongBreakMins, setCreateLongBreakMins] = useState(15);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Host adjustable timer state synced with activeRoom
  const roomFocusMins = clampRoomCustomMinutes(
    activeRoom?.focusMinutes ??
      (activeRoom?.mode === 'focus'
        ? Math.round((activeRoom?.durationSec || 1500) / 60)
        : 25)
  );
  const roomShortBreakMins = clampRoomCustomMinutes(
    activeRoom?.shortBreakMinutes ??
      (activeRoom?.mode === 'shortBreak'
        ? Math.round((activeRoom?.durationSec || 300) / 60)
        : 5)
  );
  const roomLongBreakMins = clampRoomCustomMinutes(
    activeRoom?.longBreakMinutes ??
      (activeRoom?.mode === 'longBreak'
        ? Math.round((activeRoom?.durationSec || 900) / 60)
        : 15)
  );

  const [hostFocusInput, setHostFocusInput] = useState<number>(roomFocusMins);
  const [hostShortInput, setHostShortInput] =
    useState<number>(roomShortBreakMins);
  const [hostLongInput, setHostLongInput] = useState<number>(roomLongBreakMins);

  useEffect(() => {
    setHostFocusInput(roomFocusMins);
    setHostShortInput(roomShortBreakMins);
    setHostLongInput(roomLongBreakMins);
  }, [roomFocusMins, roomShortBreakMins, roomLongBreakMins]);

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
      const focusMinutes = clampRoomCustomMinutes(createFocusMins);
      const shortBreakMinutes = clampRoomCustomMinutes(createShortBreakMins);
      const longBreakMinutes = clampRoomCustomMinutes(createLongBreakMins);
      await onCreateRoom(focusMinutes, {
        focusMinutes,
        shortBreakMinutes,
        longBreakMinutes,
      });
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
          <div
            className={`p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-col justify-between`}
          >
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
                Set your room&apos;s Focus, Short Break, and Long Break durations
                (presets 25/5/15, 50/10/30, or custom 1–180 minutes) and generate
                an instant 6-character code.
              </p>

              {/* Presets before creating room */}
              <div className="mb-3">
                <span
                  className={`block text-xs font-semibold mb-1.5 ${themeConfig.textSecondaryClass}`}
                >
                  Timer Presets (Focus / Short / Long)
                </span>
                <div className="flex flex-wrap gap-2">
                  {ROOM_DURATION_PRESETS.map((preset) => {
                    const isSelected =
                      createFocusMins === preset.focus &&
                      createShortBreakMins === preset.shortBreak &&
                      createLongBreakMins === preset.longBreak;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setCreateFocusMins(preset.focus);
                          setCreateShortBreakMins(preset.shortBreak);
                          setCreateLongBreakMins(preset.longBreak);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all ${
                          isSelected
                            ? themeConfig.activeTabClass
                            : `${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom 1-180 min inputs before creating room */}
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                <div>
                  <label
                    htmlFor="create-room-focus-mins"
                    className={`block text-[11px] font-semibold mb-1 ${themeConfig.textPrimaryClass}`}
                  >
                    Focus (1–180m)
                  </label>
                  <input
                    id="create-room-focus-mins"
                    type="number"
                    min={1}
                    max={180}
                    value={createFocusMins}
                    onChange={(e) =>
                      setCreateFocusMins(
                        clampRoomCustomMinutes(Number(e.target.value))
                      )
                    }
                    className={`w-full px-2.5 py-2 rounded-xl text-xs font-mono outline-none ${themeConfig.glassInputClass}`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="create-room-short-mins"
                    className={`block text-[11px] font-semibold mb-1 ${themeConfig.textPrimaryClass}`}
                  >
                    Short Break (m)
                  </label>
                  <input
                    id="create-room-short-mins"
                    type="number"
                    min={1}
                    max={180}
                    value={createShortBreakMins}
                    onChange={(e) =>
                      setCreateShortBreakMins(
                        clampRoomCustomMinutes(Number(e.target.value))
                      )
                    }
                    className={`w-full px-2.5 py-2 rounded-xl text-xs font-mono outline-none ${themeConfig.glassInputClass}`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="create-room-long-mins"
                    className={`block text-[11px] font-semibold mb-1 ${themeConfig.textPrimaryClass}`}
                  >
                    Long Break (m)
                  </label>
                  <input
                    id="create-room-long-mins"
                    type="number"
                    min={1}
                    max={180}
                    value={createLongBreakMins}
                    onChange={(e) =>
                      setCreateLongBreakMins(
                        clampRoomCustomMinutes(Number(e.target.value))
                      )
                    }
                    className={`w-full px-2.5 py-2 rounded-xl text-xs font-mono outline-none ${themeConfig.glassInputClass}`}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={isBusy}
              className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 ${themeConfig.buttonBgClass}`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {isBusy ? 'Creating Room...' : 'Create 6-Char Study Room'}
              </span>
            </button>
          </div>

          {/* Join Room by Code Card */}
          <div
            className={`p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-col justify-between`}
          >
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
                Enter a classmate&apos;s 6-character room code to sync your
                countdown in real time and earn shared session XP.
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
  const isTimerRunning = activeRoom.status === 'running';
  const myMemberDoc = roomMembers.find((m) => m.uid === currentUser.uid);

  const getDurationSecForMode = (
    mode: TimerMode,
    fMins = hostFocusInput,
    sMins = hostShortInput,
    lMins = hostLongInput
  ) => {
    const mins =
      mode === 'focus'
        ? clampRoomCustomMinutes(fMins)
        : mode === 'shortBreak'
          ? clampRoomCustomMinutes(sMins)
          : clampRoomCustomMinutes(lMins);
    return mins * 60;
  };

  const handleHostApplyDurations = async (
    nextFocus: number,
    nextShort: number,
    nextLong: number,
    targetMode: TimerMode = activeRoom.mode
  ) => {
    if (!isHost || isTimerRunning) return;
    const f = clampRoomCustomMinutes(nextFocus);
    const s = clampRoomCustomMinutes(nextShort);
    const l = clampRoomCustomMinutes(nextLong);
    setHostFocusInput(f);
    setHostShortInput(s);
    setHostLongInput(l);
    const durationSec = getDurationSecForMode(targetMode, f, s, l);
    await onHostUpdateTimer({
      mode: targetMode,
      startedAt: null,
      durationSec,
      focusMinutes: f,
      shortBreakMinutes: s,
      longBreakMinutes: l,
      status: 'idle',
    });
  };

  const handleHostStart = async () => {
    const nowMs = Date.now();
    await onHostUpdateTimer({
      startedAt: nowMs,
      durationSec: activeRoom.durationSec,
      focusMinutes: clampRoomCustomMinutes(hostFocusInput),
      shortBreakMinutes: clampRoomCustomMinutes(hostShortInput),
      longBreakMinutes: clampRoomCustomMinutes(hostLongInput),
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
      focusMinutes: clampRoomCustomMinutes(hostFocusInput),
      shortBreakMinutes: clampRoomCustomMinutes(hostShortInput),
      longBreakMinutes: clampRoomCustomMinutes(hostLongInput),
      status: 'paused',
    });
    await onUpdateMyMemberStatus('idle');
  };

  const handleHostReset = async (mode: TimerMode = activeRoom.mode) => {
    if (isTimerRunning && mode !== activeRoom.mode) return;
    const durationSec = getDurationSecForMode(mode);
    await onHostUpdateTimer({
      mode,
      startedAt: null,
      durationSec,
      focusMinutes: clampRoomCustomMinutes(hostFocusInput),
      shortBreakMinutes: clampRoomCustomMinutes(hostShortInput),
      longBreakMinutes: clampRoomCustomMinutes(hostLongInput),
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

  const currentConfiguredMinutes = Math.max(
    1,
    Math.round(activeRoom.durationSec / 60)
  );

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
          {/* Mode Tabs (Host can switch only when timer is not running) */}
          <div className="inline-flex p-1 rounded-2xl bg-black/5 dark:bg-white/10 mb-5">
            {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
              <button
                key={m}
                type="button"
                disabled={!isHost || isTimerRunning}
                onClick={() => handleHostReset(m)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeRoom.mode === m
                    ? themeConfig.activeTabClass
                    : themeConfig.textSecondaryClass
                } disabled:cursor-default disabled:opacity-60`}
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

          {/* Read-only duration badge visible to all room members */}
          <div
            data-testid="room-readonly-durations"
            className={`inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 text-xs font-mono mb-5 ${themeConfig.textSecondaryClass}`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              Room Durations: Focus {roomFocusMins}m · Short Break{' '}
              {roomShortBreakMins}m · Long Break {roomLongBreakMins}m (Active:{' '}
              {currentConfiguredMinutes}m)
            </span>
          </div>

          {/* Host-Only Adjustable Timer Controls (Presets 25/5/15, 50/10/30 + Custom 1-180m) */}
          {isHost && (
            <div
              data-testid="host-room-timer-controls"
              className={`w-full max-w-lg p-4 rounded-2xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 mb-6 text-left`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <Sliders
                    className="w-3.5 h-3.5"
                    style={{ color: themeConfig.accentHex }}
                  />
                  <span
                    className={`text-xs font-bold ${themeConfig.textPrimaryClass}`}
                  >
                    Host Timer Settings (1–180 min)
                  </span>
                </div>

                {/* Preset Buttons: 25/5/15 & 50/10/30 */}
                <div className="flex items-center gap-1.5">
                  {ROOM_DURATION_PRESETS.map((preset) => {
                    const isSelected =
                      hostFocusInput === preset.focus &&
                      hostShortInput === preset.shortBreak &&
                      hostLongInput === preset.longBreak;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={isTimerRunning}
                        onClick={() =>
                          void handleHostApplyDurations(
                            preset.focus,
                            preset.shortBreak,
                            preset.longBreak
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSelected
                            ? themeConfig.activeTabClass
                            : `${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="room-host-focus-minutes"
                    className={`block text-[11px] font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
                  >
                    Focus (min)
                  </label>
                  <input
                    id="room-host-focus-minutes"
                    type="number"
                    min={1}
                    max={180}
                    disabled={isTimerRunning}
                    value={hostFocusInput}
                    onChange={(e) => {
                      const val = clampRoomCustomMinutes(
                        Number(e.target.value)
                      );
                      void handleHostApplyDurations(
                        val,
                        hostShortInput,
                        hostLongInput
                      );
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-mono tabular-nums outline-none disabled:opacity-50 disabled:cursor-not-allowed ${themeConfig.glassInputClass}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="room-host-short-minutes"
                    className={`block text-[11px] font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
                  >
                    Short Break (min)
                  </label>
                  <input
                    id="room-host-short-minutes"
                    type="number"
                    min={1}
                    max={180}
                    disabled={isTimerRunning}
                    value={hostShortInput}
                    onChange={(e) => {
                      const val = clampRoomCustomMinutes(
                        Number(e.target.value)
                      );
                      void handleHostApplyDurations(
                        hostFocusInput,
                        val,
                        hostLongInput
                      );
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-mono tabular-nums outline-none disabled:opacity-50 disabled:cursor-not-allowed ${themeConfig.glassInputClass}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="room-host-long-minutes"
                    className={`block text-[11px] font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
                  >
                    Long Break (min)
                  </label>
                  <input
                    id="room-host-long-minutes"
                    type="number"
                    min={1}
                    max={180}
                    disabled={isTimerRunning}
                    value={hostLongInput}
                    onChange={(e) => {
                      const val = clampRoomCustomMinutes(
                        Number(e.target.value)
                      );
                      void handleHostApplyDurations(
                        hostFocusInput,
                        hostShortInput,
                        val
                      );
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-mono tabular-nums outline-none disabled:opacity-50 disabled:cursor-not-allowed ${themeConfig.glassInputClass}`}
                  />
                </div>
              </div>

              {isTimerRunning && (
                <p
                  className={`text-[11px] mt-2 ${themeConfig.textMutedClass}`}
                >
                  Timer durations are locked while a session is running. Pause or
                  reset to adjust durations.
                </p>
              )}
            </div>
          )}

          <p className={`text-xs mb-6 ${themeConfig.textSecondaryClass}`}>
            {isHost
              ? 'You are the room host. Starting the timer broadcasts startedAt and durationSec to all members.'
              : 'Synced to host timer via real-time Firestore snapshot (read-only).'}
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
              Read-only member view · Waiting for host to control shared timer...
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

