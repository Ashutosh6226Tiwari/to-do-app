import React, { useState } from 'react';
import {
  CheckCircle2,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  CloudAudioTrack,
  MoodThemeConfig,
  MoodThemeId,
  PersistedTimerState,
  StudyTask,
  TimerMode,
  TimerSettings,
} from '../types';
import {
  MoodSuggestionResponse,
  suggestMoodThemeWithGemini,
} from '../utils/geminiClient';
import { MOOD_THEMES } from '../utils/themes';
import {
  formatTimeMMSS,
  getModeDurationMs,
} from '../utils/focusLogic';
import { SoundMixerPanel } from './SoundMixerPanel';

interface FocusViewProps {
  tasks: StudyTask[];
  timerState: PersistedTimerState;
  remainingSeconds: number;
  timerSettings: TimerSettings;
  isGuest?: boolean;
  onRequestSignIn?: () => void;
  onStartPause: () => void;
  onReset: () => void;
  onSkip: () => void;
  onCompleteSessionNow: () => void;
  onSwitchMode: (nextMode: TimerMode) => void;
  onSelectTaskId: (taskId: string | null) => void;
  onUpdateTimerSettings: (next: TimerSettings) => void;
  themeConfig: MoodThemeConfig;
  onSelectTheme: (theme: MoodThemeId) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  lastCompletedToast: string | null;
  onDismissToast: () => void;
  customTracks?: CloudAudioTrack[];
}

const MODE_LABELS: Record<TimerMode, string> = {
  focus: 'Focus Session',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

export function FocusView({
  tasks,
  timerState,
  remainingSeconds,
  timerSettings,
  isGuest = false,
  onRequestSignIn,
  onStartPause,
  onReset,
  onSkip,
  onCompleteSessionNow,
  onSwitchMode,
  onSelectTaskId,
  onUpdateTimerSettings,
  themeConfig,
  onSelectTheme,
  onToggleSubtask,
  lastCompletedToast,
  onDismissToast,
  customTracks = [],
}: FocusViewProps) {
  const { mode, isRunning, completedFocusCycleCount, selectedTaskId } =
    timerState;

  // Mood-based theme suggestion state
  const [feelingInput, setFeelingInput] = useState<string>('');
  const [isSuggestingMood, setIsSuggestingMood] = useState<boolean>(false);
  const [moodSuggestion, setMoodSuggestion] =
    useState<MoodSuggestionResponse | null>(null);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;
  const totalSeconds = Math.ceil(
    getModeDurationMs(mode, timerSettings) / 1000
  );

  const handleAskMoodSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feelingInput.trim()) return;
    setIsSuggestingMood(true);
    try {
      const suggestion = await suggestMoodThemeWithGemini(feelingInput.trim());
      setMoodSuggestion(suggestion);
    } finally {
      setIsSuggestingMood(false);
    }
  };

  const handleApplyMoodSuggestion = () => {
    if (!moodSuggestion) return;
    onSelectTheme(moodSuggestion.theme);
    const updatedSettings: TimerSettings = {
      ...timerSettings,
      focusMinutes: moodSuggestion.focusMinutes,
      shortBreakMinutes: moodSuggestion.shortBreakMinutes,
    };
    onUpdateTimerSettings(updatedSettings);
  };

  // Circular SVG Ring Geometry
  const radius = 126;
  const circumference = 2 * Math.PI * radius;
  const progressFraction =
    totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const strokeDashoffset =
    circumference - Math.min(1, Math.max(0, progressFraction)) * circumference;

  const incompleteTasks = tasks.filter((t) => !t.completed);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left/Center Column: Circular Pomodoro Timer & Controls (7 cols) */}
      <div
        className={`lg:col-span-7 p-6 sm:p-8 rounded-2xl ${themeConfig.glassCardClass} flex flex-col items-center text-center`}
      >
        {/* Mode Switcher Tabs */}
        <div
          className="flex items-center gap-1.5 p-1.5 rounded-xl bg-black/5 dark:bg-white/10 mb-6"
          role="group"
          aria-label="Pomodoro timer modes"
        >
          {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSwitchMode(m)}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                mode === m
                  ? themeConfig.activeTabClass
                  : `${themeConfig.textSecondaryClass} hover:opacity-80`
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Circular SVG Countdown Timer */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center my-2">
          <svg
            className="w-full h-full -rotate-90"
            viewBox="0 0 288 288"
            aria-hidden="true"
          >
            <circle
              cx="144"
              cy="144"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="opacity-15"
            />
            <circle
              cx="144"
              cy="144"
              r={radius}
              fill="none"
              stroke={themeConfig.ringStrokeColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <span
              className={`text-xs font-semibold tracking-wide uppercase ${themeConfig.textMutedClass}`}
            >
              {MODE_LABELS[mode]}
            </span>
            <div
              data-testid="timer-countdown"
              className={`text-5xl sm:text-6xl font-bold font-mono tabular-nums tracking-tight my-2 ${themeConfig.textPrimaryClass}`}
            >
              {formatTimeMMSS(remainingSeconds)}
            </div>

            {/* 4-Session Long Break Cycle Dots */}
            <div
              className="flex items-center gap-2 mt-1"
              title={`${completedFocusCycleCount % 4} of 4 sessions until Long Break`}
            >
              {[0, 1, 2, 3].map((dotIdx) => {
                const filled = dotIdx < completedFocusCycleCount % 4;
                return (
                  <span
                    key={dotIdx}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      filled ? '' : 'bg-black/15 dark:bg-white/20'
                    }`}
                    style={
                      filled
                        ? { backgroundColor: themeConfig.accentHex }
                        : undefined
                    }
                  />
                );
              })}
              <span
                className={`text-[11px] font-mono tabular-nums ml-1 ${themeConfig.textMutedClass}`}
              >
                Cycle {(completedFocusCycleCount % 4) + 1}/4
              </span>
            </div>
          </div>
        </div>

        {/* Primary Timer Controls: Start/Pause, Reset, Skip, Complete Session */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={onStartPause}
            className={`px-7 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-transform active:scale-95 whitespace-nowrap shrink-0 ${themeConfig.buttonBgClass}`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Start</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onReset}
            aria-label="Reset timer"
            className={`px-4 py-3 rounded-xl text-sm font-semibold border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip current session"
            className={`px-4 py-3 rounded-xl text-sm font-semibold border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
          >
            <FastForward className="w-4 h-4" />
            <span>Skip</span>
          </button>

          <button
            type="button"
            onClick={onCompleteSessionNow}
            className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
            title="Complete and log this session now"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Complete Session</span>
          </button>
        </div>

        {/* Quick Durations Editor */}
        <div
          className={`mt-6 pt-5 border-t w-full ${themeConfig.borderClass} flex flex-wrap items-center justify-center gap-4 text-xs`}
        >
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="quick-focus-mins"
              className={themeConfig.textMutedClass}
            >
              Focus (m):
            </label>
            <input
              id="quick-focus-mins"
              type="number"
              min={1}
              max={120}
              value={timerSettings.focusMinutes}
              onChange={(e) =>
                onUpdateTimerSettings({
                  ...timerSettings,
                  focusMinutes: Math.max(1, Number(e.target.value) || 25),
                })
              }
              className={`w-16 px-2 py-1 rounded-lg font-mono tabular-nums text-center ${themeConfig.glassInputClass}`}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="quick-short-mins"
              className={themeConfig.textMutedClass}
            >
              Short Break (m):
            </label>
            <input
              id="quick-short-mins"
              type="number"
              min={1}
              max={60}
              value={timerSettings.shortBreakMinutes}
              onChange={(e) =>
                onUpdateTimerSettings({
                  ...timerSettings,
                  shortBreakMinutes: Math.max(1, Number(e.target.value) || 5),
                })
              }
              className={`w-14 px-2 py-1 rounded-lg font-mono tabular-nums text-center ${themeConfig.glassInputClass}`}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="quick-long-mins"
              className={themeConfig.textMutedClass}
            >
              Long Break (m):
            </label>
            <input
              id="quick-long-mins"
              type="number"
              min={1}
              max={60}
              value={timerSettings.longBreakMinutes}
              onChange={(e) =>
                onUpdateTimerSettings({
                  ...timerSettings,
                  longBreakMinutes: Math.max(1, Number(e.target.value) || 15),
                })
              }
              className={`w-14 px-2 py-1 rounded-lg font-mono tabular-nums text-center ${themeConfig.glassInputClass}`}
            />
          </div>
        </div>

        {lastCompletedToast && (
          <div
            role="status"
            className="mt-4 w-full px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-medium flex items-center justify-between gap-2"
          >
            <span className={themeConfig.textPrimaryClass}>
              {lastCompletedToast}
            </span>
            <button
              type="button"
              onClick={onDismissToast}
              className={`text-xs underline ${themeConfig.textMutedClass}`}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Right Column: Active Task Selector, Ambient Sound Player, Mood AI Coach (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        {/* 1. Active Task Selector Card */}
        <div className={`p-5 rounded-2xl ${themeConfig.glassCardClass}`}>
          <h2
            className={`text-base font-bold mb-2 ${themeConfig.textPrimaryClass}`}
            style={{ fontFamily: themeConfig.fontDisplay }}
          >
            Current Study Task
          </h2>
          <label
            htmlFor="focus-task-select"
            className={`block text-xs mb-2 ${themeConfig.textMutedClass}`}
          >
            Select the task you are focusing on to track Pomodoros and subject hours:
          </label>
          <select
            id="focus-task-select"
            value={selectedTaskId || ''}
            onChange={(e) =>
              onSelectTaskId(e.target.value ? e.target.value : null)
            }
            className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium outline-none ${themeConfig.glassInputClass}`}
          >
            <option value="">General Study Session (No task selected)</option>
            {incompleteTasks.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.subject}] {t.title} ({t.completedPomodoros}/
                {t.estimatedPomodoros} Pom)
              </option>
            ))}
          </select>

          {selectedTask && (
            <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-semibold ${themeConfig.textPrimaryClass}`}
                >
                  {selectedTask.subject}
                </span>
                <span
                  className={`font-mono tabular-nums ${themeConfig.textMutedClass}`}
                >
                  {selectedTask.completedPomodoros} /{' '}
                  {selectedTask.estimatedPomodoros} Pomodoros completed
                </span>
              </div>
              {selectedTask.notes && (
                <p
                  className={`text-xs mt-1.5 ${themeConfig.textSecondaryClass}`}
                >
                  {selectedTask.notes}
                </p>
              )}

              {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <span
                    className={`text-[11px] font-semibold block ${themeConfig.textMutedClass}`}
                  >
                    Subtask Checklist:
                  </span>
                  {selectedTask.subtasks.map((st) => (
                    <label
                      key={st.id}
                      className="flex items-center gap-2 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={st.completed}
                        onChange={() =>
                          onToggleSubtask(selectedTask.id, st.id)
                        }
                        className="rounded"
                      />
                      <span
                        className={
                          st.completed
                            ? `line-through opacity-60 ${themeConfig.textMutedClass}`
                            : themeConfig.textSecondaryClass
                        }
                      >
                        {st.title}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Soundscape Mixer & My Music Player */}
        <SoundMixerPanel
          themeConfig={themeConfig}
          customTracks={customTracks}
        />

        {/* 3. Gemini Mood-Based Theme & Session Length Suggestion */}
        <div className={`p-5 rounded-2xl ${themeConfig.glassCardClass}`}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2
              className={`text-base font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Mood-Based Focus Suggestion
            </h2>
          </div>
          <p className={`text-xs mb-3 ${themeConfig.textSecondaryClass}`}>
            Tell Gemini how you feel right now, and get a tailored mood theme and Pomodoro cadence.
          </p>

          {isGuest ? (
            <button
              type="button"
              data-testid="focus-ai-guest-btn"
              onClick={() => onRequestSignIn?.()}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-colors ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sign in to use AI features</span>
            </button>
          ) : (
            <form onSubmit={handleAskMoodSuggestion} className="flex gap-2">
              <input
                type="text"
                aria-label="How are you feeling right now?"
                value={feelingInput}
                onChange={(e) => setFeelingInput(e.target.value)}
                placeholder="e.g., Feeling overwhelmed by my calculus midterm"
                className={`flex-1 px-3 py-2 rounded-xl text-xs outline-none ${themeConfig.glassInputClass}`}
              />
              <button
                type="submit"
                disabled={isSuggestingMood || !feelingInput.trim()}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 disabled:opacity-50 ${themeConfig.buttonBgClass}`}
              >
                {isSuggestingMood ? 'Thinking...' : 'Suggest'}
              </button>
            </form>
          )}

          {moodSuggestion && (
            <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/15 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-bold ${themeConfig.textPrimaryClass}`}>
                  Recommended: {MOOD_THEMES[moodSuggestion.theme].name} Theme ·{' '}
                  {moodSuggestion.focusMinutes}m Focus /{' '}
                  {moodSuggestion.shortBreakMinutes}m Break
                </span>
              </div>
              <p className={`text-xs ${themeConfig.textSecondaryClass}`}>
                {moodSuggestion.reason}
              </p>
              <button
                type="button"
                onClick={handleApplyMoodSuggestion}
                className={`w-full py-2 rounded-xl text-xs font-semibold ${themeConfig.buttonBgClass}`}
              >
                Apply {MOOD_THEMES[moodSuggestion.theme].name} Theme &{' '}
                {moodSuggestion.focusMinutes}m Timer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
