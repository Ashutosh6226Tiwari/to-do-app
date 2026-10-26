import React, { useEffect, useState } from 'react';
import { Check, Target, X } from 'lucide-react';
import { MoodThemeConfig } from '../types';
import {
  combineDailyGoalHoursAndMinutes,
  formatDailyGoalLabel,
  splitDailyGoalHoursToHoursMinutes,
} from '../utils/focusLogic';

interface DailyGoalModalProps {
  isOpen: boolean;
  currentGoalHours: number;
  themeConfig: MoodThemeConfig;
  onClose: () => void;
  onSaveGoalHours: (nextGoalHours: number) => void;
}

const QUICK_PRESET_HOURS = [1, 2, 3, 4] as const;

export function DailyGoalModal({
  isOpen,
  currentGoalHours,
  themeConfig,
  onClose,
  onSaveGoalHours,
}: DailyGoalModalProps) {
  const initialSplit = splitDailyGoalHoursToHoursMinutes(currentGoalHours);
  const [hoursInput, setHoursInput] = useState<number>(initialSplit.hours);
  const [minutesInput, setMinutesInput] = useState<number>(
    initialSplit.minutes
  );

  useEffect(() => {
    if (isOpen) {
      const split = splitDailyGoalHoursToHoursMinutes(currentGoalHours);
      setHoursInput(split.hours);
      setMinutesInput(split.minutes);
    }
  }, [isOpen, currentGoalHours]);

  if (!isOpen) return null;

  const previewGoalHours = combineDailyGoalHoursAndMinutes(
    hoursInput,
    minutesInput
  );

  const handleHoursChange = (val: number) => {
    const clampedH = Math.max(0, Math.min(16, Math.floor(Number(val) || 0)));
    setHoursInput(clampedH);
    if (clampedH === 16) {
      setMinutesInput(0);
    }
  };

  const handleMinutesChange = (val: number) => {
    if (hoursInput === 16) {
      setMinutesInput(0);
      return;
    }
    const raw = Math.max(0, Math.min(55, Number(val) || 0));
    const snapped = Math.min(55, Math.round(raw / 5) * 5);
    setMinutesInput(snapped);
  };

  const handleSelectPreset = (presetHours: number) => {
    setHoursInput(presetHours);
    setMinutesInput(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalHours = combineDailyGoalHoursAndMinutes(
      hoursInput,
      minutesInput
    );
    onSaveGoalHours(finalHours);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-daily-goal-dialog-title"
    >
      <div
        className={`w-full max-w-md p-6 sm:p-7 rounded-3xl shadow-2xl border ${themeConfig.glassCardClass}`}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: themeConfig.accentHex }}
            >
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="set-daily-goal-dialog-title"
                className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                Set Daily Goal
              </h2>
              <p className={`text-xs ${themeConfig.textMutedClass}`}>
                Choose 0 to 16 hours in 5-minute steps
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close daily goal dialog"
            className={`p-1.5 rounded-xl border ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Quick Presets (1h, 2h, 3h, 4h) */}
          <div>
            <span
              className={`block text-xs font-semibold mb-2 ${themeConfig.textSecondaryClass}`}
            >
              Quick Presets
            </span>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_PRESET_HOURS.map((preset) => {
                const isSelected =
                  hoursInput === preset && minutesInput === 0;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`py-2 px-3 rounded-xl text-xs font-mono font-bold border transition-all ${
                      isSelected
                        ? themeConfig.activeTabClass
                        : `${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`
                    }`}
                  >
                    {preset}h
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hours (0..16) and Minutes (0..55, step 5) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="daily-goal-hours-input"
                className={`block text-xs font-semibold mb-1.5 ${themeConfig.textPrimaryClass}`}
              >
                Hours (0–16)
              </label>
              <input
                id="daily-goal-hours-input"
                type="number"
                min={0}
                max={16}
                step={1}
                value={hoursInput}
                onChange={(e) => handleHoursChange(Number(e.target.value))}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono tabular-nums outline-none ${themeConfig.glassInputClass}`}
              />
            </div>

            <div>
              <label
                htmlFor="daily-goal-minutes-input"
                className={`block text-xs font-semibold mb-1.5 ${themeConfig.textPrimaryClass}`}
              >
                Minutes (5-min steps)
              </label>
              <input
                id="daily-goal-minutes-input"
                type="number"
                min={0}
                max={hoursInput === 16 ? 0 : 55}
                step={5}
                disabled={hoursInput === 16}
                value={minutesInput}
                onChange={(e) => handleMinutesChange(Number(e.target.value))}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono tabular-nums outline-none disabled:opacity-50 ${themeConfig.glassInputClass}`}
              />
            </div>
          </div>

          {/* Selected Goal Summary */}
          <div
            className={`p-3.5 rounded-2xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 flex items-center justify-between text-xs`}
          >
            <span className={themeConfig.textSecondaryClass}>
              Target Daily Study Time
            </span>
            <span
              data-testid="daily-goal-modal-preview"
              className={`font-mono font-bold text-sm ${themeConfig.textPrimaryClass}`}
            >
              {formatDailyGoalLabel(previewGoalHours)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md ${themeConfig.buttonBgClass}`}
            >
              <Check className="w-4 h-4" />
              <span>Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
