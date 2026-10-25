import {
  FocusSessionRecord,
  StudyTask,
  UserProfile,
} from '../types';
import { addDays, formatDateKey } from './focusLogic';

export function getInitialProfile(): UserProfile {
  return {
    name: 'Maya Lin',
    majorOrGrade: 'B.S. Computer Science & Physics',
    dailyGoalHours: 3.5,
    totalXp: 285, // Level 3 Scholar
    theme: 'calm',
    timerSettings: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      autoSwitchModes: true,
      soundAlertEnabled: true,
      alertTone: 'chime',
    },
  };
}

export function getInitialTasks(todayKey?: string): StudyTask[] {
  const base = todayKey || formatDateKey(new Date());
  return [
    {
      id: 'task-1',
      title: 'Rotational Dynamics & Angular Momentum Problem Set',
      subject: 'Physics',
      date: base,
      time: '09:30',
      color: '#0284C7',
      estimatedPomodoros: 3,
      completedPomodoros: 1,
      completed: false,
      notes: 'Chapter 10 exercises #14-22, focus on moment of inertia derivations.',
      subtasks: [
        {
          id: 'sub-1',
          title: 'Review parallel-axis theorem derivation',
          estimatedPomodoros: 1,
          completed: true,
        },
        {
          id: 'sub-2',
          title: 'Solve torque and rolling without slipping problems',
          estimatedPomodoros: 1,
          completed: false,
        },
        {
          id: 'sub-3',
          title: 'Check angular momentum conservation edge cases',
          estimatedPomodoros: 1,
          completed: false,
        },
      ],
    },
    {
      id: 'task-2',
      title: 'Implement Dijkstra & A* Shortest Path Lab',
      subject: 'Computer Science',
      date: base,
      time: '14:00',
      color: '#7C3AED',
      estimatedPomodoros: 4,
      completedPomodoros: 2,
      completed: false,
      notes: 'Benchmark priority queue binary heap vs Fibonacci heap in TypeScript.',
    },
    {
      id: 'task-3',
      title: 'Multivariable Calculus: Stokes Theorem Proof Review',
      subject: 'Mathematics',
      date: base,
      time: '17:00',
      color: '#059669',
      estimatedPomodoros: 2,
      completedPomodoros: 2,
      completed: true,
      notes: 'Completed surface integral orientation examples.',
    },
    {
      id: 'task-4',
      title: 'Macroeconomics Monetary Policy Case Study',
      subject: 'Economics',
      date: addDays(base, 1),
      time: '11:00',
      color: '#D97706',
      estimatedPomodoros: 2,
      completedPomodoros: 0,
      completed: false,
      notes: 'Read Federal Reserve interest rate transmission paper.',
    },
    {
      id: 'task-5',
      title: 'Organic Chemistry: Nucleophilic Substitution Lab Report',
      subject: 'Chemistry',
      date: addDays(base, 2),
      time: '15:30',
      color: '#E11D48',
      estimatedPomodoros: 3,
      completedPomodoros: 0,
      completed: false,
      notes: 'Compare SN1 and SN2 reaction kinetics and solvent effects.',
    },
    {
      id: 'task-6',
      title: 'Operating Systems Virtual Memory Page Tables Quiz Prep',
      subject: 'Computer Science',
      date: addDays(base, -1),
      time: '16:00',
      color: '#4F46E5',
      estimatedPomodoros: 2,
      completedPomodoros: 2,
      completed: true,
      notes: 'TLB misses and multi-level page walk practice.',
    },
  ];
}

export function getInitialSessions(todayKey?: string): FocusSessionRecord[] {
  const base = todayKey || formatDateKey(new Date());
  const records: FocusSessionRecord[] = [
    {
      id: 'sess-1',
      taskId: 'task-1',
      taskTitle: 'Rotational Dynamics & Angular Momentum Problem Set',
      subject: 'Physics',
      date: base,
      timestamp: `${base}T09:00:00.000Z`,
      durationMinutes: 25,
      mode: 'focus',
      completed: true,
      xpEarned: 39,
    },
    {
      id: 'sess-2',
      taskId: 'task-3',
      taskTitle: 'Multivariable Calculus: Stokes Theorem Proof Review',
      subject: 'Mathematics',
      date: base,
      timestamp: `${base}T10:15:00.000Z`,
      durationMinutes: 50,
      mode: 'focus',
      completed: true,
      xpEarned: 66,
    },
    {
      id: 'sess-3',
      taskId: 'task-6',
      taskTitle: 'Operating Systems Virtual Memory Page Tables Quiz Prep',
      subject: 'Computer Science',
      date: addDays(base, -1),
      timestamp: `${addDays(base, -1)}T16:30:00.000Z`,
      durationMinutes: 50,
      mode: 'focus',
      completed: true,
      xpEarned: 66,
    },
    {
      id: 'sess-4',
      taskTitle: 'Electromagnetism Gauss Law Derivations',
      subject: 'Physics',
      date: addDays(base, -2),
      timestamp: `${addDays(base, -2)}T15:00:00.000Z`,
      durationMinutes: 75,
      mode: 'focus',
      completed: true,
      xpEarned: 85,
    },
    {
      id: 'sess-5',
      taskTitle: 'Linear Algebra Eigenvalues & SVD Practice',
      subject: 'Mathematics',
      date: addDays(base, -3),
      timestamp: `${addDays(base, -3)}T18:00:00.000Z`,
      durationMinutes: 50,
      mode: 'focus',
      completed: true,
      xpEarned: 60,
    },
    {
      id: 'sess-6',
      taskTitle: 'Organic Chemistry Stereochemistry Drills',
      subject: 'Chemistry',
      date: addDays(base, -5),
      timestamp: `${addDays(base, -5)}T14:00:00.000Z`,
      durationMinutes: 50,
      mode: 'focus',
      completed: true,
      xpEarned: 60,
    },
    {
      id: 'sess-7',
      taskTitle: 'Graph Algorithms BFS/DFS Complexity',
      subject: 'Computer Science',
      date: addDays(base, -6),
      timestamp: `${addDays(base, -6)}T19:00:00.000Z`,
      durationMinutes: 25,
      mode: 'focus',
      completed: true,
      xpEarned: 35,
    },
  ];

  const historicalOffsets = [
    -8, -9, -10, -11, -12, -13, -14, -17, -18, -20, -22, -24, -25, -28, -31,
    -33, -36, -40, -42, -45, -49, -53, -58, -62, -67, -71, -78, -84, -90,
  ];
  const subjects = [
    'Physics',
    'Computer Science',
    'Mathematics',
    'Chemistry',
    'Economics',
  ];

  historicalOffsets.forEach((offset, idx) => {
    const dKey = addDays(base, offset);
    const subj = subjects[idx % subjects.length];
    const mins = idx % 3 === 0 ? 75 : idx % 2 === 0 ? 50 : 25;
    records.push({
      id: `sess-hist-${idx}`,
      taskTitle: `${subj} Deep Study Block`,
      subject: subj,
      date: dKey,
      timestamp: `${dKey}T17:00:00.000Z`,
      durationMinutes: mins,
      mode: 'focus',
      completed: true,
      xpEarned: mins + 10,
    });
  });

  return records;
}

export function getInitialCloudTracks() {
  return [
    {
      id: 'track-lofi-study',
      title: 'Midnight Library Lo-Fi Beats',
      category: 'Lo-Fi',
      url: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg',
      createdAt: '2026-10-20T12:00:00.000Z',
    },
    {
      id: 'track-forest-stream',
      title: 'Mountain Creek & Pine Canopy',
      category: 'Nature',
      url: 'https://actions.google.com/sounds/v1/ambiences/outdoor_summer_ambience.ogg',
      createdAt: '2026-10-21T12:00:00.000Z',
    },
  ];
}

