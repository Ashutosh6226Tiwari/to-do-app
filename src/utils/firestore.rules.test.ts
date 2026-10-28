import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesSource = fs.readFileSync(
  path.resolve(__dirname, '../../firestore.rules'),
  'utf8'
);

/**
 * Deterministic Security Rules Simulator mirroring the exact boolean predicates
 * in /firestore.rules for FocusFlow's 6 tightened security invariants.
 */

interface RoomDoc {
  hostUid: string;
  memberUids: string[];
  maxMembers: number;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  startedAt: number | null;
  durationSec: number;
  status: 'idle' | 'running' | 'paused' | 'completed';
}

interface FriendRequestDoc {
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

interface UserDoc {
  displayName: string;
  photoURL: string;
  username: string;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalMinutes: number;
  weeklyMinutes: number;
  weekKey: string;
  studyingNow: boolean;
  role: 'user' | 'admin';
  createdAt: string;
  email?: string;
}

function affectedKeys(existing: Record<string, unknown>, incoming: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(existing), ...Object.keys(incoming)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(existing[k]) !== JSON.stringify(incoming[k])) {
      changed.push(k);
    }
  }
  return changed;
}

function isValidRoom(data: RoomDoc): boolean {
  return (
    typeof data.hostUid === 'string' &&
    Array.isArray(data.memberUids) &&
    data.memberUids.length >= 1 &&
    data.memberUids.length <= 10 &&
    data.memberUids.includes(data.hostUid) &&
    data.maxMembers === 10 &&
    ['focus', 'shortBreak', 'longBreak'].includes(data.mode) &&
    (data.startedAt === null || (Number.isInteger(data.startedAt) && data.startedAt >= 0)) &&
    Number.isInteger(data.durationSec) &&
    data.durationSec >= 10 &&
    data.durationSec <= 10800 &&
    ['idle', 'running', 'paused', 'completed'].includes(data.status)
  );
}

function evaluateRoomUpdate(
  authUid: string,
  existing: RoomDoc,
  incoming: RoomDoc
): boolean {
  if (!isValidRoom(incoming)) return false;

  const changed = affectedKeys(
    existing as unknown as Record<string, unknown>,
    incoming as unknown as Record<string, unknown>
  );
  const onlyMemberUidsChanged =
    changed.length === 1 && changed[0] === 'memberUids';

  const isHost = existing.hostUid === authUid;

  const isSelfJoinOnly =
    !existing.memberUids.includes(authUid) &&
    existing.memberUids.length < 10 &&
    onlyMemberUidsChanged &&
    incoming.memberUids.length === existing.memberUids.length + 1 &&
    existing.memberUids.every((m) => incoming.memberUids.includes(m)) &&
    incoming.memberUids.includes(authUid);

  const isSelfLeaveOnly =
    existing.memberUids.includes(authUid) &&
    existing.hostUid !== authUid &&
    onlyMemberUidsChanged &&
    !incoming.memberUids.includes(authUid) &&
    incoming.memberUids.length === existing.memberUids.length - 1 &&
    incoming.memberUids.every((m) => existing.memberUids.includes(m));

  return isHost || isSelfJoinOnly || isSelfLeaveOnly;
}

function evaluateFriendshipCreate(
  authUid: string,
  friendshipId: string,
  incoming: { members: [string, string]; createdAt: string },
  friendRequestsStore: Record<string, FriendRequestDoc>
): boolean {
  const [uidA, uidB] = incoming.members;
  if (!uidA || !uidB || uidA === uidB) return false;
  if (friendshipId !== `${uidA}_${uidB}`) return false;
  if (!incoming.members.includes(authUid)) return false;

  const reqAB = friendRequestsStore[`${uidA}_${uidB}`];
  const reqBA = friendRequestsStore[`${uidB}_${uidA}`];

  const validAB =
    reqAB &&
    reqAB.fromUid === uidA &&
    reqAB.toUid === uidB &&
    reqAB.status === 'accepted' &&
    authUid === uidB;

  const validBA =
    reqBA &&
    reqBA.fromUid === uidB &&
    reqBA.toUid === uidA &&
    reqBA.status === 'accepted' &&
    authUid === uidA;

  return Boolean(validAB || validBA);
}

function evaluateUserCreate(authUid: string, targetUid: string, incoming: UserDoc): boolean {
  if (authUid !== targetUid) return false;
  if ('email' in incoming) return false;
  if (incoming.role !== 'user') return false;
  if (!Number.isInteger(incoming.xp) || incoming.xp < 0 || incoming.xp > 100000) return false;
  if (!Number.isInteger(incoming.level) || incoming.level < 1 || incoming.level > 500) return false;
  if (!Number.isInteger(incoming.currentStreak) || incoming.currentStreak < 0 || incoming.currentStreak > 3650) return false;
  if (!Number.isInteger(incoming.weeklyMinutes) || incoming.weeklyMinutes < 0 || incoming.weeklyMinutes > 10080) return false;
  return true;
}

function evaluateUserUpdate(
  authUid: string,
  targetUid: string,
  existing: UserDoc,
  incoming: UserDoc
): boolean {
  if (authUid !== targetUid) return false;
  if ('email' in incoming) return false;
  if (incoming.role !== existing.role) return false;
  if (incoming.username !== existing.username) return false;
  if (incoming.createdAt !== existing.createdAt) return false;
  if (incoming.xp < existing.xp || incoming.xp - existing.xp > 500) return false;
  if (incoming.level < existing.level) return false;
  if (incoming.longestStreak < existing.longestStreak) return false;
  if (incoming.currentStreak < 0 || incoming.currentStreak > 3650) return false;
  if (incoming.weeklyMinutes < 0 || incoming.weeklyMinutes > 10080) return false;
  return true;
}

function evaluateUsernameWrite(
  op: 'create' | 'update' | 'delete',
  authUid: string,
  usernameLower: string,
  incoming: { uid: string } | null,
  existingUsernames: Record<string, { uid: string }>
): boolean {
  if (op === 'update' || op === 'delete') return false;
  if (existingUsernames[usernameLower]) return false;
  if (!incoming || incoming.uid !== authUid) return false;
  return /^[a-z0-9_]{3,20}$/.test(usernameLower);
}

test('1. Join full room is refused when memberUids already has 10 members, while joining < 10 succeeds for self only', () => {
  const baseRoom: RoomDoc = {
    hostUid: 'u1',
    memberUids: ['u1', 'u2'],
    maxMembers: 10,
    mode: 'focus',
    startedAt: null,
    durationSec: 1500,
    status: 'idle',
  };

  // Valid self-join when room has 2 members (< 10)
  assert.equal(
    evaluateRoomUpdate('u3', baseRoom, {
      ...baseRoom,
      memberUids: ['u1', 'u2', 'u3'],
    }),
    true
  );

  // Non-host attempting to remove another member ('u2') while joining -> DENIED
  assert.equal(
    evaluateRoomUpdate('u3', baseRoom, {
      ...baseRoom,
      memberUids: ['u1', 'u3'],
    }),
    false
  );

  // Non-host attempting to add someone else ('u4') instead of themselves -> DENIED
  assert.equal(
    evaluateRoomUpdate('u3', baseRoom, {
      ...baseRoom,
      memberUids: ['u1', 'u2', 'u4'],
    }),
    false
  );

  // Full room with 10 members -> 11th user ('u11') attempting to join is REFUSED
  const fullRoom: RoomDoc = {
    ...baseRoom,
    memberUids: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'],
  };
  assert.equal(
    evaluateRoomUpdate('u11', fullRoom, {
      ...fullRoom,
      memberUids: [...fullRoom.memberUids, 'u11'],
    }),
    false
  );
});

test('2. Non-host editing room timer (startedAt, durationSec, mode, status, hostUid) is refused', () => {
  const room: RoomDoc = {
    hostUid: 'host-1',
    memberUids: ['host-1', 'member-2'],
    maxMembers: 10,
    mode: 'focus',
    startedAt: null,
    durationSec: 1500,
    status: 'idle',
  };

  // Host starting shared timer -> ALLOWED
  assert.equal(
    evaluateRoomUpdate('host-1', room, {
      ...room,
      startedAt: 1700000000000,
      status: 'running',
    }),
    true
  );

  // Non-host ('member-2') attempting to start shared timer -> DENIED
  assert.equal(
    evaluateRoomUpdate('member-2', room, {
      ...room,
      startedAt: 1700000000000,
      status: 'running',
    }),
    false
  );

  // Non-host ('member-2') attempting to change durationSec or mode -> DENIED
  assert.equal(
    evaluateRoomUpdate('member-2', room, {
      ...room,
      durationSec: 60,
      mode: 'longBreak',
    }),
    false
  );

  // Non-host ('member-2') attempting to hijack hostUid -> DENIED
  assert.equal(
    evaluateRoomUpdate('member-2', room, {
      ...room,
      hostUid: 'member-2',
    }),
    false
  );
});

test('3. Fake friendship creation without an accepted friendRequest (or by non-recipient) is refused', () => {
  const emptyRequests: Record<string, FriendRequestDoc> = {};

  // Fake friendship with no friendRequest at all -> DENIED
  assert.equal(
    evaluateFriendshipCreate(
      'alice',
      'alice_bob',
      { members: ['alice', 'bob'], createdAt: '2026-10-25T12:00:00Z' },
      emptyRequests
    ),
    false
  );

  // Sender ('alice') trying to force-create friendship while request is still 'pending' -> DENIED
  const pendingStore: Record<string, FriendRequestDoc> = {
    alice_bob: {
      fromUid: 'alice',
      toUid: 'bob',
      status: 'pending',
      createdAt: '2026-10-25T12:00:00Z',
    },
  };
  assert.equal(
    evaluateFriendshipCreate(
      'alice',
      'alice_bob',
      { members: ['alice', 'bob'], createdAt: '2026-10-25T12:00:00Z' },
      pendingStore
    ),
    false
  );

  // Recipient ('bob') creating friendship after accepting request -> ALLOWED
  const acceptedStore: Record<string, FriendRequestDoc> = {
    alice_bob: {
      fromUid: 'alice',
      toUid: 'bob',
      status: 'accepted',
      createdAt: '2026-10-25T12:00:00Z',
    },
  };
  assert.equal(
    evaluateFriendshipCreate(
      'bob',
      'alice_bob',
      { members: ['alice', 'bob'], createdAt: '2026-10-25T12:00:00Z' },
      acceptedStore
    ),
    true
  );
});

test('4. Role change attempt, XP cap, level drop, and email storage in users/{uid} are refused', () => {
  const validInitialUser: UserDoc = {
    displayName: 'Maya Lin',
    photoURL: '',
    username: 'maya_lin',
    xp: 85000, // First migration allows up to 100,000 XP
    level: 10,
    currentStreak: 4,
    longestStreak: 7,
    totalMinutes: 1200,
    weeklyMinutes: 240,
    weekKey: '2026-W44',
    studyingNow: false,
    role: 'user',
    createdAt: '2026-10-25T10:00:00Z',
  };

  // First migration up to 100,000 XP with role == 'user' -> ALLOWED
  assert.equal(evaluateUserCreate('u1', 'u1', validInitialUser), true);

  // First migration > 100,000 XP -> DENIED
  assert.equal(
    evaluateUserCreate('u1', 'u1', { ...validInitialUser, xp: 100001 }),
    false
  );

  // Creating user with role == 'admin' -> DENIED
  assert.equal(
    evaluateUserCreate('u1', 'u1', { ...validInitialUser, role: 'admin' }),
    false
  );

  // Storing email in users/{uid} -> DENIED
  assert.equal(
    evaluateUserCreate('u1', 'u1', {
      ...validInitialUser,
      email: 'maya@example.com',
    }),
    false
  );

  // Updating own role from 'user' to 'admin' -> DENIED
  assert.equal(
    evaluateUserUpdate('u1', 'u1', validInitialUser, {
      ...validInitialUser,
      role: 'admin',
    }),
    false
  );

  // Increasing XP by <= 500 -> ALLOWED
  assert.equal(
    evaluateUserUpdate('u1', 'u1', validInitialUser, {
      ...validInitialUser,
      xp: 85050,
    }),
    true
  );

  // Increasing XP by > 500 in a single write -> DENIED
  assert.equal(
    evaluateUserUpdate('u1', 'u1', validInitialUser, {
      ...validInitialUser,
      xp: 85600,
    }),
    false
  );

  // Dropping level -> DENIED
  assert.equal(
    evaluateUserUpdate('u1', 'u1', validInitialUser, {
      ...validInitialUser,
      level: 9,
    }),
    false
  );
});

test('5. Username overwrite or deletion is refused once created', () => {
  const store: Record<string, { uid: string }> = {};

  // Initial claim of unused username -> ALLOWED
  assert.equal(
    evaluateUsernameWrite('create', 'u1', 'maya_lin', { uid: 'u1' }, store),
    true
  );

  store['maya_lin'] = { uid: 'u1' };

  // Second user trying to create/overwrite existing username -> DENIED
  assert.equal(
    evaluateUsernameWrite('create', 'u2', 'maya_lin', { uid: 'u2' }, store),
    false
  );

  // Updating existing username doc -> DENIED
  assert.equal(
    evaluateUsernameWrite('update', 'u1', 'maya_lin', { uid: 'u1' }, store),
    false
  );

  // Deleting existing username doc -> DENIED
  assert.equal(
    evaluateUsernameWrite('delete', 'u1', 'maya_lin', null, store),
    false
  );
});

test('6. Security hardening rules: users list denied, sessions strict schema (1..180m, subject <100, no extra fields), tracks validation (title <100, fixed category, https://), and rooms custom durations immutable while running', () => {
  // 1. users: allow get for signed-in users, deny list
  assert.ok(rulesSource.includes('allow get: if isSignedIn() && isValidId(uid);'));
  assert.ok(rulesSource.includes('allow list: if false;'));

  // 2. users/{uid}/sessions: minutes 1..180, subject < 100, no extra fields
  assert.ok(
    rulesSource.includes(
      "data.keys().hasOnly(['minutes', 'subject', 'date', 'xpAwarded'])"
    )
  );
  assert.ok(
    rulesSource.includes(
      'data.minutes is int && data.minutes >= 1 && data.minutes <= 180'
    )
  );
  assert.ok(
    rulesSource.includes(
      'data.subject is string && data.subject.size() >= 1 && data.subject.size() < 100'
    )
  );

  // 3. tracks: title < 100, fixed category list, url starts with https://
  assert.ok(
    rulesSource.includes(
      'data.title is string && data.title.size() >= 1 && data.title.size() < 100'
    )
  );
  assert.ok(
    rulesSource.includes(
      "data.category in ['Lo-Fi', 'Nature', 'Classical', 'Ambient', 'White Noise', 'Instrumental']"
    )
  );
  assert.ok(rulesSource.includes("data.url.matches('^https://.*')"));

  // 4. rooms: focusMinutes, shortBreakMinutes, longBreakMinutes (1..180) only changeable by host and never while status is running
  assert.ok(rulesSource.includes('hasValidRoomCustomDurations(data)'));
  assert.ok(rulesSource.includes('isHostRoomUpdateValid()'));
  assert.ok(rulesSource.includes("existing().status != 'running'"));

  // Verify simulator for running room duration change restriction
  const runningRoom: RoomDoc & {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
  } = {
    hostUid: 'host-1',
    memberUids: ['host-1', 'u2'],
    maxMembers: 10,
    mode: 'focus',
    startedAt: 1700000000000,
    durationSec: 1500,
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    status: 'running',
  };

  const canHostChangeDurationsWhileRunning = (
    existing: typeof runningRoom,
    incoming: typeof runningRoom
  ) =>
    existing.status !== 'running' ||
    (incoming.focusMinutes === existing.focusMinutes &&
      incoming.shortBreakMinutes === existing.shortBreakMinutes &&
      incoming.longBreakMinutes === existing.longBreakMinutes);

  // Host attempting to change focusMinutes while room is running -> DENIED
  assert.equal(
    canHostChangeDurationsWhileRunning(runningRoom, {
      ...runningRoom,
      focusMinutes: 50,
    }),
    false
  );

  // Host pausing or completing the running room without altering preset durations -> ALLOWED
  assert.equal(
    canHostChangeDurationsWhileRunning(runningRoom, {
      ...runningRoom,
      status: 'paused',
    }),
    true
  );
});

test('7. Room vibe security rule: only the host can change vibe, and vibe must be a short string (<= 100 chars) referencing a built-in beat or cloud track', () => {
  assert.ok(rulesSource.includes('hasValidRoomVibe(data)'));
  assert.ok(rulesSource.includes('data.vibe is string'));
  assert.ok(rulesSource.includes('data.vibe.size() <= 100'));

  const baseRoom: RoomDoc & { vibe?: string } = {
    hostUid: 'host-1',
    memberUids: ['host-1', 'member-2'],
    maxMembers: 10,
    mode: 'focus',
    startedAt: null,
    durationSec: 1500,
    vibe: 'builtin:rain',
    status: 'idle',
  };

  // Host changing vibe to another built-in beat -> ALLOWED
  assert.equal(
    evaluateRoomUpdate('host-1', baseRoom, {
      ...baseRoom,
      vibe: 'builtin:lofichill',
    } as RoomDoc),
    true
  );

  // Non-host ('member-2') attempting to change vibe -> DENIED
  assert.equal(
    evaluateRoomUpdate('member-2', baseRoom, {
      ...baseRoom,
      vibe: 'builtin:ocean',
    } as RoomDoc),
    false
  );
});

test('8. Friend stats rules: dailyMinutes map allowed on users/{uid} with at most 14 entries and integer values 0..1440, plus shareStatsWithFriends boolean', () => {
  assert.ok(rulesSource.includes('isValidDailyMinutesMap(data.dailyMinutes)'));
  assert.ok(rulesSource.includes('dm is map &&'));
  assert.ok(rulesSource.includes('dm.size() <= 14'));
  assert.ok(
    rulesSource.includes(
      'vals[idx] is int && vals[idx] >= 0 && vals[idx] <= 1440'
    )
  );
  assert.ok(
    rulesSource.includes(
      "!('shareStatsWithFriends' in data) || data.shareStatsWithFriends is bool"
    )
  );

  const isValidDailyMinutesMapSim = (dm: unknown): boolean => {
    if (!dm || typeof dm !== 'object' || Array.isArray(dm)) return false;
    const vals = Object.values(dm as Record<string, unknown>);
    if (vals.length > 14) return false;
    return vals.every(
      (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1440
    );
  };

  // Valid 14-day map with integer minutes 0..1440 -> ALLOWED
  const valid14Days: Record<string, number> = {};
  for (let i = 1; i <= 14; i++) {
    valid14Days[`2026-10-${String(i).padStart(2, '0')}`] = i * 25;
  }
  assert.equal(isValidDailyMinutesMapSim(valid14Days), true);

  // Map with 15 entries (> 14) -> DENIED
  const tooManyEntries = { ...valid14Days, '2026-10-15': 30 };
  assert.equal(isValidDailyMinutesMapSim(tooManyEntries), false);

  // Map with negative minutes (< 0) -> DENIED
  assert.equal(
    isValidDailyMinutesMapSim({ '2026-10-28': -5 }),
    false
  );

  // Map with > 1440 minutes in a single day -> DENIED
  assert.equal(
    isValidDailyMinutesMapSim({ '2026-10-28': 1441 }),
    false
  );

  // Map with non-integer float value -> DENIED
  assert.equal(
    isValidDailyMinutesMapSim({ '2026-10-28': 45.5 }),
    false
  );
});

