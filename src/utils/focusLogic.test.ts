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

test('room adjustable timer custom minutes clamping (1..180) and daily goal hours/minutes (0..16h, 5m steps) work accurately', async () => {
  const {
    clampRoomCustomMinutes,
    splitDailyGoalHoursToHoursMinutes,
    combineDailyGoalHoursAndMinutes,
    formatDailyGoalLabel,
  } = await import('./focusLogic');

  assert.equal(clampRoomCustomMinutes(0), 1);
  assert.equal(clampRoomCustomMinutes(-10), 1);
  assert.equal(clampRoomCustomMinutes(50), 50);
  assert.equal(clampRoomCustomMinutes(180), 180);
  assert.equal(clampRoomCustomMinutes(240), 180);

  const combined = combineDailyGoalHoursAndMinutes(2, 30);
  assert.equal(combined, 2.5);
  assert.deepEqual(splitDailyGoalHoursToHoursMinutes(2.5), {
    hours: 2,
    minutes: 30,
  });
  assert.equal(formatDailyGoalLabel(2.5), '2h 30m');
  assert.equal(formatDailyGoalLabel(3), '3h');
  assert.equal(formatDailyGoalLabel(0.75), '45m');

  // 16h cap zeroes out extra minutes
  assert.equal(combineDailyGoalHoursAndMinutes(16, 45), 16);
  assert.deepEqual(splitDailyGoalHoursToHoursMinutes(16), {
    hours: 16,
    minutes: 0,
  });
});

test('security hardening: sanitizePlainText strips HTML/scripts, isValidHttpsAudioUrl enforces https://, and evaluatePerUserRateLimit enforces 20 req/min cap', async () => {
  const {
    sanitizePlainText,
    isValidHttpsAudioUrl,
    evaluatePerUserRateLimit,
    ALLOWED_TRACK_CATEGORIES,
  } = await import('./focusLogic');

  // HTML and script injection stripping
  assert.equal(
    sanitizePlainText('<script>alert("xss")</script>Calculus II <b>Notes</b>', 100),
    'Calculus II Notes'
  );
  assert.equal(
    sanitizePlainText('javascript:alert(1) <img src=x onerror=alert(1)>Room', 80),
    'alert(1) Room'
  );
  assert.equal(sanitizePlainText('A'.repeat(150), 99).length, 99);

  // Audio URL validation
  assert.equal(
    isValidHttpsAudioUrl(
      'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg'
    ),
    true
  );
  assert.equal(
    isValidHttpsAudioUrl('http://insecure.example.com/audio.mp3'),
    false
  );
  assert.equal(isValidHttpsAudioUrl('javascript:alert(1)'), false);
  assert.equal(
    isValidHttpsAudioUrl('https://example.com/audio.mp3"><script>'),
    false
  );
  assert.equal(isValidHttpsAudioUrl('https://localhost/audio.mp3'), false);

  // Allowed track categories fixed list
  assert.ok(ALLOWED_TRACK_CATEGORIES.includes('Lo-Fi'));
  assert.ok(ALLOWED_TRACK_CATEGORIES.includes('Nature'));

  // Per-user rate limiter (20 requests per 60,000 ms)
  const buckets = new Map<string, number[]>();
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < 20; i++) {
    const res = evaluatePerUserRateLimit(buckets, 'user-123', t0 + i * 100);
    assert.equal(res.allowed, true);
    assert.equal(res.remaining, 20 - (i + 1));
  }
  // 21st request within the same minute is blocked
  const blocked = evaluatePerUserRateLimit(buckets, 'user-123', t0 + 5_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSec > 0);

  // Another user is unaffected
  const otherUser = evaluatePerUserRateLimit(buckets, 'user-456', t0 + 5_000);
  assert.equal(otherUser.allowed, true);

  // After 60 seconds window expires, user-123 is allowed again
  const afterWindow = evaluatePerUserRateLimit(
    buckets,
    'user-123',
    t0 + 61_000
  );
  assert.equal(afterWindow.allowed, true);
});

test('music mixer: built-in sound catalog, 20MB file validation, room vibe sanitization, and mixer state persistence work accurately', async () => {
  const {
    BUILT_IN_SOUNDS,
    BUILT_IN_SOUND_CATEGORIES,
    MAX_CUSTOM_AUDIO_FILE_BYTES,
    validateCustomAudioFile,
    sanitizeRoomVibe,
    normalizePersistedMixerPreferences,
  } = await import('./focusLogic');

  // 4 categories: Nature, Noise, Beats, Brainwaves
  assert.deepEqual(BUILT_IN_SOUND_CATEGORIES, [
    'Nature',
    'Noise',
    'Beats',
    'Brainwaves',
  ]);

  // All 12 built-in sounds exist (3 original + 9 new procedural sounds)
  const expectedIds = [
    'rain',
    'lofi',
    'whitenoise',
    'brownnoise',
    'pinknoise',
    'ocean',
    'thunderstorm',
    'fireplace',
    'birds',
    'crickets',
    'alphawaves',
    'lofichill',
  ];
  for (const id of expectedIds) {
    assert.ok(
      BUILT_IN_SOUNDS.some((s) => s.id === id),
      `Missing built-in sound: ${id}`
    );
  }
  const alphaSpec = BUILT_IN_SOUNDS.find((s) => s.id === 'alphawaves');
  assert.equal(alphaSpec?.category, 'Brainwaves');
  assert.match(alphaSpec?.note || '', /headphones/i);

  // Custom audio file validation (.mp3, .wav, .ogg, .m4a, max 20 MB)
  assert.equal(
    validateCustomAudioFile({
      name: 'study-beat.mp3',
      size: 5 * 1024 * 1024,
      type: 'audio/mpeg',
    }).valid,
    true
  );
  assert.equal(
    validateCustomAudioFile({
      name: 'voice-memo.m4a',
      size: 19 * 1024 * 1024,
      type: 'audio/mp4',
    }).valid,
    true
  );
  const tooLarge = validateCustomAudioFile({
    name: 'huge-mix.wav',
    size: MAX_CUSTOM_AUDIO_FILE_BYTES + 1024,
    type: 'audio/wav',
  });
  assert.equal(tooLarge.valid, false);
  assert.match(tooLarge.error || '', /20 MB/i);

  const badFormat = validateCustomAudioFile({
    name: 'video.mp4',
    size: 1024 * 100,
    type: 'video/mp4',
  });
  assert.equal(badFormat.valid, false);
  assert.match(badFormat.error || '', /Unsupported audio format/i);

  // Room vibe validation: allows builtin:<id> and track:<id>, rejects private custom uploaded files
  assert.equal(sanitizeRoomVibe('builtin:lofichill'), 'builtin:lofichill');
  assert.equal(sanitizeRoomVibe('track:track-lofi-1'), 'track:track-lofi-1');
  assert.equal(sanitizeRoomVibe('custom:my-private-file'), '');
  assert.equal(sanitizeRoomVibe('builtin:nonexistent'), '');

  // Mixer state normalization
  const prefs = normalizePersistedMixerPreferences({
    masterVolume: 0.85,
    layerVolumes: { 'builtin:rain': 0.6, 'builtin:lofichill': 0.5 },
    activeLayerIds: ['builtin:rain', 'builtin:lofichill', 'builtin:rain'],
    autoSuggestByMood: false,
  });
  assert.equal(prefs.masterVolume, 0.85);
  assert.equal(prefs.layerVolumes['builtin:rain'], 0.6);
  assert.deepEqual(prefs.activeLayerIds, ['builtin:rain', 'builtin:lofichill']);
  assert.equal(prefs.autoSuggestByMood, false);
});

test('friend stats: dailyMinutes 14-day map trimming (0..1440 ints), 7-day chart builder, and shareStatsWithFriends privacy filtering work accurately', async () => {
  const {
    sanitizeAndTrimDailyMinutes,
    updateDailyMinutesOnSessionComplete,
    buildSevenDayChartFromDailyMinutes,
    resolvePublicFriendProfileStats,
  } = await import('./focusLogic');

  // Create 18 days of entries ending on 2026-10-28, including out-of-range values
  const rawMap: Record<string, number> = {
    '2026-10-01': 60, // older than 14 days -> trimmed out
    '2026-10-10': 45, // older than 14 days -> trimmed out
    '2026-10-15': 30, // day 1 of 14-day window
    '2026-10-20': 1800, // clamped to 1440
    '2026-10-21': -25, // clamped to 0
    '2026-10-27': 90.7, // floored to integer 90
    '2026-10-28': 120,
    'invalid-key': 50,
  };

  const trimmed = sanitizeAndTrimDailyMinutes(rawMap, '2026-10-28');
  assert.ok(Object.keys(trimmed).length <= 14);
  assert.equal('2026-10-01' in trimmed, false);
  assert.equal('2026-10-10' in trimmed, false);
  assert.equal('invalid-key' in trimmed, false);
  assert.equal(trimmed['2026-10-15'], 30);
  assert.equal(trimmed['2026-10-20'], 1440);
  assert.equal(trimmed['2026-10-21'], 0);
  assert.equal(trimmed['2026-10-27'], 90);
  assert.equal(trimmed['2026-10-28'], 120);

  // Completing a 50-minute session on 2026-10-28 adds to today's entry and keeps <= 14 entries
  const afterSession = updateDailyMinutesOnSessionComplete(
    trimmed,
    '2026-10-28',
    50,
    '2026-10-28'
  );
  assert.equal(afterSession['2026-10-28'], 170);
  assert.ok(Object.keys(afterSession).length <= 14);

  // 7-day chart builds exactly 7 entries ending on 2026-10-28
  const chart = buildSevenDayChartFromDailyMinutes(afterSession, '2026-10-28');
  assert.equal(chart.length, 7);
  assert.equal(chart[6].date, '2026-10-28');
  assert.equal(chart[6].minutes, 170);
  assert.equal(chart[5].date, '2026-10-27');
  assert.equal(chart[5].minutes, 90);
  assert.equal(chart[5].hours, 1.5);

  // Privacy resolver when shareStatsWithFriends is true (default)
  const sampleFriend = {
    uid: 'friend-1',
    displayName: 'Alex Chen',
    photoURL: '',
    username: 'alex_chen',
    xp: 680,
    level: 4,
    currentStreak: 6,
    longestStreak: 11,
    totalMinutes: 1420,
    weeklyMinutes: 310,
    weekKey: '2026-W44',
    dailyMinutes: afterSession,
    shareStatsWithFriends: true,
    studyingNow: true,
    role: 'user' as const,
    createdAt: '2026-09-12T10:00:00Z',
  };

  const visibleStats = resolvePublicFriendProfileStats(
    sampleFriend,
    '2026-10-28',
    '2026-W44',
    false
  );
  assert.equal(visibleStats.isStatsHiddenFromViewer, false);
  assert.equal(visibleStats.xp, 680);
  assert.equal(visibleStats.longestStreak, 11);
  assert.equal(visibleStats.minutesToday, 170);
  assert.equal(visibleStats.minutesThisWeek, 310);
  assert.equal(visibleStats.minutesAllTime, 1420);
  assert.equal(visibleStats.studyingNow, true);
  assert.equal(visibleStats.sevenDayChart.length, 7);

  // Privacy resolver when shareStatsWithFriends is false -> friends see ONLY name, level, and currentStreak
  const privateFriend = {
    ...sampleFriend,
    shareStatsWithFriends: false,
  };
  const hiddenForFriend = resolvePublicFriendProfileStats(
    privateFriend,
    '2026-10-28',
    '2026-W44',
    false
  );
  assert.equal(hiddenForFriend.isStatsHiddenFromViewer, true);
  assert.equal(hiddenForFriend.displayName, 'Alex Chen');
  assert.equal(hiddenForFriend.level, 4);
  assert.equal(hiddenForFriend.currentStreak, 6);
  assert.equal(hiddenForFriend.xp, null);
  assert.equal(hiddenForFriend.longestStreak, null);
  assert.equal(hiddenForFriend.hoursToday, null);
  assert.equal(hiddenForFriend.hoursThisWeek, null);
  assert.equal(hiddenForFriend.hoursAllTime, null);
  assert.equal(hiddenForFriend.studyingNow, null);
  assert.equal(hiddenForFriend.sevenDayChart.length, 0);

  // Self always sees full stats in their own consistent panel even if shareStatsWithFriends is false
  const selfView = resolvePublicFriendProfileStats(
    privateFriend,
    '2026-10-28',
    '2026-W44',
    true
  );
  assert.equal(selfView.isStatsHiddenFromViewer, false);
  assert.equal(selfView.xp, 680);
  assert.equal(selfView.sevenDayChart.length, 7);
});

test('Lumo branding: APP_NAME, APP_FULL_TITLE, WATERMARK_TEXT, and buildLumoFaviconDataUri generate valid theme-adaptive SVG favicon', async () => {
  const {
    APP_NAME,
    APP_FULL_TITLE,
    APP_VERSION,
    WATERMARK_TEXT,
    buildLumoFaviconDataUri,
  } = await import('../components/LumoLogo');
  const { MOOD_THEMES } = await import('./themes');

  assert.equal(APP_NAME, 'Lumo');
  assert.equal(APP_FULL_TITLE, 'Lumo — Student Study Planner & Pomodoro');
  assert.equal(APP_VERSION, 'v1.0.0');
  assert.equal(WATERMARK_TEXT, 'Made by Ashu');

  // Verify favicon SVG data URI for all 5 mood themes
  for (const theme of Object.values(MOOD_THEMES)) {
    const uri = buildLumoFaviconDataUri(theme.accentHex);
    assert.ok(uri.startsWith('data:image/svg+xml;utf8,'));
    const decoded = decodeURIComponent(
      uri.replace('data:image/svg+xml;utf8,', '')
    );
    assert.ok(decoded.includes(theme.accentHex));
    assert.ok(decoded.includes('<circle'));
    assert.ok(decoded.includes('<rect'));
  }
});

test('distinct procedural Web Audio specs, 3s preview, and curated track error classification work accurately', async () => {
  const {
    UNCHANGED_BUILT_IN_SOUNDS,
    REWRITTEN_SOUND_SYNTH_SPECS,
    PREVIEW_DURATION_MS,
    classifyCuratedTrackError,
  } = await import('./focusLogic');

  // 5 unchanged sounds
  assert.deepEqual(UNCHANGED_BUILT_IN_SOUNDS, [
    'rain',
    'whitenoise',
    'pinknoise',
    'brownnoise',
    'alphawaves',
  ]);

  // 3-second preview duration
  assert.equal(PREVIEW_DURATION_MS, 3000);

  // 1. Ocean Waves specs
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.ocean.surfLowpassHz, 500);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.ocean.waveCycleMinSec, 7);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.ocean.waveCycleMaxSec, 12);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.ocean.riseMinSec, 3);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.ocean.riseMaxSec, 5);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.ocean.fallMinSec, 3);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.ocean.fallMaxSec, 5);
  assert.ok(REWRITTEN_SOUND_SYNTH_SPECS.ocean.foamHighpassHz > 2000);

  // 2. Thunderstorm specs
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm.rainLowpassHz, 1000);
  assert.ok(REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm.rainRelativeGain < 0.6);
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm.thunderIntervalMinSec,
    8
  );
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm.thunderIntervalMaxSec,
    25
  );
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm.crackDurationSec,
    0.08
  );
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm.rumbleLowpassMinHz,
    120
  );
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm.rumbleLowpassMaxHz,
    200
  );
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm.rumbleAttackSec,
    0.4
  );
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm.rumbleDecayMinSec,
    4
  );
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.thunderstorm.rumbleDecayMaxSec,
    7
  );

  // 3. Fireplace specs
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.fireplace.bedLowpassHz, 250);
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.fireplace.crackleDurationMinSec,
    0.005
  );
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.fireplace.crackleDurationMaxSec,
    0.03
  );
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.fireplace.crackleBandpassMinHz,
    1000
  );
  assert.equal(
    REWRITTEN_SOUND_SYNTH_SPECS.fireplace.crackleBandpassMaxHz,
    5000
  );
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.fireplace.crackleRateMinPerSec, 4);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.fireplace.crackleRateMaxPerSec, 20);

  // 4. Forest Birds specs
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.birds.chirpFreqMinHz, 2000);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.birds.chirpFreqMaxHz, 6000);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.birds.notesMin, 2);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.birds.notesMax, 6);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.birds.speciesCount, 3);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.birds.callIntervalMinSec, 2);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.birds.callIntervalMaxSec, 9);

  // 5. Night Crickets specs
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.crickets.carrierFreqMinHz, 4200);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.crickets.carrierFreqMaxHz, 5000);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.crickets.pulseRateHz, 30);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.crickets.pulsesPerChirp, 3);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.crickets.chirpsPerSecond, 2);
  assert.ok(
    REWRITTEN_SOUND_SYNTH_SPECS.crickets.cricketVoicesCount >= 4 &&
      REWRITTEN_SOUND_SYNTH_SPECS.crickets.cricketVoicesCount <= 6
  );

  // 6. Lo-Fi vs Lo-Fi Chill specs
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.lofi.hasDrums, false);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.lofichill.hasDrums, true);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.lofichill.bpm, 72);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.lofichill.barsPerChord, 2);
  assert.equal(REWRITTEN_SOUND_SYNTH_SPECS.lofichill.rhodesLowpassHz, 3000);
  assert.deepEqual(REWRITTEN_SOUND_SYNTH_SPECS.lofichill.chordNames, [
    'Cmaj7',
    'Am7',
    'Fmaj7',
    'G7',
  ]);

  // 7. Curated Track Error Classification (blocked link, not an audio file, network error)
  const netErr = classifyCuratedTrackError({
    mediaErrorCode: 2,
    src: 'https://example.com/beat.mp3',
  });
  assert.equal(netErr.category, 'network error');
  assert.match(netErr.message, /network error/i);

  const notAudio = classifyCuratedTrackError({
    mediaErrorCode: 4,
    src: 'https://pixabay.com/music/beats-study-lofi-12345/',
  });
  assert.equal(notAudio.category, 'not an audio file');
  assert.match(notAudio.message, /not an audio file/i);

  const blockedLink = classifyCuratedTrackError({
    mediaErrorCode: 4,
    src: 'https://cdn.example.com/protected/beat.mp3',
  });
  assert.equal(blockedLink.category, 'blocked link');
  assert.match(blockedLink.message, /blocked link/i);
});

test('first-run default state starts empty (Level 1, 0 XP, 0 streak, 0 hours) while sample data is opt-in', async () => {
  const { getInitialProfile, getSampleProfile } = await import('./seedData');

  const initialProfile = getInitialProfile();
  assert.equal(initialProfile.totalXp, 0);
  const initialLevel = getLevelInfo(initialProfile.totalXp);
  assert.equal(initialLevel.level, 1);

  const emptyStats = computeStudyStats([], '2026-10-28');
  assert.equal(emptyStats.currentStreak, 0);
  assert.equal(emptyStats.longestStreak, 0);
  assert.equal(emptyStats.hoursToday, 0);
  assert.equal(emptyStats.hoursThisWeek, 0);

  const sampleProfile = getSampleProfile();
  assert.equal(sampleProfile.name, 'Maya Lin');
  assert.equal(sampleProfile.totalXp, 285);
});


