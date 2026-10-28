import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  BarChart3,
  Calendar,
  DoorOpen,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Pause,
  Pencil,
  Settings,
  ShieldAlert,
  Timer,
  Users,
} from 'lucide-react';
import {
  CloudAudioTrack,
  CloudUserDoc,
  FocusSessionRecord,
  FriendRequestItem,
  FriendshipItem,
  MoodThemeId,
  NavSection,
  PersistedTimerState,
  RoomMemberItem,
  StudyRoomDoc,
  StudyTask,
  TimerMode,
  TimerSettings,
  UserProfile,
} from './types';
import {
  addDays,
  buildDailyMinutesFromSessions,
  calculateSessionXP,
  clampRoomCustomMinutes,
  CompletedSessionOutcome,
  computeRemainingSeconds,
  computeStudyStats,
  createInitialTimerState,
  evaluateTimerTick,
  formatDailyGoalLabel,
  formatDateKey,
  formatTimeMMSS,
  generateRoomCode,
  getIsoWeekKey,
  getLevelInfo,
  getModeDurationMinutes,
  getModeDurationMs,
  isValidHttpsAudioUrl,
  normalizeWeeklyMinutes,
  pauseTimerState,
  resetTimerState,
  sanitizePlainText,
  startTimerState,
  switchTimerModeState,
} from './utils/focusLogic';
import {
  getInitialCloudTracks,
  getInitialProfile,
  getInitialSessions,
  getInitialTasks,
} from './utils/seedData';
import { MOOD_THEMES } from './utils/themes';
import { soundEngine } from './utils/soundEngine';
import {
  auth,
  claimUsernameAndInitializeCloudUser,
  createCloudStudyRoom,
  db,
  deleteCloudTrack,
  findUserByUsername,
  getDoc,
  handleFirestoreError,
  joinCloudStudyRoom,
  leaveCloudStudyRoom,
  logCloudSession,
  OperationType,
  removeCloudFriendship,
  respondToCloudFriendRequest,
  saveCloudTrack,
  sendCloudFriendRequest,
  signInAdminWithEmailPassword,
  signInWithGooglePopup,
  signOutUser,
  syncPrivateAppStateToCloud,
  updateCloudRoomMemberStatus,
  updateCloudRoomTimer,
  updateCloudUserProgress,
} from './utils/firebase';
import { MoodBackground } from './components/MoodBackground';
import { HeaderBar } from './components/HeaderBar';
import { PlannerView } from './components/PlannerView';
import { FocusView } from './components/FocusView';
import { FriendsView } from './components/FriendsView';
import { StudyRoomsView } from './components/StudyRoomsView';
import { AdminTracksView } from './components/AdminTracksView';
import { StatsView } from './components/StatsView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { DailyGoalModal } from './components/DailyGoalModal';
import {
  GoogleSignInScreen,
  UsernameClaimModal,
} from './components/AuthGateModal';
import {
  APP_FULL_TITLE,
  APP_NAME,
  buildLumoFaviconDataUri,
  LumoLogo,
  MadeByAshuWatermark,
} from './components/LumoLogo';

const STORAGE_KEYS = {
  PROFILE: 'focusflow_profile_v1',
  TASKS: 'focusflow_tasks_v1',
  SESSIONS: 'focusflow_sessions_v1',
  TIMER: 'focusflow_timer_state_v1',
  TRACKS: 'focusflow_tracks_v1',
  ROOM_AWARDED: 'focusflow_room_awarded_v1',
  LOCAL_BYPASS: 'focusflow_local_workspace_v1',
};

const MODE_LABELS: Record<TimerMode, string> = {
  focus: 'Focus Session',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

function getInitialDemoFriendsList(
  currentWeekKey: string,
  todayKey: string
): CloudUserDoc[] {
  return [
    {
      uid: 'demo-friend-1',
      displayName: 'Alex Chen',
      photoURL: '',
      username: 'alex_chen',
      xp: 490,
      level: 4,
      currentStreak: 6,
      longestStreak: 11,
      totalMinutes: 640,
      weeklyMinutes: 260,
      weekKey: currentWeekKey,
      dailyMinutes: {
        [todayKey]: 90,
        [addDays(todayKey, -1)]: 50,
        [addDays(todayKey, -2)]: 60,
        [addDays(todayKey, -3)]: 35,
        [addDays(todayKey, -4)]: 25,
        [addDays(todayKey, -5)]: 50,
        [addDays(todayKey, -6)]: 45,
        [addDays(todayKey, -8)]: 60,
        [addDays(todayKey, -10)]: 50,
      },
      shareStatsWithFriends: true,
      studyingNow: true,
      role: 'user',
      createdAt: '2026-10-01T10:00:00.000Z',
    },
    {
      uid: 'demo-friend-2',
      displayName: 'Priya Patel',
      photoURL: '',
      username: 'priya_patel',
      xp: 340,
      level: 3,
      currentStreak: 4,
      longestStreak: 8,
      totalMinutes: 480,
      weeklyMinutes: 195,
      weekKey: currentWeekKey,
      dailyMinutes: {
        [todayKey]: 60,
        [addDays(todayKey, -1)]: 45,
        [addDays(todayKey, -2)]: 40,
        [addDays(todayKey, -3)]: 50,
        [addDays(todayKey, -5)]: 35,
        [addDays(todayKey, -6)]: 30,
        [addDays(todayKey, -9)]: 50,
      },
      shareStatsWithFriends: true,
      studyingNow: false,
      role: 'user',
      createdAt: '2026-10-03T14:00:00.000Z',
    },
  ];
}

export default function App() {
  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const currentWeekKey = useMemo(() => getIsoWeekKey(new Date()), []);

  const [activeSection, setActiveSection] = useState<NavSection>('planner');

  // Firebase Auth & Cloud state
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [localWorkspaceBypass, setLocalWorkspaceBypass] = useState<boolean>(
    () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('autostart') === '1') return true;
        if (params.get('authgate') === '1') return false;
        const saved = localStorage.getItem(STORAGE_KEYS.LOCAL_BYPASS);
        if (saved === 'false') return false;
        return true;
      } catch {
        return true;
      }
    }
  );
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsUsernameClaim, setNeedsUsernameClaim] = useState(false);
  const [isClaimingUsername, setIsClaimingUsername] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name && MOOD_THEMES[parsed.theme as MoodThemeId]) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return getInitialProfile();
  });

  const [tasks, setTasks] = useState<StudyTask[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return getInitialTasks(todayKey);
  });

  const [sessions, setSessions] = useState<FocusSessionRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return getInitialSessions(todayKey);
  });

  // Global Persisted Timer State (survives tab switches and page refreshes)
  const [timerState, setTimerState] = useState<PersistedTimerState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TIMER);
      if (saved) {
        const parsed = JSON.parse(saved) as PersistedTimerState;
        if (
          parsed &&
          (parsed.mode === 'focus' ||
            parsed.mode === 'shortBreak' ||
            parsed.mode === 'longBreak') &&
          typeof parsed.remainingMsWhenPaused === 'number'
        ) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return createInitialTimerState(profile.timerSettings, 'task-1');
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    computeRemainingSeconds(timerState, Date.now())
  );

  const [lastCompletedToast, setLastCompletedToast] = useState<string | null>(
    null
  );

  const [levelUpBanner, setLevelUpBanner] = useState<{
    show: boolean;
    newLevel: number;
    title: string;
  } | null>(null);

  const stats = useMemo(
    () => computeStudyStats(sessions, todayKey),
    [sessions, todayKey]
  );

  // Cloud User Doc & Social / Room / Tracks State
  const [cloudUserDoc, setCloudUserDoc] = useState<CloudUserDoc | null>(null);
  const [isDailyGoalModalOpen, setIsDailyGoalModalOpen] = useState(false);
  const [friends, setFriends] = useState<CloudUserDoc[]>(() =>
    getInitialDemoFriendsList(currentWeekKey, todayKey)
  );
  const [friendships, setFriendships] = useState<FriendshipItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>(
    [
      {
        id: 'req-demo-1',
        fromUid: 'demo-user-sam',
        toUid: 'local-student',
        fromUsername: 'sam_rivera',
        fromDisplayName: 'Sam Rivera',
        toUsername: 'maya_lin',
        status: 'pending',
        createdAt: '2026-10-25T10:00:00.000Z',
      },
    ]
  );
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestItem[]>(
    []
  );

  const [activeRoom, setActiveRoom] = useState<StudyRoomDoc | null>(null);
  const [roomMembers, setRoomMembers] = useState<RoomMemberItem[]>([]);

  const [customTracks, setCustomTracks] = useState<CloudAudioTrack[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRACKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return getInitialCloudTracks();
  });

  // Track awarded runIds in memory as well as persisted lastCompletedRunId so XP is never awarded twice
  const awardedRunIdsRef = useRef<Set<string>>(
    new Set(timerState.lastCompletedRunId ? [timerState.lastCompletedRunId] : [])
  );

  const awardedRoomSessionsRef = useRef<Set<string>>((() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROOM_AWARDED);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return new Set<string>(arr);
      }
    } catch {
      // ignore
    }
    return new Set<string>();
  })());

  const localDailyMinutes = useMemo(
    () => buildDailyMinutesFromSessions(sessions, todayKey),
    [sessions, todayKey]
  );

  const localTotalMinutes = useMemo(
    () =>
      sessions.reduce(
        (acc, s) =>
          s.completed && s.mode === 'focus' && s.durationMinutes > 0
            ? acc + Math.floor(s.durationMinutes)
            : acc,
        0
      ),
    [sessions]
  );

  // Effective current user object (Cloud user doc when signed in, or local profile representation)
  const effectiveUserDoc: CloudUserDoc = useMemo(() => {
    if (cloudUserDoc) {
      const norm = normalizeWeeklyMinutes(
        cloudUserDoc.weeklyMinutes,
        cloudUserDoc.weekKey,
        currentWeekKey
      );
      return {
        ...cloudUserDoc,
        weeklyMinutes: norm.weeklyMinutes,
        weekKey: norm.weekKey,
        dailyMinutes:
          cloudUserDoc.dailyMinutes &&
          Object.keys(cloudUserDoc.dailyMinutes).length > 0
            ? cloudUserDoc.dailyMinutes
            : localDailyMinutes,
        shareStatsWithFriends:
          profile.shareStatsWithFriends !== undefined
            ? profile.shareStatsWithFriends
            : cloudUserDoc.shareStatsWithFriends !== false,
        studyingNow: timerState.isRunning && timerState.mode === 'focus',
      };
    }
    return {
      uid: firebaseUser?.uid || 'local-student',
      displayName: profile.name,
      photoURL: firebaseUser?.photoURL || '',
      username: 'maya_lin',
      xp: profile.totalXp,
      level: getLevelInfo(profile.totalXp).level,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      totalMinutes: Math.max(localTotalMinutes, stats.minutesThisMonth),
      weeklyMinutes: stats.minutesThisWeek,
      weekKey: currentWeekKey,
      dailyMinutes: localDailyMinutes,
      shareStatsWithFriends: profile.shareStatsWithFriends !== false,
      studyingNow: timerState.isRunning && timerState.mode === 'focus',
      role: 'user',
      createdAt: '2026-10-01T08:00:00.000Z',
    };
  }, [
    cloudUserDoc,
    currentWeekKey,
    firebaseUser,
    localDailyMinutes,
    localTotalMinutes,
    profile.name,
    profile.shareStatsWithFriends,
    profile.totalXp,
    stats.currentStreak,
    stats.longestStreak,
    stats.minutesThisMonth,
    stats.minutesThisWeek,
    timerState.isRunning,
    timerState.mode,
  ]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setCloudUserDoc(null);
        setNeedsUsernameClaim(false);
        setAuthLoading(false);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (!userSnap.exists()) {
          setNeedsUsernameClaim(true);
        } else {
          const data = userSnap.data() as Omit<CloudUserDoc, 'uid'>;
          setCloudUserDoc({ uid: user.uid, ...data });
          setNeedsUsernameClaim(false);
        }
      } catch {
        setNeedsUsernameClaim(true);
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time listeners when authenticated and user profile exists in Firestore
  useEffect(() => {
    if (!firebaseUser || needsUsernameClaim) return;

    const uid = firebaseUser.uid;

    // 1. Listen to users/{uid}
    const unsubUser = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Omit<CloudUserDoc, 'uid'>;
        const norm = normalizeWeeklyMinutes(
          data.weeklyMinutes,
          data.weekKey,
          currentWeekKey
        );
        const fullDoc: CloudUserDoc = {
          uid,
          ...data,
          weeklyMinutes: norm.weeklyMinutes,
          weekKey: norm.weekKey,
        };
        setCloudUserDoc(fullDoc);
        setProfile((prev) => ({
          ...prev,
          name: data.displayName || prev.name,
          totalXp: data.xp,
        }));

        // If weekKey changed, persist reset weeklyMinutes
        if (norm.didReset) {
          void updateCloudUserProgress(fullDoc, {});
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    );

    // 2. Listen to users/{uid}/private/appState
    const unsubPrivate = onSnapshot(
      doc(db, 'users', uid, 'private', 'appState'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as {
          tasks?: StudyTask[];
          settings?: TimerSettings;
          theme?: MoodThemeId;
          dailyGoalHours?: number;
          shareStatsWithFriends?: boolean;
        };
        if (Array.isArray(data.tasks)) {
          setTasks(data.tasks);
        }
        if (
          data.settings ||
          data.theme ||
          typeof data.dailyGoalHours === 'number' ||
          typeof data.shareStatsWithFriends === 'boolean'
        ) {
          setProfile((prev) => ({
            ...prev,
            theme: data.theme || prev.theme,
            timerSettings: data.settings || prev.timerSettings,
            dailyGoalHours:
              typeof data.dailyGoalHours === 'number'
                ? Math.max(0, Math.min(16, data.dailyGoalHours))
                : prev.dailyGoalHours,
            shareStatsWithFriends:
              typeof data.shareStatsWithFriends === 'boolean'
                ? data.shareStatsWithFriends
                : prev.shareStatsWithFriends,
          }));
        }
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.GET,
          `users/${uid}/private/appState`
        )
    );

    // 3. Listen to incoming & outgoing friendRequests
    const incomingQ = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', uid)
    );
    const unsubIncoming = onSnapshot(
      incomingQ,
      (snap) => {
        const list: FriendRequestItem[] = [];
        snap.forEach((d) => {
          const item = {
            id: d.id,
            ...(d.data() as Omit<FriendRequestItem, 'id'>),
          };
          if (item.status === 'pending') list.push(item);
        });
        setIncomingRequests(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendRequests')
    );

    const outgoingQ = query(
      collection(db, 'friendRequests'),
      where('fromUid', '==', uid)
    );
    const unsubOutgoing = onSnapshot(
      outgoingQ,
      (snap) => {
        const list: FriendRequestItem[] = [];
        snap.forEach((d) => {
          const item = {
            id: d.id,
            ...(d.data() as Omit<FriendRequestItem, 'id'>),
          };
          if (item.status === 'pending') list.push(item);
        });
        setOutgoingRequests(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendRequests')
    );

    // 4. Listen to friendships where members array-contains uid
    const friendshipsQ = query(
      collection(db, 'friendships'),
      where('members', 'array-contains', uid)
    );
    const unsubFriendships = onSnapshot(
      friendshipsQ,
      async (snap) => {
        const fsList: FriendshipItem[] = [];
        const friendUids: string[] = [];
        snap.forEach((d) => {
          const data = d.data() as {
            members: [string, string];
            createdAt: string;
          };
          fsList.push({ id: d.id, ...data });
          const otherUid = data.members.find((m) => m !== uid);
          if (otherUid) friendUids.push(otherUid);
        });
        setFriendships(fsList);

        const loadedFriends: CloudUserDoc[] = [];
        for (const fUid of friendUids) {
          try {
            const fSnap = await getDoc(doc(db, 'users', fUid));
            if (fSnap.exists()) {
              loadedFriends.push({
                uid: fSnap.id,
                ...(fSnap.data() as Omit<CloudUserDoc, 'uid'>),
              });
            }
          } catch {
            // ignore individual lookup error
          }
        }
        setFriends(loadedFriends);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );

    // 5. Listen to tracks collection
    const unsubTracks = onSnapshot(
      collection(db, 'tracks'),
      (snap) => {
        const list: CloudAudioTrack[] = [];
        snap.forEach((d) => {
          if (d.id === '_connection_probe_') return;
          list.push({
            id: d.id,
            ...(d.data() as Omit<CloudAudioTrack, 'id'>),
          });
        });
        if (list.length > 0) {
          setCustomTracks(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tracks')
    );

    return () => {
      unsubUser();
      unsubPrivate();
      unsubIncoming();
      unsubOutgoing();
      unsubFriendships();
      unsubTracks();
    };
  }, [firebaseUser, needsUsernameClaim, currentWeekKey]);

  // Real-time listeners for active Study Room and its members subcollection
  useEffect(() => {
    if (!activeRoom || !firebaseUser || needsUsernameClaim) return;
    const code = activeRoom.code;

    const unsubRoom = onSnapshot(
      doc(db, 'rooms', code),
      (snap) => {
        if (!snap.exists()) {
          setActiveRoom(null);
          setRoomMembers([]);
          return;
        }
        setActiveRoom({
          code: snap.id,
          ...(snap.data() as Omit<StudyRoomDoc, 'code'>),
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, `rooms/${code}`)
    );

    const unsubMembers = onSnapshot(
      collection(db, 'rooms', code, 'members'),
      (snap) => {
        const list: RoomMemberItem[] = [];
        snap.forEach((d) => {
          list.push({
            uid: d.id,
            ...(d.data() as Omit<RoomMemberItem, 'uid'>),
          });
        });
        setRoomMembers(list);
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `rooms/${code}/members`)
    );

    return () => {
      unsubRoom();
      unsubMembers();
    };
  }, [activeRoom?.code, firebaseUser, needsUsernameClaim]);

  // Persist local slices to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch {
      // ignore
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TIMER, JSON.stringify(timerState));
    } catch {
      // ignore
    }
  }, [timerState]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(customTracks));
    } catch {
      // ignore
    }
  }, [customTracks]);

  const themeConfig = MOOD_THEMES[profile.theme] || MOOD_THEMES.calm;
  const levelInfo = useMemo(
    () => getLevelInfo(profile.totalXp),
    [profile.totalXp]
  );

  // Sync studyingNow status to Firestore when timer starts/stops
  const prevStudyingNowRef = useRef<boolean>(false);
  useEffect(() => {
    const isStudyingNow =
      timerState.isRunning && timerState.mode === 'focus';
    if (
      cloudUserDoc &&
      firebaseUser &&
      !needsUsernameClaim &&
      prevStudyingNowRef.current !== isStudyingNow
    ) {
      prevStudyingNowRef.current = isStudyingNow;
      void updateCloudUserProgress(cloudUserDoc, {
        studyingNow: isStudyingNow,
      });
    }
  }, [
    timerState.isRunning,
    timerState.mode,
    cloudUserDoc,
    firebaseUser,
    needsUsernameClaim,
  ]);

  // Award XP & log session once only per unique runId
  const processCompletedSessionOutcome = useCallback(
    (outcome: CompletedSessionOutcome) => {
      if (awardedRunIdsRef.current.has(outcome.runId)) {
        return;
      }
      awardedRunIdsRef.current.add(outcome.runId);

      if (profile.timerSettings.soundAlertEnabled) {
        soundEngine.playAlert(profile.timerSettings.alertTone);
      }

      if (outcome.mode !== 'focus') {
        setLastCompletedToast(
          `${MODE_LABELS[outcome.mode]} complete! Ready for your next focus session.`
        );
        return;
      }

      const matchedTask = tasks.find((t) => t.id === outcome.taskId);
      const nextStreak = Math.max(1, stats.currentStreak);
      const xpEarned = calculateSessionXP(
        outcome.durationMinutes,
        true,
        'focus',
        nextStreak
      );

      setProfile((prev) => {
        const prevLevel = getLevelInfo(prev.totalXp).level;
        const nextTotalXp = prev.totalXp + xpEarned;
        const nextLevelObj = getLevelInfo(nextTotalXp);
        if (nextLevelObj.level > prevLevel) {
          setLevelUpBanner({
            show: true,
            newLevel: nextLevelObj.level,
            title: nextLevelObj.title,
          });
        }
        return {
          ...prev,
          totalXp: nextTotalXp,
        };
      });

      if (matchedTask) {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== matchedTask.id) return t;
            const nextDone = t.completedPomodoros + 1;
            return {
              ...t,
              completedPomodoros: nextDone,
              completed:
                nextDone >= t.estimatedPomodoros ? true : t.completed,
            };
          })
        );
      }

      const newRecord: FocusSessionRecord = {
        id: `sess-${Date.now()}-${outcome.runId}`,
        taskId: matchedTask?.id,
        taskTitle: matchedTask?.title || 'Focused Study Session',
        subject: matchedTask?.subject || 'General Study',
        date: todayKey,
        timestamp: new Date().toISOString(),
        durationMinutes: outcome.durationMinutes,
        mode: 'focus',
        completed: true,
        xpEarned,
      };

      setSessions((prev) => [newRecord, ...prev]);
      setLastCompletedToast(
        `Completed ${outcome.durationMinutes}m Focus Session (+${xpEarned} XP)!`
      );

      if (cloudUserDoc && firebaseUser && !needsUsernameClaim) {
        void updateCloudUserProgress(cloudUserDoc, {
          xpDelta: xpEarned,
          addedMinutes: outcome.durationMinutes,
          sessionDateKey: todayKey,
          currentStreak: nextStreak,
          longestStreak: Math.max(stats.longestStreak, nextStreak),
          studyingNow: false,
        });
        void logCloudSession(firebaseUser.uid, newRecord);
      }
    },
    [
      profile.timerSettings.soundAlertEnabled,
      profile.timerSettings.alertTone,
      tasks,
      stats.currentStreak,
      stats.longestStreak,
      todayKey,
      cloudUserDoc,
      firebaseUser,
      needsUsernameClaim,
    ]
  );

  // Evaluate timestamp-based timer on mount, every 250ms while running, and on visibilitychange
  const runTickCheck = useCallback(() => {
    const nowMs = Date.now();
    let effectiveState = timerState;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TIMER);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedTimerState;
        if (
          parsed &&
          parsed.activeRunId === timerState.activeRunId &&
          parsed.endTimestamp !== timerState.endTimestamp
        ) {
          effectiveState = parsed;
        }
      }
    } catch {
      // ignore
    }

    const result = evaluateTimerTick(
      effectiveState,
      profile.timerSettings,
      nowMs
    );
    setRemainingSeconds(result.remainingSeconds);

    if (
      result.nextState.mode !== timerState.mode ||
      result.nextState.isRunning !== timerState.isRunning ||
      result.nextState.endTimestamp !== timerState.endTimestamp ||
      result.nextState.lastCompletedRunId !== timerState.lastCompletedRunId
    ) {
      setTimerState(result.nextState);
    }

    if (result.completedSession) {
      processCompletedSessionOutcome(result.completedSession);
    }
  }, [timerState, profile.timerSettings, processCompletedSessionOutcome]);

  useEffect(() => {
    runTickCheck();
    if (!timerState.isRunning) return;

    const intervalId = window.setInterval(runTickCheck, 250);
    return () => window.clearInterval(intervalId);
  }, [timerState.isRunning, runTickCheck]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runTickCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', runTickCheck);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', runTickCheck);
    };
  }, [runTickCheck]);

  // Update browser tab title from the same timestamp-based remainingSeconds calculation
  useEffect(() => {
    const formatted = formatTimeMMSS(remainingSeconds);
    const selectedTask = tasks.find((t) => t.id === timerState.selectedTaskId);
    const taskPart = selectedTask ? ` · ${selectedTask.title}` : '';
    if (timerState.isRunning) {
      document.title = `(${formatted}) ${MODE_LABELS[timerState.mode]}${taskPart} — ${APP_NAME}`;
    } else {
      document.title = `${formatted} · ${APP_FULL_TITLE}`;
    }
  }, [
    remainingSeconds,
    timerState.isRunning,
    timerState.mode,
    timerState.selectedTaskId,
    tasks,
  ]);

  // Keep browser favicon synced with the Lumo SVG logo in the active mood theme accent color
  useEffect(() => {
    const faviconUri = buildLumoFaviconDataUri(themeConfig.accentHex);
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }
    link.href = faviconUri;
  }, [themeConfig.accentHex]);

  // Auth Handlers
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google sign-in popup was closed or blocked.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAdminEmailSignIn = async (email: string, password: string) => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInAdminWithEmailPassword(email, password);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to sign in with Email and Password.';
      setAuthError(msg);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleOpenSignInScreen = () => {
    setAuthError(null);
    setLocalWorkspaceBypass(false);
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_BYPASS, 'false');
    } catch {
      // ignore
    }
  };

  const handleClaimUsername = async (chosenUsername: string) => {
    if (!firebaseUser) return;
    setIsClaimingUsername(true);
    setClaimError(null);
    try {
      const created = await claimUsernameAndInitializeCloudUser({
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || profile.name,
        photoURL: firebaseUser.photoURL || '',
        rawUsername: chosenUsername,
        localProfile: profile,
        localTasks: tasks,
        localSessions: sessions,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        totalMinutes: stats.minutesThisMonth,
        weeklyMinutes: stats.minutesThisWeek,
        studyingNow: timerState.isRunning && timerState.mode === 'focus',
      });
      setCloudUserDoc(created);
      setNeedsUsernameClaim(false);
    } catch (err) {
      setClaimError(
        err instanceof Error ? err.message : 'Failed to claim username.'
      );
    } finally {
      setIsClaimingUsername(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch {
      // ignore
    }
    setCloudUserDoc(null);
    setLocalWorkspaceBypass(false);
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_BYPASS, 'false');
    } catch {
      // ignore
    }
  };

  const handleContinueLocalMode = () => {
    setLocalWorkspaceBypass(true);
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_BYPASS, 'true');
    } catch {
      // ignore
    }
  };

  const handleSaveDailyGoalHours = (nextGoalHours: number) => {
    const safeGoal = Math.max(0, Math.min(16, Number(nextGoalHours) || 0));
    setProfile((prev) => {
      const next = { ...prev, dailyGoalHours: safeGoal };
      syncTasksAndProfileIfNeeded(tasks, next);
      return next;
    });
  };

  // Global Timer Controls
  const handleStartPauseTimer = () => {
    const nowMs = Date.now();
    if (timerState.isRunning) {
      const paused = pauseTimerState(timerState, nowMs);
      setTimerState(paused);
      setRemainingSeconds(computeRemainingSeconds(paused, nowMs));
    } else {
      const started = startTimerState(timerState, nowMs);
      setTimerState(started);
      setRemainingSeconds(computeRemainingSeconds(started, nowMs));
    }
  };

  const handleResetTimer = () => {
    const nowMs = Date.now();
    const reset = resetTimerState(timerState, profile.timerSettings, nowMs);
    setTimerState(reset);
    setRemainingSeconds(computeRemainingSeconds(reset, nowMs));
  };

  const handleSwitchTimerMode = (nextMode: TimerMode) => {
    const nowMs = Date.now();
    const switched = switchTimerModeState(
      timerState,
      nextMode,
      profile.timerSettings,
      nowMs
    );
    setTimerState(switched);
    setRemainingSeconds(computeRemainingSeconds(switched, nowMs));
  };

  const handleSkipTimerSession = () => {
    const nextMode: TimerMode =
      timerState.mode === 'focus'
        ? (timerState.completedFocusCycleCount + 1) % 4 === 0
          ? 'longBreak'
          : 'shortBreak'
        : 'focus';
    handleSwitchTimerMode(nextMode);
  };

  const handleCompleteSessionNow = () => {
    const nowMs = Date.now();
    const forcedExpiredState: PersistedTimerState = {
      ...timerState,
      isRunning: true,
      endTimestamp: nowMs - 1000,
      activeRunId:
        timerState.lastCompletedRunId === timerState.activeRunId
          ? `run-${nowMs}-manual`
          : timerState.activeRunId,
    };
    const result = evaluateTimerTick(
      forcedExpiredState,
      profile.timerSettings,
      nowMs
    );
    setTimerState(result.nextState);
    setRemainingSeconds(result.remainingSeconds);
    if (result.completedSession) {
      processCompletedSessionOutcome(result.completedSession);
    }
  };

  const handleSelectFocusTaskId = (taskId: string | null) => {
    setTimerState((prev) => ({
      ...prev,
      selectedTaskId: taskId,
    }));
  };

  // Sync helper for tasks/settings
  const syncTasksAndProfileIfNeeded = (
    nextTasks: StudyTask[],
    nextProfile: UserProfile
  ) => {
    if (firebaseUser && !needsUsernameClaim) {
      void syncPrivateAppStateToCloud(firebaseUser.uid, nextTasks, nextProfile);
    }
  };

  // Task handlers
  const handleAddTask = (
    newTaskData: Omit<StudyTask, 'id' | 'completedPomodoros'>
  ) => {
    const newTask: StudyTask = {
      ...newTaskData,
      title: sanitizePlainText(newTaskData.title, 120) || 'Study Task',
      subject: sanitizePlainText(newTaskData.subject, 99) || 'General Study',
      notes: newTaskData.notes
        ? sanitizePlainText(newTaskData.notes, 500)
        : undefined,
      id: `task-${Date.now()}`,
      completedPomodoros: 0,
    };
    setTasks((prev) => {
      const next = [newTask, ...prev];
      syncTasksAndProfileIfNeeded(next, profile);
      return next;
    });
  };

  const handleAddMultipleTasks = (
    items: Array<Omit<StudyTask, 'id' | 'completedPomodoros'>>
  ) => {
    const created: StudyTask[] = items.map((item, idx) => ({
      ...item,
      title: sanitizePlainText(item.title, 120) || 'Study Task',
      subject: sanitizePlainText(item.subject, 99) || 'General Study',
      notes: item.notes ? sanitizePlainText(item.notes, 500) : undefined,
      id: `task-${Date.now()}-${idx}`,
      completedPomodoros: 0,
    }));
    setTasks((prev) => {
      const next = [...created, ...prev];
      syncTasksAndProfileIfNeeded(next, profile);
      return next;
    });
  };

  const handleUpdateTask = (updated: StudyTask) => {
    const sanitizedUpdated: StudyTask = {
      ...updated,
      title: sanitizePlainText(updated.title, 120) || 'Study Task',
      subject: sanitizePlainText(updated.subject, 99) || 'General Study',
      notes: updated.notes ? sanitizePlainText(updated.notes, 500) : undefined,
    };
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === sanitizedUpdated.id ? sanitizedUpdated : t
      );
      syncTasksAndProfileIfNeeded(next, profile);
      return next;
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId);
      syncTasksAndProfileIfNeeded(next, profile);
      return next;
    });
    if (timerState.selectedTaskId === taskId) {
      handleSelectFocusTaskId(null);
    }
  };

  const handleToggleTaskComplete = (taskId: string) => {
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      syncTasksAndProfileIfNeeded(next, profile);
      return next;
    });
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) => {
      const next = prev.map((t) => {
        if (t.id !== taskId || !t.subtasks) return t;
        return {
          ...t,
          subtasks: t.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          ),
        };
      });
      syncTasksAndProfileIfNeeded(next, profile);
      return next;
    });
  };

  const handleStartFocusTask = (taskId: string) => {
    handleSelectFocusTaskId(taskId);
    setActiveSection('focus');
  };

  const handleSelectTheme = (theme: MoodThemeId) => {
    setProfile((prev) => {
      const next = { ...prev, theme };
      syncTasksAndProfileIfNeeded(tasks, next);
      return next;
    });
  };

  const handleUpdateTimerSettings = (timerSettings: TimerSettings) => {
    setProfile((prev) => {
      const next = { ...prev, timerSettings };
      syncTasksAndProfileIfNeeded(tasks, next);
      return next;
    });
    if (!timerState.isRunning) {
      const nextDurationMs = getModeDurationMs(timerState.mode, timerSettings);
      setTimerState((prev) => ({
        ...prev,
        remainingMsWhenPaused: nextDurationMs,
      }));
      setRemainingSeconds(Math.ceil(nextDurationMs / 1000));
    }
  };

  // Friends handlers (Cloud + Local Workspace support)
  const handleSearchUsername = async (
    queryUsername: string
  ): Promise<CloudUserDoc | null> => {
    const clean = queryUsername.trim().toLowerCase().replace(/^@/, '');
    if (firebaseUser && !needsUsernameClaim) {
      return findUserByUsername(clean);
    }
    const existingFriend = friends.find(
      (f) => f.username.toLowerCase() === clean
    );
    if (existingFriend) return existingFriend;
    const directory: Record<string, CloudUserDoc> = {
      sam_rivera: {
        uid: 'demo-user-sam',
        displayName: 'Sam Rivera',
        photoURL: '',
        username: 'sam_rivera',
        xp: 410,
        level: 3,
        currentStreak: 5,
        longestStreak: 9,
        totalMinutes: 510,
        weeklyMinutes: 215,
        weekKey: currentWeekKey,
        dailyMinutes: {
          [todayKey]: 45,
          [addDays(todayKey, -1)]: 50,
          [addDays(todayKey, -2)]: 40,
          [addDays(todayKey, -3)]: 30,
          [addDays(todayKey, -4)]: 50,
        },
        shareStatsWithFriends: true,
        studyingNow: true,
        role: 'user',
        createdAt: '2026-10-05T12:00:00.000Z',
      },
      jordan_lee: {
        uid: 'demo-user-jordan',
        displayName: 'Jordan Lee',
        photoURL: '',
        username: 'jordan_lee',
        xp: 620,
        level: 4,
        currentStreak: 8,
        longestStreak: 14,
        totalMinutes: 890,
        weeklyMinutes: 310,
        weekKey: currentWeekKey,
        dailyMinutes: {
          [todayKey]: 75,
          [addDays(todayKey, -1)]: 60,
          [addDays(todayKey, -2)]: 50,
          [addDays(todayKey, -3)]: 45,
          [addDays(todayKey, -4)]: 40,
          [addDays(todayKey, -5)]: 40,
        },
        shareStatsWithFriends: true,
        studyingNow: false,
        role: 'user',
        createdAt: '2026-10-02T12:00:00.000Z',
      },
    };
    return directory[clean] || null;
  };

  const handleSendFriendRequest = async (targetUser: CloudUserDoc) => {
    if (firebaseUser && !needsUsernameClaim) {
      await sendCloudFriendRequest(effectiveUserDoc, targetUser);
      return;
    }
    const newReq: FriendRequestItem = {
      id: `req-${Date.now()}`,
      fromUid: effectiveUserDoc.uid,
      toUid: targetUser.uid,
      fromUsername: effectiveUserDoc.username,
      fromDisplayName: effectiveUserDoc.displayName,
      toUsername: targetUser.username,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setOutgoingRequests((prev) => [newReq, ...prev]);
  };

  const handleRespondFriendRequest = async (
    request: FriendRequestItem,
    decision: 'accepted' | 'declined'
  ) => {
    if (firebaseUser && !needsUsernameClaim) {
      await respondToCloudFriendRequest(request, decision);
      return;
    }
    setIncomingRequests((prev) => prev.filter((r) => r.id !== request.id));
    if (decision === 'accepted') {
      const addedFriend: CloudUserDoc = {
        uid: request.fromUid,
        displayName: request.fromDisplayName || request.fromUsername || 'Friend',
        photoURL: '',
        username: request.fromUsername || 'study_friend',
        xp: 410,
        level: 3,
        currentStreak: 5,
        longestStreak: 9,
        totalMinutes: 510,
        weeklyMinutes: 215,
        weekKey: currentWeekKey,
        dailyMinutes: {
          [todayKey]: 45,
          [addDays(todayKey, -1)]: 50,
          [addDays(todayKey, -2)]: 40,
          [addDays(todayKey, -3)]: 30,
          [addDays(todayKey, -4)]: 50,
        },
        shareStatsWithFriends: true,
        studyingNow: true,
        role: 'user',
        createdAt: new Date().toISOString(),
      };
      setFriends((prev) =>
        prev.some((f) => f.uid === addedFriend.uid)
          ? prev
          : [...prev, addedFriend]
      );
    }
  };

  const handleRemoveFriend = async (friendUid: string) => {
    if (firebaseUser && !needsUsernameClaim) {
      const match = friendships.find((fs) => fs.members.includes(friendUid));
      if (match) {
        await removeCloudFriendship(match.id);
      }
      return;
    }
    setFriends((prev) => prev.filter((f) => f.uid !== friendUid));
  };

  // Study Rooms handlers (Cloud + Local Workspace support)
  const handleCreateRoom = async (
    durationMinutes: number,
    roomDurations?: {
      focusMinutes: number;
      shortBreakMinutes: number;
      longBreakMinutes: number;
    }
  ) => {
    const code = generateRoomCode();
    const focusMinutes = clampRoomCustomMinutes(
      roomDurations?.focusMinutes ?? durationMinutes
    );
    const shortBreakMinutes = clampRoomCustomMinutes(
      roomDurations?.shortBreakMinutes ?? 5
    );
    const longBreakMinutes = clampRoomCustomMinutes(
      roomDurations?.longBreakMinutes ?? 15
    );
    const durationSec = focusMinutes * 60;
    if (firebaseUser && !needsUsernameClaim) {
      const created = await createCloudStudyRoom(
        code,
        effectiveUserDoc,
        durationSec,
        {
          focusMinutes,
          shortBreakMinutes,
          longBreakMinutes,
        }
      );
      setActiveRoom(created);
      setRoomMembers([
        {
          uid: effectiveUserDoc.uid,
          name: effectiveUserDoc.displayName,
          photoURL: effectiveUserDoc.photoURL,
          status: 'idle',
          joinedAt: new Date().toISOString(),
        },
      ]);
      return;
    }
    setActiveRoom({
      code,
      hostUid: effectiveUserDoc.uid,
      memberUids: [effectiveUserDoc.uid],
      maxMembers: 10,
      mode: 'focus',
      startedAt: null,
      durationSec,
      focusMinutes,
      shortBreakMinutes,
      longBreakMinutes,
      vibe: 'builtin:lofichill',
      status: 'idle',
      createdAt: new Date().toISOString(),
    });
    setRoomMembers([
      {
        uid: effectiveUserDoc.uid,
        name: effectiveUserDoc.displayName,
        photoURL: effectiveUserDoc.photoURL,
        status: 'idle',
        joinedAt: new Date().toISOString(),
      },
    ]);
  };

  const handleJoinRoom = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (firebaseUser && !needsUsernameClaim) {
      const joined = await joinCloudStudyRoom(code, effectiveUserDoc);
      setActiveRoom(joined);
      return;
    }
    setActiveRoom({
      code,
      hostUid: effectiveUserDoc.uid,
      memberUids: [effectiveUserDoc.uid, 'demo-friend-1'],
      maxMembers: 10,
      mode: 'focus',
      startedAt: Date.now() - 30_000,
      durationSec: 25 * 60,
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      vibe: 'builtin:lofichill',
      status: 'running',
      createdAt: new Date().toISOString(),
    });
    setRoomMembers([
      {
        uid: effectiveUserDoc.uid,
        name: effectiveUserDoc.displayName,
        photoURL: effectiveUserDoc.photoURL,
        status: 'focusing',
        joinedAt: new Date().toISOString(),
      },
      {
        uid: 'demo-friend-1',
        name: 'Alex Chen',
        photoURL: '',
        status: 'focusing',
        joinedAt: new Date().toISOString(),
      },
    ]);
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom) return;
    if (firebaseUser && !needsUsernameClaim) {
      await leaveCloudStudyRoom(
        activeRoom.code,
        effectiveUserDoc.uid,
        activeRoom.memberUids
      );
    }
    setActiveRoom(null);
    setRoomMembers([]);
  };

  const handleHostUpdateRoomTimer = async (patch: {
    mode?: TimerMode;
    startedAt?: number | null;
    durationSec?: number;
    focusMinutes?: number;
    shortBreakMinutes?: number;
    longBreakMinutes?: number;
    vibe?: string;
    status?: 'idle' | 'running' | 'paused' | 'completed';
  }) => {
    if (!activeRoom) return;
    if (firebaseUser && !needsUsernameClaim) {
      await updateCloudRoomTimer(activeRoom.code, activeRoom, patch);
      return;
    }
    setActiveRoom((prev) => (prev ? { ...prev, ...patch } : null));
  };

  const handleUpdateMyRoomMemberStatus = async (
    status: 'focusing' | 'break' | 'idle'
  ) => {
    if (!activeRoom) return;
    const existingMe = roomMembers.find((m) => m.uid === effectiveUserDoc.uid);
    const joinedAt = existingMe?.joinedAt || new Date().toISOString();
    if (firebaseUser && !needsUsernameClaim) {
      await updateCloudRoomMemberStatus(
        activeRoom.code,
        {
          uid: effectiveUserDoc.uid,
          name: effectiveUserDoc.displayName,
          photoURL: effectiveUserDoc.photoURL,
          joinedAt,
        },
        status
      );
      return;
    }
    setRoomMembers((prev) =>
      prev.map((m) =>
        m.uid === effectiveUserDoc.uid ? { ...m, status } : m
      )
    );
  };

  const handleCompleteRoomSessionAwardXp = useCallback(
    (
      roomCode: string,
      startedAtMs: number,
      durationMinutes: number,
      mode: TimerMode
    ) => {
      const awardKey = `${roomCode}_${startedAtMs}`;
      if (awardedRoomSessionsRef.current.has(awardKey)) {
        return;
      }
      awardedRoomSessionsRef.current.add(awardKey);
      try {
        localStorage.setItem(
          STORAGE_KEYS.ROOM_AWARDED,
          JSON.stringify(Array.from(awardedRoomSessionsRef.current))
        );
      } catch {
        // ignore
      }

      processCompletedSessionOutcome({
        runId: `room-${awardKey}`,
        mode,
        durationMinutes,
        taskId: timerState.selectedTaskId,
      });
    },
    [processCompletedSessionOutcome, timerState.selectedTaskId]
  );

  // Admin Tracks handlers
  const handleSaveTrack = async (
    trackInput: Omit<CloudAudioTrack, 'id' | 'createdAt'> & {
      id?: string;
      createdAt?: string;
    }
  ) => {
    const safeTitle = sanitizePlainText(trackInput.title, 99);
    const trimmedUrl = trackInput.url.trim();
    if (!safeTitle || !isValidHttpsAudioUrl(trimmedUrl)) {
      throw new Error('Invalid track title or non-HTTPS audio URL.');
    }
    if (firebaseUser && !needsUsernameClaim) {
      await saveCloudTrack({
        ...trackInput,
        title: safeTitle,
        url: trimmedUrl,
      });
      return;
    }
    const id = trackInput.id || `track-${Date.now()}`;
    const createdAt = trackInput.createdAt || new Date().toISOString();
    const item: CloudAudioTrack = {
      id,
      title: safeTitle,
      category: sanitizePlainText(trackInput.category, 50) || 'Ambient',
      url: trimmedUrl,
      createdAt,
    };
    setCustomTracks((prev) => {
      const exists = prev.some((t) => t.id === id);
      return exists
        ? prev.map((t) => (t.id === id ? item : t))
        : [item, ...prev];
    });
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (firebaseUser && !needsUsernameClaim) {
      await deleteCloudTrack(trackId);
      return;
    }
    setCustomTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handleResetDemoData = () => {
    const freshProfile = getInitialProfile();
    const freshTasks = getInitialTasks(todayKey);
    const freshSessions = getInitialSessions(todayKey);
    const freshTimer = createInitialTimerState(
      freshProfile.timerSettings,
      'task-1'
    );
    setProfile(freshProfile);
    setTasks(freshTasks);
    setSessions(freshSessions);
    setTimerState(freshTimer);
    setRemainingSeconds(computeRemainingSeconds(freshTimer, Date.now()));
  };

  // Suppress unused import lint
  void getModeDurationMinutes;

  const isAdmin = effectiveUserDoc.role === 'admin';

  const navItems: Array<{
    id: NavSection;
    label: string;
    mobileLabel: string;
    Icon: typeof Calendar;
  }> = [
    { id: 'planner', label: 'Planner', mobileLabel: 'Planner', Icon: Calendar },
    { id: 'focus', label: 'Focus', mobileLabel: 'Focus', Icon: Timer },
    { id: 'friends', label: 'Friends', mobileLabel: 'Friends', Icon: Users },
    {
      id: 'rooms',
      label: 'Study Rooms',
      mobileLabel: 'Rooms',
      Icon: DoorOpen,
    },
    { id: 'stats', label: 'Stats', mobileLabel: 'Stats', Icon: BarChart3 },
    {
      id: 'settings',
      label: 'Profile & Settings',
      mobileLabel: 'Settings',
      Icon: Settings,
    },
    ...(isAdmin
      ? [
          {
            id: 'admin' as NavSection,
            label: 'Admin Panel',
            mobileLabel: 'Admin',
            Icon: ShieldAlert,
          },
        ]
      : []),
  ];

  const showFloatingMiniTimer =
    timerState.isRunning && activeSection !== 'focus';

  // 1. Clear Loading State while Firebase Auth resolves
  if (authLoading && !localWorkspaceBypass) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          themeConfig.isDark ? 'dark' : ''
        } ${themeConfig.textPrimaryClass}`}
        style={{ fontFamily: themeConfig.fontBody }}
      >
        <MoodBackground theme={profile.theme} />
        <div
          className={`relative z-20 p-8 rounded-3xl flex flex-col items-center gap-3 ${themeConfig.glassCardClass}`}
        >
          <LumoLogo
            themeConfig={themeConfig}
            variant="icon"
            size="lg"
            dataTestId="loading-brand-logo"
          />
          <Loader2
            className="w-6 h-6 animate-spin"
            style={{ color: themeConfig.accentHex }}
          />
          <p className="text-sm font-semibold">Loading {APP_NAME} Cloud...</p>
        </div>
      </div>
    );
  }

  // 2. Google Sign-In Gate (when unauthenticated and not in local workspace preview)
  if (!firebaseUser && !localWorkspaceBypass) {
    return (
      <div
        className={`min-h-screen ${
          themeConfig.isDark ? 'dark' : ''
        } ${themeConfig.textPrimaryClass}`}
        style={{ fontFamily: themeConfig.fontBody }}
      >
        <MoodBackground theme={profile.theme} />
        <GoogleSignInScreen
          themeConfig={themeConfig}
          isSigningIn={isSigningIn}
          authError={authError}
          onGoogleSignIn={handleGoogleSignIn}
          onAdminEmailSignIn={handleAdminEmailSignIn}
          onContinueLocalMode={handleContinueLocalMode}
        />
      </div>
    );
  }

  const dailyGoalProgressPercent =
    profile.dailyGoalHours > 0
      ? Math.min(
          100,
          Math.round((stats.hoursToday / profile.dailyGoalHours) * 100)
        )
      : 100;

  return (
    <div
      className={`min-h-screen flex flex-col md:flex-row ${
        themeConfig.isDark ? 'dark' : ''
      } ${themeConfig.textPrimaryClass}`}
      style={{ fontFamily: themeConfig.fontBody }}
    >
      <MoodBackground theme={profile.theme} />

      {/* Daily Goal Dialog */}
      <DailyGoalModal
        isOpen={isDailyGoalModalOpen}
        currentGoalHours={profile.dailyGoalHours}
        themeConfig={themeConfig}
        onClose={() => setIsDailyGoalModalOpen(false)}
        onSaveGoalHours={handleSaveDailyGoalHours}
      />

      {/* First-Login Unique Username Claim Modal */}
      {firebaseUser && needsUsernameClaim && (
        <UsernameClaimModal
          displayName={firebaseUser.displayName || profile.name}
          email={firebaseUser.email || ''}
          themeConfig={themeConfig}
          isSubmitting={isClaimingUsername}
          error={claimError}
          onClaimUsername={handleClaimUsername}
          onSignOut={handleSignOut}
        />
      )}

      {/* Desktop Sidebar Navigation */}
      <aside
        aria-label="Desktop sidebar navigation"
        className={`hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-40 p-5 ${themeConfig.glassCardClass} rounded-none border-y-0 border-l-0`}
      >
        {/* Brand Wordmark */}
        <div className="flex items-center justify-between gap-2 px-2 py-2 mb-6">
          <LumoLogo
            themeConfig={themeConfig}
            variant="wide"
            size="md"
            dataTestId="sidebar-brand-logo"
          />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5" aria-label="Main sections">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  active
                    ? themeConfig.activeTabClass
                    : `${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </span>
                {id === 'focus' && timerState.isRunning && !active && (
                  <span className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/15">
                    {formatTimeMMSS(remainingSeconds)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Sidebar Summary & Cloud Auth Action */}
        <div className="mt-auto space-y-3">
          <div
            className={`p-3.5 rounded-xl border ${themeConfig.borderClass} bg-white/30 dark:bg-slate-900/30`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-semibold">
              <span className={`whitespace-nowrap ${themeConfig.textPrimaryClass}`}>
                Daily Goal
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  data-testid="sidebar-daily-goal-text"
                  className={`font-mono tabular-nums whitespace-nowrap ${themeConfig.textSecondaryClass}`}
                >
                  {stats.hoursToday}h /{' '}
                  {formatDailyGoalLabel(profile.dailyGoalHours)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsDailyGoalModalOpen(true)}
                  aria-label="Set daily goal"
                  data-testid="sidebar-edit-daily-goal"
                  className={`p-1 rounded-lg border transition-all ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden mt-2">
              <div
                data-testid="sidebar-daily-goal-bar"
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${dailyGoalProgressPercent}%`,
                  backgroundColor: themeConfig.accentHex,
                }}
              />
            </div>
          </div>

          {firebaseUser ? (
            <button
              type="button"
              onClick={handleSignOut}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out (@{effectiveUserDoc.username})</span>
            </button>
          ) : (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 ${themeConfig.buttonBgClass}`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>
                  {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleOpenSignInScreen}
                className={`w-full py-1.5 px-3 rounded-xl text-[11px] font-semibold border flex items-center justify-center gap-1.5 ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
              >
                <KeyRound className="w-3 h-3" />
                <span>Admin Login</span>
              </button>
            </div>
          )}

          {/* Subtle desktop sidebar credit watermark */}
          <div className={`pt-2 border-t ${themeConfig.borderClass} flex justify-center`}>
            <MadeByAshuWatermark
              themeConfig={themeConfig}
              dataTestId="sidebar-watermark"
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen pb-24 md:pb-8">
        <HeaderBar
          studentName={profile.name}
          levelInfo={levelInfo}
          currentStreak={stats.currentStreak}
          themeConfig={themeConfig}
          onSelectTheme={handleSelectTheme}
          levelUpBanner={levelUpBanner}
          onDismissLevelUp={() => setLevelUpBanner(null)}
          showMiniTimer={showFloatingMiniTimer}
          miniTimerMode={timerState.mode}
          miniTimerRemainingSeconds={remainingSeconds}
          onJumpToFocus={() => setActiveSection('focus')}
          onPauseMiniTimer={handleStartPauseTimer}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
          {activeSection === 'planner' && (
            <PlannerView
              tasks={tasks}
              todayKey={todayKey}
              themeConfig={themeConfig}
              onAddTask={handleAddTask}
              onAddMultipleTasks={handleAddMultipleTasks}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onToggleTaskComplete={handleToggleTaskComplete}
              onStartFocusTask={handleStartFocusTask}
            />
          )}

          {activeSection === 'focus' && (
            <FocusView
              tasks={tasks}
              timerState={timerState}
              remainingSeconds={remainingSeconds}
              timerSettings={profile.timerSettings}
              onStartPause={handleStartPauseTimer}
              onReset={handleResetTimer}
              onSkip={handleSkipTimerSession}
              onCompleteSessionNow={handleCompleteSessionNow}
              onSwitchMode={handleSwitchTimerMode}
              onSelectTaskId={handleSelectFocusTaskId}
              onUpdateTimerSettings={handleUpdateTimerSettings}
              themeConfig={themeConfig}
              onSelectTheme={handleSelectTheme}
              onToggleSubtask={handleToggleSubtask}
              lastCompletedToast={lastCompletedToast}
              onDismissToast={() => setLastCompletedToast(null)}
              customTracks={customTracks}
            />
          )}

          {activeSection === 'friends' && (
            <FriendsView
              currentUser={effectiveUserDoc}
              friends={friends}
              friendships={friendships}
              incomingRequests={incomingRequests}
              outgoingRequests={outgoingRequests}
              themeConfig={themeConfig}
              isCloudConnected={Boolean(firebaseUser && !needsUsernameClaim)}
              todayKey={todayKey}
              onSearchUsername={handleSearchUsername}
              onSendFriendRequest={handleSendFriendRequest}
              onRespondRequest={handleRespondFriendRequest}
              onRemoveFriend={handleRemoveFriend}
            />
          )}

          {activeSection === 'rooms' && (
            <StudyRoomsView
              currentUser={effectiveUserDoc}
              activeRoom={activeRoom}
              roomMembers={roomMembers}
              themeConfig={themeConfig}
              customTracks={customTracks}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onLeaveRoom={handleLeaveRoom}
              onHostUpdateTimer={handleHostUpdateRoomTimer}
              onUpdateMyMemberStatus={handleUpdateMyRoomMemberStatus}
              onCompleteRoomSessionAwardXp={handleCompleteRoomSessionAwardXp}
            />
          )}

          {activeSection === 'stats' && (
            <StatsView
              stats={stats}
              sessions={sessions}
              studentName={profile.name}
              themeConfig={themeConfig}
            />
          )}

          {activeSection === 'settings' && (
            <ProfileSettingsView
              profile={profile}
              levelInfo={levelInfo}
              currentStreak={stats.currentStreak}
              hoursToday={stats.hoursToday}
              themeConfig={themeConfig}
              onUpdateProfile={(nextProfile) => {
                const safeNextProfile: UserProfile = {
                  ...nextProfile,
                  name: sanitizePlainText(nextProfile.name, 80) || 'Student',
                };
                setProfile(safeNextProfile);
                syncTasksAndProfileIfNeeded(tasks, safeNextProfile);
                if (cloudUserDoc && firebaseUser && !needsUsernameClaim) {
                  void updateCloudUserProgress(cloudUserDoc, {
                    displayName: safeNextProfile.name,
                    shareStatsWithFriends:
                      safeNextProfile.shareStatsWithFriends !== false,
                  });
                }
                if (!timerState.isRunning) {
                  const nextMs = getModeDurationMs(
                    timerState.mode,
                    safeNextProfile.timerSettings
                  );
                  setTimerState((prev) => ({
                    ...prev,
                    remainingMsWhenPaused: nextMs,
                  }));
                  setRemainingSeconds(Math.ceil(nextMs / 1000));
                }
              }}
              onOpenDailyGoalModal={() => setIsDailyGoalModalOpen(true)}
              onResetDemoData={handleResetDemoData}
              cloudUser={effectiveUserDoc}
              isCloudConnected={Boolean(firebaseUser && !needsUsernameClaim)}
              onGoogleSignIn={handleGoogleSignIn}
              onOpenSignInScreen={handleOpenSignInScreen}
              onSignOut={handleSignOut}
            />
          )}

          {activeSection === 'admin' && isAdmin && (
            <AdminTracksView
              tracks={customTracks}
              themeConfig={themeConfig}
              isCloudConnected={Boolean(firebaseUser && !needsUsernameClaim)}
              onSaveTrack={handleSaveTrack}
              onDeleteTrack={handleDeleteTrack}
            />
          )}
        </main>
      </div>

      {/* Mobile Floating Mini-Timer Bar above Mobile Bottom Tab Bar */}
      {showFloatingMiniTimer && (
        <div
          className={`md:hidden fixed bottom-14 inset-x-3 z-40 px-4 py-2 rounded-2xl border shadow-lg flex items-center justify-between ${themeConfig.glassCardClass}`}
        >
          <button
            type="button"
            onClick={() => setActiveSection('focus')}
            className="flex items-center gap-2 text-xs font-semibold"
          >
            <Timer
              className="w-4 h-4"
              style={{ color: themeConfig.accentHex }}
            />
            <span>{MODE_LABELS[timerState.mode]}</span>
            <span className="font-mono tabular-nums font-bold text-sm">
              {formatTimeMMSS(remainingSeconds)}
            </span>
          </button>
          <button
            type="button"
            onClick={handleStartPauseTimer}
            aria-label="Pause running timer"
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${themeConfig.buttonBgClass}`}
          >
            <Pause className="w-3 h-3 fill-current" />
            <span>Pause</span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 px-1.5 py-1.5 flex items-center justify-around ${themeConfig.glassHeaderClass} border-t`}
      >
        {navItems.map(({ id, mobileLabel, Icon }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-semibold transition-all whitespace-nowrap ${
                active
                  ? themeConfig.activeTabClass
                  : themeConfig.textSecondaryClass
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
