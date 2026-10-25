import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getXpRequiredForLevelUp,
  getLevelInfo,
  calculateSessionXP,
  calculateStreaks,
  computeStudyStats,
} from './focusLogic';
import { FocusSessionRecord } from '../types';

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

  // 100 (L1->2) + 150 (L2->3) = 250 -> Level 3 Scholar
  const lvl3 = getLevelInfo(300);
  assert.equal(lvl3.level, 3);
  assert.equal(lvl3.title, 'Scholar');
  assert.equal(lvl3.currentLevelXp, 50);
  assert.equal(lvl3.xpNeededForNextLevel, 200);
  assert.equal(lvl3.progressPercent, 25);

  // 100 + 150 + 200 + 250 = 700 -> Level 5 Master
  const lvl5 = getLevelInfo(720);
  assert.equal(lvl5.level, 5);
  assert.equal(lvl5.title, 'Master');
  assert.equal(lvl5.currentLevelXp, 20);
});

test('calculateSessionXP awards 1 XP/min + 10 bonus with streak multipliers only for completed focus sessions', () => {
  // Incomplete session gives 0 XP
  assert.equal(calculateSessionXP(25, false, 'focus', 5), 0);
  // Short break gives 0 XP
  assert.equal(calculateSessionXP(5, true, 'shortBreak', 5), 0);
  // 25 min focus, 1 day streak: (25 + 10) * 1.0 = 35 XP
  assert.equal(calculateSessionXP(25, true, 'focus', 1), 35);
  // 25 min focus, 3 day streak (+10%): Math.round(35 * 1.1) = 39 XP
  assert.equal(calculateSessionXP(25, true, 'focus', 3), 39);
  // 30 min focus, 7 day streak (+25%): Math.round((30 + 10) * 1.25) = 50 XP
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
