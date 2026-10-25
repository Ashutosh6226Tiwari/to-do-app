import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  ListTree,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  CalendarViewMode,
  MoodThemeConfig,
  StudyTask,
  SubtaskItem,
} from '../types';
import { addDays, formatDateKey } from '../utils/focusLogic';
import { TASK_COLORS } from '../utils/themes';
import {
  breakDownTaskWithGemini,
  GeneratedPlanTask,
  generateStudyPlanWithGemini,
} from '../utils/geminiClient';

interface PlannerViewProps {
  tasks: StudyTask[];
  todayKey: string;
  themeConfig: MoodThemeConfig;
  onAddTask: (task: Omit<StudyTask, 'id' | 'completedPomodoros'>) => void;
  onAddMultipleTasks: (
    tasks: Array<Omit<StudyTask, 'id' | 'completedPomodoros'>>
  ) => void;
  onUpdateTask: (task: StudyTask) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onStartFocusTask: (taskId: string) => void;
}

export function PlannerView({
  tasks,
  todayKey,
  themeConfig,
  onAddTask,
  onAddMultipleTasks,
  onUpdateTask,
  onDeleteTask,
  onToggleTaskComplete,
  onStartFocusTask,
}: PlannerViewProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  // Task Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('Physics');
  const [dateInput, setDateInput] = useState(todayKey);
  const [timeInput, setTimeInput] = useState('14:00');
  const [colorInput, setColorInput] = useState(TASK_COLORS[0].hex);
  const [pomodorosInput, setPomodorosInput] = useState(2);
  const [notesInput, setNotesInput] = useState('');
  const [formError, setFormError] = useState('');

  // Gemini Study Plan Generator Modal
  const [isAiPlanOpen, setIsAiPlanOpen] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [useSearchGrounding, setUseSearchGrounding] = useState(true);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<{
    summary: string;
    tasks: GeneratedPlanTask[];
    sources?: Array<{ uri?: string; title?: string }>;
  } | null>(null);

  // Gemini Task Breakdown loading state
  const [breakingDownTaskId, setBreakingDownTaskId] = useState<string | null>(
    null
  );

  const allSubjects = Array.from(
    new Set(tasks.map((t) => t.subject).filter(Boolean))
  );

  const openAddModal = (prefillDate?: string) => {
    setEditingTask(null);
    setTitleInput('');
    setSubjectInput('Physics');
    setDateInput(prefillDate || selectedDate);
    setTimeInput('15:00');
    setColorInput(TASK_COLORS[0].hex);
    setPomodorosInput(2);
    setNotesInput('');
    setFormError('');
    setIsTaskModalOpen(true);
  };

  const openEditModal = (task: StudyTask) => {
    setEditingTask(task);
    setTitleInput(task.title);
    setSubjectInput(task.subject);
    setDateInput(task.date);
    setTimeInput(task.time);
    setColorInput(task.color);
    setPomodorosInput(task.estimatedPomodoros);
    setNotesInput(task.notes || '');
    setFormError('');
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) {
      setFormError('Please enter a task title.');
      return;
    }
    if (!subjectInput.trim()) {
      setFormError('Please enter a subject name.');
      return;
    }

    if (editingTask) {
      onUpdateTask({
        ...editingTask,
        title: titleInput.trim(),
        subject: subjectInput.trim(),
        date: dateInput,
        time: timeInput,
        color: colorInput,
        estimatedPomodoros: Math.max(1, Number(pomodorosInput) || 1),
        notes: notesInput.trim(),
      });
    } else {
      onAddTask({
        title: titleInput.trim(),
        subject: subjectInput.trim(),
        date: dateInput,
        time: timeInput,
        color: colorInput,
        estimatedPomodoros: Math.max(1, Number(pomodorosInput) || 1),
        completed: false,
        notes: notesInput.trim(),
      });
    }
    setIsTaskModalOpen(false);
  };

  const handleBreakDownTask = async (task: StudyTask) => {
    setBreakingDownTaskId(task.id);
    try {
      const result = await breakDownTaskWithGemini(
        task.title,
        task.subject,
        task.estimatedPomodoros
      );
      const newSubtasks: SubtaskItem[] = result.subtasks.map((st, idx) => ({
        id: `${task.id}-sub-${Date.now()}-${idx}`,
        title: st.title,
        estimatedPomodoros: st.estimatedPomodoros || 1,
        completed: false,
      }));
      onUpdateTask({
        ...task,
        subtasks: newSubtasks,
      });
    } finally {
      setBreakingDownTaskId(null);
    }
  };

  const handleToggleSubtask = (task: StudyTask, subtaskId: string) => {
    if (!task.subtasks) return;
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    onUpdateTask({
      ...task,
      subtasks: updatedSubtasks,
    });
  };

  const handleGenerateStudyPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim()) return;
    setIsGeneratingPlan(true);
    try {
      const plan = await generateStudyPlanWithGemini(
        goalInput.trim(),
        selectedDate,
        useSearchGrounding
      );
      setGeneratedPlan(plan);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleApplyGeneratedPlan = () => {
    if (!generatedPlan) return;
    const newTasks = generatedPlan.tasks.map((pt, idx) => ({
      title: pt.title,
      subject: pt.subject || 'Study Plan',
      date: addDays(selectedDate, pt.dateOffsetDays || 0),
      time: pt.time || '15:00',
      color: TASK_COLORS[idx % TASK_COLORS.length].hex,
      estimatedPomodoros: Math.max(1, pt.estimatedPomodoros || 2),
      completed: false,
      notes: pt.notes || `Generated for goal: ${goalInput}`,
    }));
    onAddMultipleTasks(newTasks);
    setGeneratedPlan(null);
    setGoalInput('');
    setIsAiPlanOpen(false);
  };

  const shiftDate = (direction: -1 | 1) => {
    const delta =
      viewMode === 'day'
        ? direction
        : viewMode === 'week'
          ? direction * 7
          : direction * 30;
    setSelectedDate(addDays(selectedDate, delta));
  };

  const getWeekDates = (anchorKey: string): string[] => {
    const [y, m, d] = anchorKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dayOfWeek = dt.getDay();
    const sundayKey = addDays(anchorKey, -dayOfWeek);
    return Array.from({ length: 7 }, (_, i) => addDays(sundayKey, i));
  };

  const getMonthDates = (anchorKey: string): string[] => {
    const [y, m] = anchorKey.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const startOffset = firstDay.getDay();
    const firstCellKey = addDays(formatDateKey(firstDay), -startOffset);
    return Array.from({ length: 35 }, (_, i) => addDays(firstCellKey, i));
  };

  const filteredTasks = tasks
    .filter((t) => subjectFilter === 'all' || t.subject === subjectFilter)
    .sort((a, b) => a.time.localeCompare(b.time));

  const weekDates = getWeekDates(selectedDate);
  const monthDates = getMonthDates(selectedDate);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatReadableDate = (dKey: string) => {
    const [y, m, d] = dKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Planner Action Header */}
      <div
        className={`p-5 rounded-2xl ${themeConfig.glassCardClass} flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4`}
      >
        <div>
          <h1
            className={`text-2xl font-bold tracking-tight ${themeConfig.textPrimaryClass}`}
            style={{ fontFamily: themeConfig.fontDisplay }}
          >
            Study Planner
          </h1>
          <p className={`text-sm mt-0.5 ${themeConfig.textSecondaryClass}`}>
            Schedule classes, exam prep blocks, and launch Pomodoro sessions directly from your calendar.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsAiPlanOpen(true)}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 border transition-colors whitespace-nowrap shrink-0 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Study Plan</span>
          </button>

          <button
            type="button"
            onClick={() => openAddModal(selectedDate)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${themeConfig.buttonBgClass}`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Calendar Controls Bar: Day/Week/Month + Date Navigation + Subject Filter */}
      <div
        className={`p-4 rounded-2xl ${themeConfig.glassCardClass} flex flex-wrap items-center justify-between gap-4`}
      >
        {/* View Mode Switcher */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10"
          role="group"
          aria-label="Calendar view mode"
        >
          {(['day', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap shrink-0 ${
                viewMode === mode
                  ? themeConfig.activeTabClass
                  : `${themeConfig.textSecondaryClass} hover:opacity-80`
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            aria-label="Previous period"
            className={`p-2 rounded-xl border ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(todayKey)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass} whitespace-nowrap shrink-0`}
          >
            Today
          </button>
          <span
            className={`text-sm font-semibold px-2 tabular-nums whitespace-nowrap ${themeConfig.textPrimaryClass}`}
          >
            {formatReadableDate(selectedDate)}
          </span>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            aria-label="Next period"
            className={`p-2 rounded-xl border ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Subject Filter */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="subject-filter-select"
            className={`text-xs font-medium ${themeConfig.textMutedClass}`}
          >
            Subject:
          </label>
          <select
            id="subject-filter-select"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium outline-none ${themeConfig.glassInputClass}`}
          >
            <option value="all">All Subjects</option>
            {allSubjects.map((subj) => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Views */}
      {viewMode === 'day' && (
        <div className={`p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
          <div className="flex items-center justify-between mb-4">
            <h2
              className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Schedule for {formatReadableDate(selectedDate)}
            </h2>
            <span
              className={`text-xs font-mono tabular-nums ${themeConfig.textMutedClass}`}
            >
              {filteredTasks.filter((t) => t.date === selectedDate).length} tasks
              scheduled
            </span>
          </div>

          <div className="space-y-3">
            {filteredTasks.filter((t) => t.date === selectedDate).length ===
            0 ? (
              <div className="py-12 text-center">
                <CalendarIcon
                  className={`w-10 h-10 mx-auto mb-2 opacity-40 ${themeConfig.textMutedClass}`}
                />
                <p
                  className={`text-sm font-medium ${themeConfig.textSecondaryClass}`}
                >
                  No study tasks scheduled for this day yet.
                </p>
                <button
                  type="button"
                  onClick={() => openAddModal(selectedDate)}
                  className={`mt-3 px-4 py-2 rounded-xl text-xs font-semibold ${themeConfig.buttonBgClass}`}
                >
                  Schedule Task for This Day
                </button>
              </div>
            ) : (
              filteredTasks
                .filter((t) => t.date === selectedDate)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    themeConfig={themeConfig}
                    isBreakingDown={breakingDownTaskId === task.id}
                    onToggleComplete={() => onToggleTaskComplete(task.id)}
                    onStartFocus={() => onStartFocusTask(task.id)}
                    onEdit={() => openEditModal(task)}
                    onDelete={() => onDeleteTask(task.id)}
                    onBreakDown={() => handleBreakDownTask(task)}
                    onToggleSubtask={(subId) =>
                      handleToggleSubtask(task, subId)
                    }
                  />
                ))
            )}
          </div>
        </div>
      )}

      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDates.map((dKey, idx) => {
            const dayTasks = filteredTasks.filter((t) => t.date === dKey);
            const isToday = dKey === todayKey;
            const isSelected = dKey === selectedDate;
            const dayNumber = Number(dKey.split('-')[2]);

            return (
              <div
                key={dKey}
                onClick={() => setSelectedDate(dKey)}
                className={`p-3.5 rounded-2xl transition-all flex flex-col min-h-[16rem] cursor-pointer ${
                  themeConfig.glassCardClass
                } ${isSelected ? 'ring-2 ring-offset-1' : ''}`}
                style={
                  isSelected
                    ? ({
                        '--tw-ring-color': themeConfig.accentHex,
                      } as React.CSSProperties)
                    : undefined
                }
              >
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-black/5 dark:border-white/10">
                  <div>
                    <span
                      className={`text-xs font-medium block ${themeConfig.textMutedClass}`}
                    >
                      {dayNames[idx]}
                    </span>
                    <span
                      className={`text-lg font-bold tabular-nums ${
                        isToday ? 'underline' : ''
                      } ${themeConfig.textPrimaryClass}`}
                    >
                      {dayNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddModal(dKey);
                    }}
                    aria-label={`Add task on ${dKey}`}
                    className={`p-1.5 rounded-lg ${themeConfig.buttonHoverClass}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 flex-1">
                  {dayTasks.length === 0 ? (
                    <p
                      className={`text-xs italic py-4 text-center ${themeConfig.textMutedClass}`}
                    >
                      Free day
                    </p>
                  ) : (
                    dayTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={(e) => e.stopPropagation()}
                        className={`p-2.5 rounded-xl border transition-all ${themeConfig.borderClass} bg-white/40 dark:bg-slate-800/40`}
                      >
                        <div className="flex items-start gap-1.5">
                          <button
                            type="button"
                            onClick={() => onToggleTaskComplete(task.id)}
                            aria-label={`Mark "${task.title}" as ${
                              task.completed ? 'incomplete' : 'complete'
                            }`}
                            className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                              task.completed
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-400'
                            }`}
                          >
                            {task.completed && <Check className="w-3 h-3" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs font-semibold leading-snug line-clamp-2 ${
                                task.completed
                                  ? 'line-through opacity-60'
                                  : themeConfig.textPrimaryClass
                              }`}
                            >
                              {task.title}
                            </p>
                            <div
                              className={`mt-1 flex items-center gap-1 text-[11px] ${themeConfig.textMutedClass}`}
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: task.color }}
                              />
                              <span className="truncate">{task.subject}</span>
                            </div>
                            <div
                              className={`mt-0.5 flex items-center justify-between text-[11px] font-mono tabular-nums ${themeConfig.textMutedClass}`}
                            >
                              <span>{task.time}</span>
                              <span>
                                {task.completedPomodoros}/
                                {task.estimatedPomodoros} Pom
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => onStartFocusTask(task.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 ${themeConfig.buttonBgClass}`}
                            aria-label={`Start focus for ${task.title}`}
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Start focus</span>
                          </button>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditModal(task)}
                              aria-label={`Edit ${task.title}`}
                              className={`p-1 rounded ${themeConfig.textMutedClass} hover:opacity-80`}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteTask(task.id)}
                              aria-label={`Delete ${task.title}`}
                              className="p-1 rounded text-rose-500 hover:opacity-80"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'month' && (
        <div className={`p-5 rounded-2xl ${themeConfig.glassCardClass}`}>
          <div className="grid grid-cols-7 gap-2 mb-2 text-center">
            {dayNames.map((d) => (
              <div
                key={d}
                className={`text-xs font-semibold py-1 ${themeConfig.textMutedClass}`}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {monthDates.map((dKey) => {
              const dayTasks = filteredTasks.filter((t) => t.date === dKey);
              const isSelected = dKey === selectedDate;
              const isCurrentMonth =
                dKey.slice(0, 7) === selectedDate.slice(0, 7);
              const dayNum = Number(dKey.split('-')[2]);

              return (
                <button
                  key={dKey}
                  type="button"
                  onClick={() => {
                    setSelectedDate(dKey);
                    setViewMode('day');
                  }}
                  className={`min-h-[5.5rem] p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    themeConfig.borderClass
                  } ${
                    isCurrentMonth ? 'opacity-100' : 'opacity-45'
                  } ${isSelected ? 'ring-2' : ''} bg-white/30 dark:bg-slate-900/30 hover:bg-white/50 dark:hover:bg-slate-800/50`}
                >
                  <span
                    className={`text-xs font-bold tabular-nums ${themeConfig.textPrimaryClass}`}
                  >
                    {dayNum}
                  </span>
                  <div className="space-y-1 w-full">
                    {dayTasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className={`text-[10px] truncate px-1.5 py-0.5 rounded font-medium ${themeConfig.textPrimaryClass} bg-black/5 dark:bg-white/10`}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div
                        className={`text-[10px] font-mono ${themeConfig.textMutedClass}`}
                      >
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Day Detailed Task List */}
      {viewMode !== 'day' && (
        <div className={`p-6 rounded-2xl ${themeConfig.glassCardClass}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                Tasks & Subtasks for {formatReadableDate(selectedDate)}
              </h2>
              <p className={`text-xs ${themeConfig.textMutedClass}`}>
                Use "Break Down" to split any complex assignment into Pomodoro-sized steps with Gemini.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddModal(selectedDate)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 ${themeConfig.buttonBgClass}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to {selectedDate.slice(5)}</span>
            </button>
          </div>

          <div className="space-y-3">
            {filteredTasks.filter((t) => t.date === selectedDate).length ===
            0 ? (
              <p className={`text-sm py-4 ${themeConfig.textMutedClass}`}>
                No tasks scheduled on {formatReadableDate(selectedDate)}. Click
                any day card above or add a new task.
              </p>
            ) : (
              filteredTasks
                .filter((t) => t.date === selectedDate)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    themeConfig={themeConfig}
                    isBreakingDown={breakingDownTaskId === task.id}
                    onToggleComplete={() => onToggleTaskComplete(task.id)}
                    onStartFocus={() => onStartFocusTask(task.id)}
                    onEdit={() => openEditModal(task)}
                    onDelete={() => onDeleteTask(task.id)}
                    onBreakDown={() => handleBreakDownTask(task)}
                    onToggleSubtask={(subId) =>
                      handleToggleSubtask(task, subId)
                    }
                  />
                ))
            )}
          </div>
        </div>
      )}

      {/* Modal 1: Add / Edit Task */}
      {isTaskModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
        >
          <div
            className={`w-full max-w-lg p-6 rounded-2xl ${themeConfig.glassCardClass}`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                id="task-modal-title"
                className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
                style={{ fontFamily: themeConfig.fontDisplay }}
              >
                {editingTask ? 'Edit Study Task' : 'New Study Task'}
              </h2>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                aria-label="Close task dialog"
                className={`p-1.5 rounded-lg ${themeConfig.textMutedClass}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              {formError && (
                <p className="text-xs font-medium text-rose-500">{formError}</p>
              )}

              <div>
                <label
                  htmlFor="task-title-input"
                  className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
                >
                  Task Title
                </label>
                <input
                  id="task-title-input"
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="e.g., Thermodynamics Problem Set #4"
                  className={`w-full px-3.5 py-2 rounded-xl text-sm outline-none ${themeConfig.glassInputClass}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="task-subject-input"
                    className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
                  >
                    Subject
                  </label>
                  <input
                    id="task-subject-input"
                    type="text"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    placeholder="e.g., Physics"
                    className={`w-full px-3.5 py-2 rounded-xl text-sm outline-none ${themeConfig.glassInputClass}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-pomodoros-input"
                    className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
                  >
                    Estimated Pomodoros
                  </label>
                  <input
                    id="task-pomodoros-input"
                    type="number"
                    min={1}
                    max={16}
                    value={pomodorosInput}
                    onChange={(e) => setPomodorosInput(Number(e.target.value))}
                    className={`w-full px-3.5 py-2 rounded-xl text-sm font-mono tabular-nums outline-none ${themeConfig.glassInputClass}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="task-date-input"
                    className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
                  >
                    Date
                  </label>
                  <input
                    id="task-date-input"
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className={`w-full px-3.5 py-2 rounded-xl text-sm font-mono outline-none ${themeConfig.glassInputClass}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-time-input"
                    className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
                  >
                    Start Time
                  </label>
                  <input
                    id="task-time-input"
                    type="time"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    className={`w-full px-3.5 py-2 rounded-xl text-sm font-mono outline-none ${themeConfig.glassInputClass}`}
                  />
                </div>
              </div>

              <div>
                <span
                  className={`block text-xs font-semibold mb-1.5 ${themeConfig.textSecondaryClass}`}
                >
                  Calendar Color
                </span>
                <div className="flex items-center gap-2.5">
                  {TASK_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColorInput(c.hex)}
                      aria-label={`Select color ${c.name}`}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        colorInput === c.hex
                          ? 'scale-110 ring-2 ring-offset-2'
                          : ''
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="task-notes-input"
                  className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
                >
                  Notes (Optional)
                </label>
                <textarea
                  id="task-notes-input"
                  rows={2}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Chapters, textbook page numbers, or links..."
                  className={`w-full px-3.5 py-2 rounded-xl text-sm outline-none ${themeConfig.glassInputClass}`}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border ${themeConfig.borderClass} ${themeConfig.textSecondaryClass}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-semibold ${themeConfig.buttonBgClass}`}
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Gemini AI Study Plan Generator */}
      {isAiPlanOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-plan-modal-title"
        >
          <div
            className={`w-full max-w-xl p-6 rounded-2xl max-h-[90vh] overflow-y-auto ${themeConfig.glassCardClass}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h2
                  id="ai-plan-modal-title"
                  className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
                  style={{ fontFamily: themeConfig.fontDisplay }}
                >
                  AI Study Plan Generator
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAiPlanOpen(false)}
                aria-label="Close AI study plan modal"
                className={`p-1.5 rounded-lg ${themeConfig.textMutedClass}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs mb-4 ${themeConfig.textSecondaryClass}`}>
              Describe an upcoming exam, project, or study goal (e.g., "Physics exam in 10 days"). Gemini will create a multi-day Pomodoro schedule on your planner.
            </p>

            <form onSubmit={handleGenerateStudyPlan} className="space-y-3">
              <div>
                <label
                  htmlFor="ai-goal-input"
                  className={`block text-xs font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
                >
                  Your Study Goal
                </label>
                <input
                  id="ai-goal-input"
                  type="text"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="e.g., Physics exam in 10 days covering rotational mechanics"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none ${themeConfig.glassInputClass}`}
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useSearchGrounding}
                  onChange={(e) => setUseSearchGrounding(e.target.checked)}
                  className="rounded"
                />
                <Search className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span className={themeConfig.textSecondaryClass}>
                  Ground study topics with live Google Search curriculum data (gemini-3.8-flash)
                </span>
              </label>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isGeneratingPlan || !goalInput.trim()}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-50 ${themeConfig.buttonBgClass}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isGeneratingPlan
                      ? 'Generating Plan...'
                      : 'Generate Study Plan'}
                  </span>
                </button>
              </div>
            </form>

            {generatedPlan && (
              <div className="mt-5 pt-4 border-t border-black/10 dark:border-white/15 space-y-3">
                <p
                  className={`text-xs font-medium ${themeConfig.textPrimaryClass}`}
                >
                  {generatedPlan.summary}
                </p>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {generatedPlan.tasks.map((pt, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border ${themeConfig.borderClass} bg-white/40 dark:bg-slate-900/40 flex items-center justify-between gap-3`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-semibold truncate ${themeConfig.textPrimaryClass}`}
                        >
                          {pt.title}
                        </p>
                        <p className={`text-[11px] ${themeConfig.textMutedClass}`}>
                          {pt.subject} · Day +{pt.dateOffsetDays} ({pt.time}) ·{' '}
                          {pt.estimatedPomodoros} Pomodoros
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {generatedPlan.sources && generatedPlan.sources.length > 0 && (
                  <div className="pt-2">
                    <p
                      className={`text-[11px] font-semibold mb-1 ${themeConfig.textMutedClass}`}
                    >
                      Google Search Grounding Sources:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {generatedPlan.sources.map((src, idx) =>
                        src.uri ? (
                          <a
                            key={idx}
                            href={src.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] underline text-sky-600 dark:text-sky-400 truncate max-w-xs"
                          >
                            {src.title || src.uri}
                          </a>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleApplyGeneratedPlan}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold ${themeConfig.buttonBgClass}`}
                  >
                    Place {generatedPlan.tasks.length} Tasks on Planner
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: StudyTask;
  themeConfig: MoodThemeConfig;
  isBreakingDown: boolean;
  onToggleComplete: () => void;
  onStartFocus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onBreakDown: () => void;
  onToggleSubtask: (subtaskId: string) => void;
}

function TaskCard({
  task,
  themeConfig,
  isBreakingDown,
  onToggleComplete,
  onStartFocus,
  onEdit,
  onDelete,
  onBreakDown,
  onToggleSubtask,
}: TaskCardProps) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${themeConfig.borderClass} bg-white/45 dark:bg-slate-900/45`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleComplete}
            aria-label={`Mark "${task.title}" as ${
              task.completed ? 'incomplete' : 'complete'
            }`}
            className={`mt-1 w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition-colors ${
              task.completed
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-slate-400'
            }`}
          >
            {task.completed && <Check className="w-3.5 h-3.5" />}
          </button>

          <div className="min-w-0">
            <h3
              className={`text-sm font-semibold ${
                task.completed
                  ? 'line-through opacity-60'
                  : themeConfig.textPrimaryClass
              }`}
            >
              {task.title}
            </h3>

            <div
              className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${themeConfig.textMutedClass}`}
            >
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: task.color }}
                />
                {task.subject}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Clock className="w-3 h-3" />
                {task.time}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {task.completedPomodoros} / {task.estimatedPomodoros} Pomodoros
              </span>
            </div>

            {task.notes && (
              <p className={`mt-1.5 text-xs ${themeConfig.textSecondaryClass}`}>
                {task.notes}
              </p>
            )}
          </div>
        </div>

        {/* Task Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onStartFocus}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 ${themeConfig.buttonBgClass}`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start focus</span>
          </button>

          <button
            type="button"
            onClick={onBreakDown}
            disabled={isBreakingDown}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 whitespace-nowrap shrink-0 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
            title="Split into Pomodoro subtasks using Gemini"
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>{isBreakingDown ? 'Splitting...' : 'Break Down'}</span>
          </button>

          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit task ${task.title}`}
            className={`p-1.5 rounded-lg border ${themeConfig.borderClass} ${themeConfig.textSecondaryClass}`}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete task ${task.title}`}
            className={`p-1.5 rounded-lg border ${themeConfig.borderClass} text-rose-500`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10 pl-8 space-y-1.5">
          <span
            className={`text-[11px] font-semibold block ${themeConfig.textMutedClass}`}
          >
            Pomodoro Subtasks:
          </span>
          {task.subtasks.map((st) => (
            <label
              key={st.id}
              className="flex items-center justify-between gap-2 text-xs cursor-pointer py-0.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={st.completed}
                  onChange={() => onToggleSubtask(st.id)}
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
              </div>
              <span
                className={`text-[11px] font-mono tabular-nums shrink-0 ${themeConfig.textMutedClass}`}
              >
                {st.estimatedPomodoros} Pom
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
