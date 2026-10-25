import { MoodThemeId } from '../types';

interface MoodBackgroundProps {
  theme: MoodThemeId;
}

export function MoodBackground({ theme }: MoodBackgroundProps) {
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none transition-colors duration-700"
      aria-hidden="true"
    >
      {theme === 'calm' && (
        <div className="relative w-full h-full bg-gradient-to-b from-sky-200 via-sky-100 to-slate-200">
          {/* Soft sun / mist glow */}
          <div className="absolute -top-24 left-1/4 w-[38rem] h-[38rem] rounded-full bg-white/60 blur-3xl" />
          <div className="absolute top-1/4 right-10 w-[28rem] h-[28rem] rounded-full bg-sky-300/40 blur-3xl" />
          {/* Misty Blue Lake SVG Landscape */}
          <svg
            className="absolute bottom-0 inset-x-0 w-full h-[55%] object-cover"
            viewBox="0 0 1440 500"
            preserveAspectRatio="none"
          >
            <path
              fill="rgba(125, 211, 252, 0.35)"
              d="M0,180 L240,95 L510,165 L820,70 L1140,150 L1440,85 L1440,500 L0,500 Z"
            />
            <path
              fill="rgba(56, 189, 248, 0.32)"
              d="M0,230 L320,140 L640,210 L980,125 L1290,195 L1440,160 L1440,500 L0,500 Z"
            />
            <rect
              x="0"
              y="290"
              width="1440"
              height="210"
              fill="rgba(186, 230, 253, 0.55)"
            />
          </svg>
        </div>
      )}

      {theme === 'cozy' && (
        <div className="relative w-full h-full bg-gradient-to-b from-orange-200 via-amber-100 to-rose-200">
          {/* Warm sunset orb */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] rounded-full bg-amber-300/60 blur-3xl" />
          <div className="absolute bottom-1/3 left-16 w-[26rem] h-[26rem] rounded-full bg-rose-300/40 blur-3xl" />
          {/* Warm Sunset Hills SVG */}
          <svg
            className="absolute bottom-0 inset-x-0 w-full h-[50%]"
            viewBox="0 0 1440 450"
            preserveAspectRatio="none"
          >
            <circle cx="720" cy="140" r="95" fill="rgba(251, 146, 60, 0.45)" />
            <path
              fill="rgba(234, 88, 12, 0.22)"
              d="M0,220 Q360,120 720,200 T1440,170 L1440,450 L0,450 Z"
            />
            <path
              fill="rgba(194, 65, 12, 0.26)"
              d="M0,290 Q420,210 860,280 T1440,240 L1440,450 L0,450 Z"
            />
          </svg>
        </div>
      )}

      {theme === 'deep-focus' && (
        <div className="relative w-full h-full bg-gradient-to-b from-[#0f0728] via-[#1a103c] to-[#2e1065]">
          <div className="absolute top-10 left-1/3 w-[34rem] h-[34rem] rounded-full bg-violet-600/20 blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-[28rem] h-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />
          {/* Night City Skyline Silhouette */}
          <svg
            className="absolute bottom-0 inset-x-0 w-full h-[42%]"
            viewBox="0 0 1440 400"
            preserveAspectRatio="none"
          >
            <g fill="rgba(15, 23, 42, 0.7)">
              <rect x="40" y="160" width="90" height="240" />
              <rect x="150" y="110" width="110" height="290" />
              <rect x="280" y="190" width="85" height="210" />
              <rect x="390" y="80" width="130" height="320" />
              <rect x="540" y="140" width="95" height="260" />
              <rect x="660" y="60" width="140" height="340" />
              <rect x="820" y="130" width="115" height="270" />
              <rect x="960" y="95" width="125" height="305" />
              <rect x="1110" y="150" width="100" height="250" />
              <rect x="1230" y="105" width="135" height="295" />
            </g>
            <g fill="rgba(196, 181, 253, 0.35)">
              <rect x="175" y="140" width="12" height="18" />
              <rect x="205" y="140" width="12" height="18" />
              <rect x="420" y="115" width="14" height="20" />
              <rect x="455" y="115" width="14" height="20" />
              <rect x="420" y="155" width="14" height="20" />
              <rect x="695" y="95" width="16" height="22" />
              <rect x="735" y="95" width="16" height="22" />
              <rect x="695" y="140" width="16" height="22" />
              <rect x="995" y="130" width="14" height="20" />
              <rect x="1265" y="140" width="15" height="20" />
            </g>
          </svg>
        </div>
      )}

      {theme === 'fresh' && (
        <div className="relative w-full h-full bg-gradient-to-b from-emerald-100 via-teal-50 to-emerald-200">
          <div className="absolute -top-16 right-1/4 w-[36rem] h-[36rem] rounded-full bg-emerald-300/35 blur-3xl" />
          <div className="absolute bottom-12 left-1/4 w-[30rem] h-[30rem] rounded-full bg-teal-300/30 blur-3xl" />
          {/* Green Forest Ridge SVG */}
          <svg
            className="absolute bottom-0 inset-x-0 w-full h-[48%]"
            viewBox="0 0 1440 440"
            preserveAspectRatio="none"
          >
            <path
              fill="rgba(16, 185, 129, 0.22)"
              d="M0,210 L180,120 L370,195 L590,95 L830,185 L1090,105 L1310,175 L1440,130 L1440,440 L0,440 Z"
            />
            <path
              fill="rgba(5, 150, 105, 0.28)"
              d="M0,275 L230,190 L480,260 L740,165 L1010,250 L1250,180 L1440,235 L1440,440 L0,440 Z"
            />
          </svg>
        </div>
      )}

      {theme === 'energetic' && (
        <div className="relative w-full h-full bg-gradient-to-br from-indigo-950 via-fuchsia-900 to-rose-900">
          <div className="absolute top-12 left-12 w-[34rem] h-[34rem] rounded-full bg-cyan-400/25 blur-3xl" />
          <div className="absolute bottom-10 right-12 w-[36rem] h-[36rem] rounded-full bg-rose-500/30 blur-3xl" />
          <div className="absolute top-1/3 right-1/3 w-[26rem] h-[26rem] rounded-full bg-amber-400/20 blur-3xl" />
          <svg
            className="absolute bottom-0 inset-x-0 w-full h-[45%]"
            viewBox="0 0 1440 420"
            preserveAspectRatio="none"
          >
            <path
              fill="rgba(244, 63, 94, 0.22)"
              d="M0,240 C360,110 720,330 1080,170 C1260,90 1380,190 1440,150 L1440,420 L0,420 Z"
            />
            <path
              fill="rgba(34, 211, 238, 0.18)"
              d="M0,290 C420,190 840,350 1200,210 C1320,165 1400,220 1440,200 L1440,420 L0,420 Z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
