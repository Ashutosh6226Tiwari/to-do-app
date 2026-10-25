import { MoodThemeConfig, MoodThemeId } from '../types';

export const MOOD_THEMES: Record<MoodThemeId, MoodThemeConfig> = {
  calm: {
    id: 'calm',
    name: 'Calm',
    subtitle: 'Misty Blue Lake',
    description: 'Serene alpine water and cool morning mist for steady, low-stress reading.',
    isDark: false,
    fontDisplay: "'Outfit', sans-serif",
    fontBody: "'Plus Jakarta Sans', sans-serif",
    accentHex: '#0284C7',
    accentSecondaryHex: '#38BDF8',
    buttonBgClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm',
    buttonHoverClass: 'hover:bg-sky-500/15 text-sky-900',
    activeTabClass: 'bg-sky-600 text-white shadow-sm',
    ringStrokeColor: '#0284C7',
    glassCardClass:
      'bg-white/65 backdrop-blur-xl border border-white/70 shadow-[0_8px_32px_rgba(15,23,42,0.07)]',
    glassHeaderClass:
      'bg-white/60 backdrop-blur-xl border-b border-white/60',
    glassInputClass:
      'bg-white/75 border border-slate-300/80 text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20',
    textPrimaryClass: 'text-slate-900',
    textSecondaryClass: 'text-slate-700',
    textMutedClass: 'text-slate-500',
    borderClass: 'border-slate-200/80',
  },
  cozy: {
    id: 'cozy',
    name: 'Cozy',
    subtitle: 'Warm Sunset',
    description: 'Golden-hour amber glow and soft dusk clouds for comforting evening study.',
    isDark: false,
    fontDisplay: "'Fraunces', serif",
    fontBody: "'DM Sans', sans-serif",
    accentHex: '#EA580C',
    accentSecondaryHex: '#FB923C',
    buttonBgClass: 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm',
    buttonHoverClass: 'hover:bg-orange-500/15 text-stone-900',
    activeTabClass: 'bg-orange-600 text-white shadow-sm',
    ringStrokeColor: '#EA580C',
    glassCardClass:
      'bg-amber-50/65 backdrop-blur-xl border border-white/70 shadow-[0_8px_32px_rgba(120,53,15,0.08)]',
    glassHeaderClass:
      'bg-amber-50/60 backdrop-blur-xl border-b border-white/60',
    glassInputClass:
      'bg-white/80 border border-orange-200/90 text-stone-900 placeholder:text-stone-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20',
    textPrimaryClass: 'text-stone-900',
    textSecondaryClass: 'text-stone-700',
    textMutedClass: 'text-stone-500',
    borderClass: 'border-orange-200/60',
  },
  'deep-focus': {
    id: 'deep-focus',
    name: 'Deep Focus',
    subtitle: 'Dark Purple Night City',
    description: 'Distraction-free midnight skyline and indigo glass for deep problem solving.',
    isDark: true,
    fontDisplay: "'Bricolage Grotesque', sans-serif",
    fontBody: "'Plus Jakarta Sans', sans-serif",
    accentHex: '#8B5CF6',
    accentSecondaryHex: '#C084FC',
    buttonBgClass: 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm',
    buttonHoverClass: 'hover:bg-white/10 text-slate-100',
    activeTabClass: 'bg-violet-600 text-white shadow-sm',
    ringStrokeColor: '#A78BFA',
    glassCardClass:
      'bg-slate-900/65 backdrop-blur-xl border border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.45)]',
    glassHeaderClass:
      'bg-slate-950/60 backdrop-blur-xl border-b border-white/10',
    glassInputClass:
      'bg-slate-900/80 border border-white/20 text-slate-100 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30',
    textPrimaryClass: 'text-slate-50',
    textSecondaryClass: 'text-slate-300',
    textMutedClass: 'text-slate-400',
    borderClass: 'border-white/12',
  },
  fresh: {
    id: 'fresh',
    name: 'Fresh',
    subtitle: 'Green Forest',
    description: 'Sunlit botanical canopy and crisp pine air to reset mental fatigue.',
    isDark: false,
    fontDisplay: "'Outfit', sans-serif",
    fontBody: "'DM Sans', sans-serif",
    accentHex: '#059669',
    accentSecondaryHex: '#34D399',
    buttonBgClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
    buttonHoverClass: 'hover:bg-emerald-500/15 text-emerald-950',
    activeTabClass: 'bg-emerald-600 text-white shadow-sm',
    ringStrokeColor: '#059669',
    glassCardClass:
      'bg-white/65 backdrop-blur-xl border border-white/75 shadow-[0_8px_32px_rgba(6,78,59,0.08)]',
    glassHeaderClass:
      'bg-white/60 backdrop-blur-xl border-b border-white/65',
    glassInputClass:
      'bg-white/80 border border-emerald-200/90 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20',
    textPrimaryClass: 'text-slate-900',
    textSecondaryClass: 'text-slate-700',
    textMutedClass: 'text-slate-500',
    borderClass: 'border-emerald-200/70',
  },
  energetic: {
    id: 'energetic',
    name: 'Energetic',
    subtitle: 'Bright Neon Gradient',
    description: 'High-tempo electric aurora for rapid flashcards, drills, and sprint sessions.',
    isDark: true,
    fontDisplay: "'Bricolage Grotesque', sans-serif",
    fontBody: "'DM Sans', sans-serif",
    accentHex: '#F43F5E',
    accentSecondaryHex: '#22D3EE',
    buttonBgClass: 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm',
    buttonHoverClass: 'hover:bg-white/15 text-white',
    activeTabClass: 'bg-rose-500 text-white shadow-sm',
    ringStrokeColor: '#FB7185',
    glassCardClass:
      'bg-slate-950/55 backdrop-blur-xl border border-white/20 shadow-[0_12px_36px_rgba(15,23,42,0.5)]',
    glassHeaderClass:
      'bg-slate-950/50 backdrop-blur-xl border-b border-white/15',
    glassInputClass:
      'bg-slate-900/75 border border-white/25 text-white placeholder:text-slate-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30',
    textPrimaryClass: 'text-white',
    textSecondaryClass: 'text-slate-200',
    textMutedClass: 'text-slate-300',
    borderClass: 'border-white/15',
  },
};

export const TASK_COLORS = [
  { name: 'Sky', hex: '#0284C7' },
  { name: 'Violet', hex: '#7C3AED' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Rose', hex: '#E11D48' },
  { name: 'Indigo', hex: '#4F46E5' },
];
