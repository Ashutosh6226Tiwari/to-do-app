import React from 'react';
import { Heart } from 'lucide-react';
import { MoodThemeConfig } from '../types';

export const APP_NAME = 'Lumo';
export const APP_TAGLINE = 'Student Study Planner & Pomodoro';
export const APP_FULL_TITLE = `${APP_NAME} — ${APP_TAGLINE}`;
export const APP_VERSION = 'v1.0.0';
export const WATERMARK_TEXT = 'Made by Ashu';

/**
 * Generates an SVG data URI for the Lumo favicon, colored with the active mood theme accent.
 * Concept: Rounded glass-style square containing a timer ring with a small sound wave & headphone arc inside.
 */
export function buildLumoFaviconDataUri(accentHex: string = '#0284c7'): string {
  const safeHex = /^#[0-9a-fA-F]{3,8}$/.test(accentHex.trim())
    ? accentHex.trim()
    : '#0284c7';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
    <rect x="2" y="2" width="36" height="36" rx="11" fill="${safeHex}" />
    <rect x="2.75" y="2.75" width="34.5" height="34.5" rx="10.25" stroke="#ffffff" stroke-opacity="0.42" stroke-width="1.5" />
    <path d="M5 12C5 7.58172 8.58172 4 13 4H27C31.4183 4 35 7.58172 35 12V16C26 19 14 19 5 15V12Z" fill="#ffffff" fill-opacity="0.18" />
    <line x1="20" y1="6.5" x2="20" y2="9" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />
    <circle cx="20" cy="21" r="11" stroke="#ffffff" stroke-opacity="0.32" stroke-width="2.2" />
    <path d="M20 10 A11 11 0 1 1 10.47 26.5" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" />
    <path d="M14.8 20.5 A5.2 5.2 0 0 1 25.2 20.5" stroke="#ffffff" stroke-opacity="0.85" stroke-width="1.5" stroke-linecap="round" />
    <line x1="16.5" y1="20" x2="16.5" y2="23.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
    <line x1="20" y1="17.2" x2="20" y2="24.8" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" />
    <line x1="23.5" y1="19.5" x2="23.5" y2="23.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface LumoLogoProps {
  themeConfig: MoodThemeConfig;
  variant?: 'wide' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
  className?: string;
  dataTestId?: string;
}

const SIZE_MAP = {
  sm: {
    box: 'w-8 h-8',
    svg: 'w-8 h-8',
    title: 'text-lg',
    subtitle: 'text-[11px]',
  },
  md: {
    box: 'w-9 h-9',
    svg: 'w-9 h-9',
    title: 'text-xl',
    subtitle: 'text-xs',
  },
  lg: {
    box: 'w-11 h-11',
    svg: 'w-11 h-11',
    title: 'text-2xl',
    subtitle: 'text-xs',
  },
} as const;

/**
 * Lumo Brand Logo:
 * - Rounded glass-style square (matching the mood theme accent color)
 * - Contains a Pomodoro timer ring with a small sound wave & headphone arc inside
 * - Supports `wide` (icon + "Lumo" name) and `icon` (icon-only for mobile)
 */
export function LumoLogo({
  themeConfig,
  variant = 'wide',
  size = 'md',
  subtitle,
  className = '',
  dataTestId,
}: LumoLogoProps) {
  const dims = SIZE_MAP[size];
  const gradientId = React.useId();

  const iconSvg = (
    <div
      className={`${dims.box} rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden shadow-md`}
      style={{
        backgroundColor: themeConfig.accentHex,
        boxShadow: `0 6px 18px -4px ${themeConfig.accentHex}66`,
      }}
      aria-hidden={variant === 'wide' ? 'true' : undefined}
      role={variant === 'icon' ? 'img' : undefined}
      aria-label={variant === 'icon' ? `${APP_NAME} logo` : undefined}
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient
            id={`lumo-sheen-${gradientId}`}
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
            <stop offset="48%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {/* Glass sheen overlay & inner frosted rim */}
        <rect
          x="0"
          y="0"
          width="40"
          height="40"
          rx="11"
          fill={`url(#lumo-sheen-${gradientId})`}
        />
        <rect
          x="1.25"
          y="1.25"
          width="37.5"
          height="37.5"
          rx="10"
          stroke="#ffffff"
          strokeOpacity="0.42"
          strokeWidth="1.5"
        />

        {/* Top glass reflection curve */}
        <path
          d="M4 11C4 6.58172 7.58172 3 12 3H28C32.4183 3 36 6.58172 36 11V14.5C26.5 17.5 13.5 17.5 4 14V11Z"
          fill="#ffffff"
          fillOpacity="0.16"
        />

        {/* Timer top crown tick */}
        <line
          x1="20"
          y1="5.8"
          x2="20"
          y2="8.4"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Timer ring track & active progress arc */}
        <circle
          cx="20"
          cy="21"
          r="11.2"
          stroke="#ffffff"
          strokeOpacity="0.3"
          strokeWidth="2.2"
        />
        <path
          d="M20 9.8 A11.2 11.2 0 1 1 10.3 26.6"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Inner headphone band arc + 3 sound wave bars */}
        <path
          d="M14.6 20.4 A5.4 5.4 0 0 1 25.4 20.4"
          stroke="#ffffff"
          strokeOpacity="0.88"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="16.4"
          y1="19.8"
          x2="16.4"
          y2="23.6"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="20"
          y1="17"
          x2="20"
          y2="25"
          stroke="#ffffff"
          strokeWidth="2.15"
          strokeLinecap="round"
        />
        <line
          x1="23.6"
          y1="19.4"
          x2="23.6"
          y2="23.6"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return (
      <div
        data-testid={dataTestId || 'lumo-logo-icon'}
        className={`inline-flex items-center ${className}`}
        title={APP_FULL_TITLE}
      >
        {iconSvg}
      </div>
    );
  }

  return (
    <div
      data-testid={dataTestId || 'lumo-logo-wide'}
      className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}
    >
      {iconSvg}
      <div className="min-w-0">
        <span
          className={`${dims.title} font-bold tracking-tight block leading-tight whitespace-nowrap ${themeConfig.textPrimaryClass}`}
          style={{ fontFamily: themeConfig.fontDisplay }}
        >
          {APP_NAME}
        </span>
        {subtitle && (
          <p
            className={`${dims.subtitle} truncate mt-0.5 ${themeConfig.textSecondaryClass}`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

interface MadeByAshuWatermarkProps {
  themeConfig: MoodThemeConfig;
  dataTestId?: string;
  className?: string;
}

/**
 * Subtle credit "Made by Ashu" with a small heart icon.
 * Readable across all 5 mood themes while remaining low-contrast and unobtrusive.
 */
export function MadeByAshuWatermark({
  themeConfig,
  dataTestId,
  className = '',
}: MadeByAshuWatermarkProps) {
  return (
    <div
      data-testid={dataTestId}
      className={`inline-flex items-center justify-center gap-1.5 text-[11px] font-medium select-none ${themeConfig.textSecondaryClass} opacity-85 ${className}`}
    >
      <span>Made by Ashu</span>
      <Heart
        className="w-3 h-3 text-rose-500 fill-rose-500/85 shrink-0"
        aria-label="heart"
      />
    </div>
  );
}
