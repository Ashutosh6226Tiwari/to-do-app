import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getXpRequiredForLevelUp,
  getLevelInfo,
  calculateSessionXP,
  calculateStreaks,
  computeStudyStats,
  createInitialTimerState,
  startTimerState,
  pauseTimerState,
  evaluateTimerTick,
  computeRemainingSeconds,
} from './focusLogic';
import { FocusSessionRecord, TimerSettings } from '../types';

const DEFAULT_SETTINGS: TimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  autoSwitchModes: true,
  soundAlertEnabled: true,
  alertTone: 'chime',
};

test('level XP thresholds follow 100 base + 50 per level', () => {
  assert.equal(getXpRequiredForLevelUp(1), 100);
  assert.equal(getXpRequiredForLevelUp(2), 150);
  assert.equal(getXpRequiredForLevelUp(3), 200);
  assert.equal(getXpRequiredForLevelUp(4), 250);
});

test('getLevelInfo computes level, title, and progress bar accurately', () => {
  const lvl1 = getLevelInfo(45);
  assert.equal(lvl1.level, 1);
  assert.equal(lvl1.title, 'Beginner');
  assert.equal(lvl1.currentLevelXp, 45);
  assert.equal(lvl1.xpNeededForNextLevel, 100);
  assert.equal(lvl1.progressPercent, 45);

  const lvl2 = getLevelInfo(100);
  assert.equal(lvl2.level, 2);
  assert.equal(lvl2.title, 'Learner');
  assert.equal(lvl2.currentLevelXp, 0);
  assert.equal(lvl2.xpNeededForNextLevel, 150);

  const lvl3 = getLevelInfo(300);
  assert.equal(lvl3.level, 3);
  assert.equal(lvl3.title, 'Scholar');
  assert.equal(lvl3.currentLevelXp, 50);
  assert.equal(lvl3.xpNeededForNextLevel, 200);
  assert.equal(lvl3.progressPercent, 25);

  const lvl5 = getLevelInfo(720);
  assert.equal(lvl5.level, 5);
  assert.equal(lvl5.title, 'Master');
  assert.equal(lvl5.currentLevelXp, 20);
});

test('calculateSessionXP awards 1 XP/min + 10 bonus with streak multipliers only for completed focus sessions', () => {
  assert.equal(calculateSessionXP(25, false, 'focus', 5), 0);
  assert.equal(calculateSessionXP(5, true, 'shortBreak', 5), 0);
  assert.equal(calculateSessionXP(25, true, 'focus', 1), 35);
  assert.equal(calculateSessionXP(25, true, 'focus', 3), 39);
  assert.equal(calculateSessionXP(30, true, 'focus', 7), 50);
});

test('calculateStreaks and computeStudyStats aggregate hours, streaks, and subjects accurately', () => {
  const sampleSessions: FocusSessionRecord[] = [
    {
      id: 's1',
      taskTitle: 'Kinematics Problem Set',
      subject: 'Physics',
      date: '2026-10-23',
      timestamp: '2026-10-23T14:00:00Z',
      durationMinutes: 60,
      mode: 'focus',
      completed: true,
      xpEarned: 70,
    },
    {
      id: 's2',
      taskTitle: 'Organic Chemistry Reactions',
      subject: 'Chemistry',
      date: '2026-10-24',
      timestamp: '2026-10-24T16:00:00Z',
      durationMinutes: 30,
      mode: 'focus',
      completed: true,
      xpEarned: 40,
    },
    {
      id: 's3',
      taskTitle: 'Electromagnetism Lab Prep',
      subject: 'Physics',
      date: '2026-10-25',
      timestamp: '2026-10-25T09:00:00Z',
      durationMinutes: 60,
      mode: 'focus',
      completed: true,
      xpEarned: 77,
    },
  ];

  const streaks = calculateStreaks(sampleSessions, '2026-10-25');
  assert.equal(streaks.currentStreak, 3);
  assert.equal(streaks.longestStreak, 3);

  const stats = computeStudyStats(sampleSessions, '2026-10-25');
  assert.equal(stats.hoursToday, 1.0);
  assert.equal(stats.hoursThisWeek, 2.5);
  assert.equal(stats.hoursThisMonth, 2.5);
  assert.equal(stats.subjectBreakdown.length, 2);
  assert.equal(stats.subjectBreakdown[0].subject, 'Physics');
  assert.equal(stats.subjectBreakdown[0].minutes, 120);
  assert.equal(stats.subjectBreakdown[0].percentage, 80);
});

test('timestamp-based timer calculates accurate remaining time across background tab delays, pause/resume, and completes once only without double XP', () => {
  const t0 = 1_700_000_000_000;
  const initial = createInitialTimerState(DEFAULT_SETTINGS, 'task-1');
  assert.equal(computeRemainingSeconds(initial, t0), 25 * 60);

  // Start timer at t0 -> endTimestamp = t0 + 25 mins
  const started = startTimerState(initial, t0);
  assert.equal(started.isRunning, true);
  assert.equal(started.endTimestamp, t0 + 25 * 60 * 1000);

  // Simulate background tab for 1 minute (60,000 ms) without intermediate ticks
  const after1Min = t0 + 60 * 1000;
  const tick1Min = evaluateTimerTick(started, DEFAULT_SETTINGS, after1Min);
  assert.equal(tick1Min.remainingSeconds, 24 * 60);
  assert.equal(tick1Min.completedSession, null);

  // Pause at +1 min -> stores 24 mins remaining
  const paused = pauseTimerState(started, after1Min);
  assert.equal(paused.isRunning, false);
  assert.equal(paused.endTimestamp, null);
  assert.equal(paused.remainingMsWhenPaused, 24 * 60 * 1000);

  // Resume 10 minutes later -> new endTimestamp = resumeTime + 24 mins
  const resumeTime = after1Min + 10 * 60 * 1000;
  const resumed = startTimerState(paused, resumeTime);
  assert.equal(resumed.isRunning, true);
  assert.equal(resumed.endTimestamp, resumeTime + 24 * 60 * 1000);

  // App returns to foreground 5 minutes after endTimestamp has passed
  const afterEnd = resumed.endTimestamp! + 5 * 60 * 1000;
  const expiredEval = evaluateTimerTick(resumed, DEFAULT_SETTINGS, afterEnd);

  // Completes focus session and auto-switches to shortBreak
  assert.notEqual(expiredEval.completedSession, null);
  assert.equal(expiredEval.completedSession?.mode, 'focus');
  assert.equal(expiredEval.completedSession?.durationMinutes, 25);
  assert.equal(expiredEval.nextState.mode, 'shortBreak');
  assert.equal(expiredEval.nextState.completedFocusCycleCount, 1);
  assert.equal(expiredEval.nextState.lastCompletedRunId, resumed.activeRunId);

  // Calling evaluateTimerTick again with the old stale state (e.g. duplicate visibilitychange + interval event)
  // when lastCompletedRunId matches activeRunId must NOT award XP a second time
  const staleDuplicateState = {
    ...resumed,
    lastCompletedRunId: resumed.activeRunId,
  };
  const duplicateEval = evaluateTimerTick(
    staleDuplicateState,
    DEFAULT_SETTINGS,
    afterEnd + 100
  );
  assert.equal(duplicateEval.completedSession, null);
});

test('ISO weekKey, weeklyMinutes rollover, username validation, and shared room timestamp timer calculate accurately', async () => {
  const {
    getIsoWeekKey,
    normalizeWeeklyMinutes,
    validateUsername,
    computeSharedRoomRemainingSeconds,
  } = await import('./focusLogic');

  const weekKey = getIsoWeekKey('2026-10-25');
  assert.match(weekKey, /^2026-W\d{2}$/);

  const sameWeek = normalizeWeeklyMinutes(145, '2026-W43', '2026-W43');
  assert.equal(sameWeek.weeklyMinutes, 145);
  assert.equal(sameWeek.didReset, false);

  const rolledOver = normalizeWeeklyMinutes(145, '2026-W43', '2026-W44');
  assert.equal(rolledOver.weeklyMinutes, 0);
  assert.equal(rolledOver.weekKey, '2026-W44');
  assert.equal(rolledOver.didReset, true);

  assert.equal(validateUsername('ab').valid, false);
  assert.equal(validateUsername('bad-name!').valid, false);
  const validUser = validateUsername('Maya_Lin_26');
  assert.equal(validUser.valid, true);
  assert.equal(validUser.usernameLower, 'maya_lin_26');

  const t0 = 1_700_000_000_000;
  // Idle room returns full durationSec
  assert.equal(computeSharedRoomRemainingSeconds(null, 1500, 'idle', t0), 1500);
  // Running room 90 seconds after startedAt returns 1410 seconds
  assert.equal(
    computeSharedRoomRemainingSeconds(t0, 1500, 'running', t0 + 90_000),
    1410
  );
  // Running room after duration has elapsed returns 0
  assert.equal(
    computeSharedRoomRemainingSeconds(t0, 1500, 'running', t0 + 1600_000),
    0
  );
});

