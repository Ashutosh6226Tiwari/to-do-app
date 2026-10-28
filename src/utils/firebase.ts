import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  CloudAudioTrack,
  CloudUserDoc,
  FocusSessionRecord,
  FriendRequestItem,
  StudyRoomDoc,
  StudyTask,
  TimerMode,
  UserProfile,
} from '../types';
import {
  ALLOWED_TRACK_CATEGORIES,
  AllowedTrackCategory,
  buildDailyMinutesFromSessions,
  clampRoomCustomMinutes,
  formatDateKey,
  getIsoWeekKey,
  getLevelInfo,
  isValidHttpsAudioUrl,
  normalizeWeeklyMinutes,
  sanitizeAndTrimDailyMinutes,
  sanitizePlainText,
  sanitizeRoomVibe,
  updateDailyMinutesOnSessionComplete,
  validateUsername,
} from './focusLogic';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot as required by firebase-integration-rpc
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'tracks', '_connection_probe_'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGooglePopup() {
  return signInWithPopup(auth, googleProvider);
}

/**
 * Signs in an Admin user using Firebase Authentication Email/Password (signInWithEmailAndPassword).
 * No credentials are ever hardcoded; maps Firebase Auth error codes to clear messages.
 */
export async function signInAdminWithEmailPassword(
  email: string,
  password: string
) {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    throw new Error('Please enter both your admin email and password.');
  }
  try {
    return await signInWithEmailAndPassword(auth, trimmedEmail, password);
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/user-not-found' ||
      code === 'auth/wrong-password'
    ) {
      throw new Error('Invalid admin email or password. Please verify your credentials.');
    }
    if (code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Too many failed sign-in attempts. Please wait a moment and try again.');
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Email/Password sign-in is not enabled yet in Firebase Console (Authentication -> Sign-in method).'
      );
    }
    throw new Error(
      err instanceof Error ? err.message : 'Unable to sign in with Email and Password.'
    );
  }
}

export async function signOutUser() {
  return firebaseSignOut(auth);
}

/**
 * Checks whether a username is available in usernames/{usernameLower}.
 */
export async function checkUsernameAvailability(
  rawUsername: string
): Promise<{ available: boolean; normalized: string; error?: string }> {
  const validation = validateUsername(rawUsername);
  if (!validation.valid) {
    return {
      available: false,
      normalized: validation.usernameLower,
      error: validation.error,
    };
  }
  const path = `usernames/${validation.usernameLower}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', validation.usernameLower));
    if (snap.exists()) {
      const existingUid = snap.data()?.uid;
      if (existingUid && existingUid === auth.currentUser?.uid) {
        return { available: true, normalized: validation.usernameLower };
      }
      return {
        available: false,
        normalized: validation.usernameLower,
        error: 'That username is already taken. Try another one.',
      };
    }
    return { available: true, normalized: validation.usernameLower };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Claims a unique username in usernames/{usernameLower}, creates users/{uid},
 * and migrates existing localStorage data (tasks, sessions, XP, streak, settings) once.
 */
export async function claimUsernameAndInitializeCloudUser(params: {
  uid: string;
  displayName: string;
  photoURL: string;
  rawUsername: string;
  localProfile: UserProfile;
  localTasks: StudyTask[];
  localSessions: FocusSessionRecord[];
  currentStreak: number;
  longestStreak: number;
  totalMinutes: number;
  weeklyMinutes: number;
  studyingNow: boolean;
}): Promise<CloudUserDoc> {
  const {
    uid,
    displayName,
    photoURL,
    rawUsername,
    localProfile,
    localTasks,
    localSessions,
    currentStreak,
    longestStreak,
    totalMinutes,
    weeklyMinutes,
    studyingNow,
  } = params;

  const check = await checkUsernameAvailability(rawUsername);
  if (!check.available) {
    throw new Error(check.error || 'Username is not available.');
  }

  const todayKey = formatDateKey(new Date());
  const weekKey = getIsoWeekKey(new Date());
  const level = getLevelInfo(localProfile.totalXp).level;
  const nowIso = new Date().toISOString();

  const safeDisplayName =
    sanitizePlainText(displayName || localProfile.name || 'Student', 80) ||
    'Student';

  const dailyMinutes = buildDailyMinutesFromSessions(localSessions, todayKey);
  const shareStatsWithFriends = localProfile.shareStatsWithFriends !== false;

  const userDocData: Omit<CloudUserDoc, 'uid'> = {
    displayName: safeDisplayName,
    photoURL: (photoURL || '').slice(0, 500),
    username: sanitizePlainText(rawUsername.trim(), 20),
    xp: Math.max(0, Math.min(100000, Math.floor(localProfile.totalXp))),
    level: Math.max(1, level),
    currentStreak: Math.max(0, Math.min(3650, Math.floor(currentStreak))),
    longestStreak: Math.max(
      Math.max(0, Math.min(3650, Math.floor(currentStreak))),
      Math.max(0, Math.min(3650, Math.floor(longestStreak)))
    ),
    totalMinutes: Math.max(0, Math.min(5256000, Math.floor(totalMinutes))),
    weeklyMinutes: Math.max(0, Math.min(10080, Math.floor(weeklyMinutes))),
    weekKey,
    dailyMinutes,
    shareStatsWithFriends,
    studyingNow: Boolean(studyingNow),
    role: 'user',
    createdAt: nowIso,
  };

  const batch = writeBatch(db);
  const usernameRef = doc(db, 'usernames', check.normalized);
  const userRef = doc(db, 'users', uid);
  const privateAppStateRef = doc(db, 'users', uid, 'private', 'appState');

  batch.set(usernameRef, { uid });
  batch.set(userRef, userDocData);
  batch.set(privateAppStateRef, {
    tasks: localTasks.slice(0, 200),
    settings: localProfile.timerSettings,
    theme: localProfile.theme,
    dailyGoalHours: Math.max(
      0,
      Math.min(16, Number(localProfile.dailyGoalHours) || 0)
    ),
    shareStatsWithFriends,
  });

  // Migrate up to 25 recent local sessions into users/{uid}/sessions/{id}
  // Strictly only { minutes (1..180), subject (<100 chars), date, xpAwarded } - no extra fields
  const sessionsToMigrate = localSessions.slice(0, 25);
  for (const s of sessionsToMigrate) {
    const safeId = s.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
    const sessRef = doc(db, 'users', uid, 'sessions', safeId);
    const safeSubject =
      sanitizePlainText(s.subject || 'General Study', 99) || 'General Study';
    batch.set(sessRef, {
      minutes: Math.max(1, Math.min(180, Math.floor(s.durationMinutes))),
      subject: safeSubject,
      date: s.date.slice(0, 10),
      xpAwarded: Math.max(0, Math.min(500, Math.floor(s.xpEarned))),
    });
  }

  try {
    await batch.commit();
    localStorage.setItem(`focusflow_cloud_migrated_${uid}`, 'true');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  return { uid, ...userDocData };
}

/**
 * Syncs private appState (tasks, settings, theme, dailyGoalHours, shareStatsWithFriends) to users/{uid}/private/appState.
 */
export async function syncPrivateAppStateToCloud(
  uid: string,
  tasks: StudyTask[],
  profile: UserProfile
): Promise<void> {
  const path = `users/${uid}/private/appState`;
  try {
    await setDoc(doc(db, 'users', uid, 'private', 'appState'), {
      tasks: tasks.slice(0, 200),
      settings: profile.timerSettings,
      theme: profile.theme,
      dailyGoalHours: Math.max(
        0,
        Math.min(16, Number(profile.dailyGoalHours) || 0)
      ),
      shareStatsWithFriends: profile.shareStatsWithFriends !== false,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Updates user's public stats in users/{uid}, automatically resetting weeklyMinutes when weekKey changes,
 * updating and trimming dailyMinutes to the last 14 days (values 0..1440), and persisting shareStatsWithFriends.
 */
export async function updateCloudUserProgress(
  existingDoc: CloudUserDoc,
  updates: {
    displayName?: string;
    xpDelta?: number;
    addedMinutes?: number;
    sessionDateKey?: string;
    dailyMinutes?: Record<string, number>;
    shareStatsWithFriends?: boolean;
    currentStreak?: number;
    longestStreak?: number;
    studyingNow?: boolean;
  }
): Promise<void> {
  const todayKey = formatDateKey(new Date());
  const currentWeekKey = getIsoWeekKey(new Date());
  const normalizedWeek = normalizeWeeklyMinutes(
    existingDoc.weeklyMinutes,
    existingDoc.weekKey,
    currentWeekKey
  );

  const safeXpDelta = Math.max(
    0,
    Math.min(500, Math.floor(updates.xpDelta ?? 0))
  );
  const nextXp = existingDoc.xp + safeXpDelta;
  const nextLevel = Math.max(existingDoc.level, getLevelInfo(nextXp).level);
  const addedMins = Math.max(0, Math.floor(updates.addedMinutes ?? 0));
  const nextCurrentStreak = Math.max(
    0,
    Math.min(3650, Math.floor(updates.currentStreak ?? existingDoc.currentStreak))
  );

  const safeDisplayName =
    sanitizePlainText(updates.displayName || existingDoc.displayName, 80) ||
    existingDoc.displayName;

  const baseDailyMap = updates.dailyMinutes
    ? sanitizeAndTrimDailyMinutes(updates.dailyMinutes, todayKey)
    : sanitizeAndTrimDailyMinutes(existingDoc.dailyMinutes, todayKey);

  const nextDailyMinutes =
    addedMins > 0
      ? updateDailyMinutesOnSessionComplete(
          baseDailyMap,
          updates.sessionDateKey || todayKey,
          addedMins,
          todayKey
        )
      : baseDailyMap;

  const nextShareStats =
    updates.shareStatsWithFriends !== undefined
      ? Boolean(updates.shareStatsWithFriends)
      : existingDoc.shareStatsWithFriends !== false;

  const payload: Omit<CloudUserDoc, 'uid'> = {
    displayName: safeDisplayName,
    photoURL: existingDoc.photoURL,
    username: existingDoc.username,
    xp: nextXp,
    level: nextLevel,
    currentStreak: nextCurrentStreak,
    longestStreak: Math.max(
      existingDoc.longestStreak,
      updates.longestStreak ?? existingDoc.longestStreak,
      nextCurrentStreak
    ),
    totalMinutes: existingDoc.totalMinutes + addedMins,
    weeklyMinutes: Math.min(
      10080,
      normalizedWeek.weeklyMinutes + addedMins
    ),
    weekKey: currentWeekKey,
    dailyMinutes: nextDailyMinutes,
    shareStatsWithFriends: nextShareStats,
    studyingNow:
      updates.studyingNow !== undefined
        ? updates.studyingNow
        : existingDoc.studyingNow,
    role: existingDoc.role,
    createdAt: existingDoc.createdAt,
  };

  const path = `users/${existingDoc.uid}`;
  try {
    await setDoc(doc(db, 'users', existingDoc.uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Logs a completed focus session to users/{uid}/sessions/{sessionId}.
 * Strictly validates minutes (1..180), subject (<100 chars), date, xpAwarded, and no extra fields.
 */
export async function logCloudSession(
  uid: string,
  session: FocusSessionRecord
): Promise<void> {
  const safeId = session.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  const path = `users/${uid}/sessions/${safeId}`;
  const safeSubject =
    sanitizePlainText(session.subject || 'General Study', 99) ||
    'General Study';
  try {
    await setDoc(doc(db, 'users', uid, 'sessions', safeId), {
      minutes: Math.max(1, Math.min(180, Math.floor(session.durationMinutes))),
      subject: safeSubject,
      date: session.date.slice(0, 10),
      xpAwarded: Math.max(0, Math.min(500, Math.floor(session.xpEarned))),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Searches for a user by exact username (via usernames/{usernameLower} -> users/{uid}).
 * Uses getDoc by uid so enumeration/list on users is never required.
 */
export async function findUserByUsername(
  rawQuery: string
): Promise<CloudUserDoc | null> {
  const usernameLower = sanitizePlainText(rawQuery, 30)
    .toLowerCase()
    .replace(/^@/, '');
  if (!usernameLower || usernameLower.length < 3) return null;

  try {
    const unameSnap = await getDoc(doc(db, 'usernames', usernameLower));
    if (!unameSnap.exists()) return null;
    const targetUid = unameSnap.data()?.uid as string | undefined;
    if (!targetUid) return null;

    const userSnap = await getDoc(doc(db, 'users', targetUid));
    if (!userSnap.exists()) return null;
    return {
      uid: userSnap.id,
      ...(userSnap.data() as Omit<CloudUserDoc, 'uid'>),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `usernames/${usernameLower}`);
  }
}

/**
 * Sends a friend request stored at friendRequests/{fromUid_toUid}.
 * Prevents sending a request to yourself or creating a duplicate pending request.
 */
export async function sendCloudFriendRequest(
  me: CloudUserDoc,
  target: CloudUserDoc
): Promise<void> {
  if (me.uid === target.uid) {
    throw new Error('You cannot send a friend request to yourself.');
  }
  const requestId = `${me.uid}_${target.uid}`;
  const reverseId = `${target.uid}_${me.uid}`;
  const path = `friendRequests/${requestId}`;
  try {
    const [existingForward, existingReverse] = await Promise.all([
      getDoc(doc(db, 'friendRequests', requestId)),
      getDoc(doc(db, 'friendRequests', reverseId)),
    ]);

    if (existingForward.exists()) {
      const st = existingForward.data()?.status;
      if (st === 'pending') {
        throw new Error('A friend request to this student is already pending.');
      }
      if (st === 'accepted') {
        throw new Error('You are already friends with this student.');
      }
      // Clean up previous declined request before sending a fresh one
      await deleteDoc(doc(db, 'friendRequests', requestId));
    }

    if (existingReverse.exists()) {
      const revSt = existingReverse.data()?.status;
      if (revSt === 'pending') {
        throw new Error(
          `@${target.username} has already sent you a friend request! Check your incoming requests.`
        );
      }
      if (revSt === 'accepted') {
        throw new Error('You are already friends with this student.');
      }
    }

    await setDoc(doc(db, 'friendRequests', requestId), {
      fromUid: me.uid,
      toUid: target.uid,
      fromUsername: sanitizePlainText(me.username, 20),
      fromDisplayName: sanitizePlainText(me.displayName, 80),
      toUsername: sanitizePlainText(target.username, 20),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('already') || error.message.includes('yourself'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Accepts or declines a friend request. When accepted, updates status to 'accepted'
 * and creates friendships/{sortedUidA_sortedUidB} from the accepting user's side.
 */
export async function respondToCloudFriendRequest(
  request: FriendRequestItem,
  decision: 'accepted' | 'declined'
): Promise<void> {
  const reqPath = `friendRequests/${request.id}`;
  try {
    const batch = writeBatch(db);
    const reqRef = doc(db, 'friendRequests', request.id);
    batch.update(reqRef, { status: decision });

    if (decision === 'accepted') {
      const sorted = [request.fromUid, request.toUid].sort() as [string, string];
      const friendshipId = `${sorted[0]}_${sorted[1]}`;
      const friendshipRef = doc(db, 'friendships', friendshipId);
      batch.set(friendshipRef, {
        members: sorted,
        createdAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reqPath);
  }
}

/**
 * Removes a friendship document at friendships/{id}.
 */
export async function removeCloudFriendship(
  friendshipId: string
): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await deleteDoc(doc(db, 'friendships', friendshipId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Creates a new Study Room at rooms/{code} and registers the host in rooms/{code}/members/{uid}.
 */
export async function createCloudStudyRoom(
  code: string,
  host: CloudUserDoc,
  durationSec = 25 * 60,
  roomDurations?: {
    focusMinutes?: number;
    shortBreakMinutes?: number;
    longBreakMinutes?: number;
  }
): Promise<StudyRoomDoc> {
  const cleanCode = sanitizePlainText(code, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const focusMinutes = clampRoomCustomMinutes(
    roomDurations?.focusMinutes ?? Math.round(durationSec / 60)
  );
  const shortBreakMinutes = clampRoomCustomMinutes(
    roomDurations?.shortBreakMinutes ?? 5
  );
  const longBreakMinutes = clampRoomCustomMinutes(
    roomDurations?.longBreakMinutes ?? 15
  );
  const roomData: Omit<StudyRoomDoc, 'code'> = {
    hostUid: host.uid,
    memberUids: [host.uid],
    maxMembers: 10,
    mode: 'focus',
    startedAt: null,
    durationSec: Math.max(10, Math.min(10800, focusMinutes * 60)),
    focusMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    vibe: 'builtin:lofichill',
    status: 'idle',
    createdAt: new Date().toISOString(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'rooms', cleanCode), roomData);
    batch.set(doc(db, 'rooms', cleanCode, 'members', host.uid), {
      name: sanitizePlainText(host.displayName, 80) || 'Student',
      photoURL: (host.photoURL || '').slice(0, 500),
      status: 'idle',
      joinedAt: new Date().toISOString(),
    });
    await batch.commit();
    return { code: cleanCode, ...roomData };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rooms/${cleanCode}`);
  }
}

/**
 * Joins an existing Study Room by 6-character code (enforcing maxMembers: 10).
 */
export async function joinCloudStudyRoom(
  rawCode: string,
  member: CloudUserDoc
): Promise<StudyRoomDoc> {
  const cleanCode = sanitizePlainText(rawCode, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (cleanCode.length !== 6) {
    throw new Error('Room code must be 6 characters.');
  }
  const roomRef = doc(db, 'rooms', cleanCode);
  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) {
      throw new Error(`Study Room "${cleanCode}" was not found.`);
    }
    const data = snap.data() as Omit<StudyRoomDoc, 'code'>;
    const currentMembers = Array.isArray(data.memberUids) ? data.memberUids : [];
    if (!currentMembers.includes(member.uid)) {
      if (currentMembers.length >= (data.maxMembers || 10)) {
        throw new Error('This Study Room is full (max 10 members).');
      }
      const nextMembers = [...currentMembers, member.uid];
      await updateDoc(roomRef, { memberUids: nextMembers });
      data.memberUids = nextMembers;
    }

    await setDoc(doc(db, 'rooms', cleanCode, 'members', member.uid), {
      name: sanitizePlainText(member.displayName, 80) || 'Student',
      photoURL: (member.photoURL || '').slice(0, 500),
      status:
        data.status === 'running'
          ? data.mode === 'focus'
            ? 'focusing'
            : 'break'
          : 'idle',
      joinedAt: new Date().toISOString(),
    });

    return { code: cleanCode, ...data };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('not found') || error.message.includes('full'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `rooms/${cleanCode}`);
  }
}

/**
 * Leaves a Study Room and removes the member presence doc.
 */
export async function leaveCloudStudyRoom(
  code: string,
  uid: string,
  currentMemberUids: string[]
): Promise<void> {
  const cleanCode = sanitizePlainText(code, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  try {
    await deleteDoc(doc(db, 'rooms', cleanCode, 'members', uid));
    const remaining = currentMemberUids.filter((id) => id !== uid);
    if (remaining.length > 0) {
      await updateDoc(doc(db, 'rooms', cleanCode), { memberUids: remaining });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${cleanCode}`);
  }
}

/**
 * Host updates the shared Study Room timer (writing startedAt, durationSec, mode, status, and optional custom durations).
 * Enforces that focusMinutes, shortBreakMinutes, and longBreakMinutes cannot be changed while status is 'running'.
 */
export async function updateCloudRoomTimer(
  code: string,
  room: StudyRoomDoc,
  patch: {
    mode?: TimerMode;
    startedAt?: number | null;
    durationSec?: number;
    focusMinutes?: number;
    shortBreakMinutes?: number;
    longBreakMinutes?: number;
    vibe?: string;
    status?: 'idle' | 'running' | 'paused' | 'completed';
  }
): Promise<void> {
  const cleanCode = sanitizePlainText(code, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const isCurrentlyRunning = room.status === 'running';
  const focusMinutes = clampRoomCustomMinutes(
    isCurrentlyRunning
      ? room.focusMinutes ?? 25
      : patch.focusMinutes ?? room.focusMinutes ?? 25
  );
  const shortBreakMinutes = clampRoomCustomMinutes(
    isCurrentlyRunning
      ? room.shortBreakMinutes ?? 5
      : patch.shortBreakMinutes ?? room.shortBreakMinutes ?? 5
  );
  const longBreakMinutes = clampRoomCustomMinutes(
    isCurrentlyRunning
      ? room.longBreakMinutes ?? 15
      : patch.longBreakMinutes ?? room.longBreakMinutes ?? 15
  );
  const resolvedVibe =
    patch.vibe !== undefined
      ? sanitizeRoomVibe(patch.vibe)
      : sanitizeRoomVibe(room.vibe || '');

  const nextPayload: Omit<StudyRoomDoc, 'code'> = {
    hostUid: room.hostUid,
    memberUids: room.memberUids,
    maxMembers: 10,
    mode: patch.mode ?? room.mode,
    startedAt:
      patch.startedAt !== undefined ? patch.startedAt : room.startedAt,
    durationSec: Math.max(
      10,
      Math.min(10800, Math.round(patch.durationSec ?? room.durationSec))
    ),
    focusMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    vibe: resolvedVibe,
    status: patch.status ?? room.status,
  };
  if (room.createdAt) {
    nextPayload.createdAt = room.createdAt;
  }

  try {
    await setDoc(doc(db, 'rooms', cleanCode), nextPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${cleanCode}`);
  }
}

/**
 * Updates a member's own status in rooms/{code}/members/{uid}.
 */
export async function updateCloudRoomMemberStatus(
  code: string,
  member: { uid: string; name: string; photoURL: string; joinedAt: string },
  status: 'focusing' | 'break' | 'idle'
): Promise<void> {
  const cleanCode = sanitizePlainText(code, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const path = `rooms/${cleanCode}/members/${member.uid}`;
  try {
    await setDoc(doc(db, 'rooms', cleanCode, 'members', member.uid), {
      name: sanitizePlainText(member.name, 80) || 'Student',
      photoURL: (member.photoURL || '').slice(0, 500),
      status,
      joinedAt: member.joinedAt,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Admin CRUD for tracks/{id}.
 * Validates title (< 100 chars), category from ALLOWED_TRACK_CATEGORIES, and HTTPS audio URL.
 */
export async function saveCloudTrack(
  track: Omit<CloudAudioTrack, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  }
): Promise<CloudAudioTrack> {
  const safeTitle = sanitizePlainText(track.title, 99);
  if (!safeTitle) {
    throw new Error('Track title is required (max 99 characters).');
  }
  const safeCategory: AllowedTrackCategory = ALLOWED_TRACK_CATEGORIES.includes(
    track.category as AllowedTrackCategory
  )
    ? (track.category as AllowedTrackCategory)
    : 'Ambient';
  const trimmedUrl = track.url.trim();
  if (!isValidHttpsAudioUrl(trimmedUrl)) {
    throw new Error('Audio URL must be a valid https:// URL.');
  }

  const id = track.id || `track-${Date.now()}`;
  const createdAt = track.createdAt || new Date().toISOString();
  const payload = {
    title: safeTitle,
    category: safeCategory,
    url: trimmedUrl,
    createdAt,
  };
  try {
    await setDoc(doc(db, 'tracks', id), payload);
    return { id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tracks/${id}`);
  }
}

export async function deleteCloudTrack(trackId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tracks', trackId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tracks/${trackId}`);
  }
}

export { collection, doc, getDoc, getDocs };

