import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Cloud,
  Loader2,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { MoodThemeConfig } from '../types';
import { validateUsername } from '../utils/focusLogic';

interface AuthGateScreenProps {
  themeConfig: MoodThemeConfig;
  isSigningIn: boolean;
  authError: string | null;
  onGoogleSignIn: () => void;
  onContinueLocalMode: () => void;
}

export function GoogleSignInScreen({
  themeConfig,
  isSigningIn,
  authError,
  onGoogleSignIn,
  onContinueLocalMode,
}: AuthGateScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative z-20">
      <div
        className={`w-full max-w-md p-6 sm:p-8 rounded-3xl shadow-2xl border ${themeConfig.glassCardClass}`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
            style={{ backgroundColor: themeConfig.accentHex }}
          >
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1
              className={`text-2xl font-bold tracking-tight ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              FocusFlow
            </h1>
            <p className={`text-xs ${themeConfig.textSecondaryClass}`}>
              Cloud Study Planner · Pomodoro · Friends & Study Rooms
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <h2
            className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
            style={{ fontFamily: themeConfig.fontDisplay }}
          >
            Sign in to sync your study flow
          </h2>
          <p className={`text-xs leading-relaxed ${themeConfig.textSecondaryClass}`}>
            Sign in with Google to claim your unique student username, back up your
            existing localStorage tasks & XP to Firestore, compete on Friend
            Leaderboards, and join live Study Rooms.
          </p>

          <div
            className={`p-3.5 rounded-2xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 space-y-2 text-xs ${themeConfig.textSecondaryClass}`}
          >
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 shrink-0 text-sky-500" />
              <span>Automatic one-time local data migration to Firestore</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
              <span>Real-time Study Rooms (up to 10 students) & Leaderboards</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>Zero-trust Firestore security rules & role protection</span>
            </div>
          </div>
        </div>

        {authError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300"
          >
            {authError}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={isSigningIn}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 shadow-md transition-all disabled:opacity-60 ${themeConfig.buttonBgClass}`}
          >
            {isSigningIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onContinueLocalMode}
            className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs border transition-all ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
          >
            Continue in Local Workspace (Offline / Preview Mode)
          </button>
        </div>
      </div>
    </div>
  );
}

interface UsernameClaimModalProps {
  displayName: string;
  email: string;
  themeConfig: MoodThemeConfig;
  isSubmitting: boolean;
  error: string | null;
  onClaimUsername: (username: string) => Promise<void>;
  onSignOut: () => void;
}

export function UsernameClaimModal({
  displayName,
  email,
  themeConfig,
  isSubmitting,
  error,
  onClaimUsername,
  onSignOut,
}: UsernameClaimModalProps) {
  const defaultSuggested = (displayName || email.split('@')[0] || 'student')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 16);

  const [usernameInput, setUsernameInput] = useState(
    defaultSuggested.length >= 3 ? defaultSuggested : `${defaultSuggested}_26`
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateUsername(usernameInput);
    if (!check.valid) {
      setLocalError(check.error || 'Invalid username.');
      return;
    }
    setLocalError(null);
    await onClaimUsername(check.trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-username-title"
    >
      <div
        className={`w-full max-w-md p-6 sm:p-7 rounded-3xl shadow-2xl border ${themeConfig.glassCardClass}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: themeConfig.accentHex }}
          >
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="claim-username-title"
              className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Choose Your Unique Username
            </h2>
            <p className={`text-xs ${themeConfig.textMutedClass}`}>
              Welcome, {displayName || email}! Claim your handle once.
            </p>
          </div>
        </div>

        <p className={`text-xs leading-relaxed mb-4 ${themeConfig.textSecondaryClass}`}>
          Your username is stored in <span className="font-mono">usernames/&#123;usernameLower&#125;</span> so
          classmates can find you and invite you to leaderboards. Existing local tasks,
          sessions, XP, and streaks will be migrated automatically.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="unique-username-input"
              className={`block text-xs font-semibold mb-1.5 ${themeConfig.textPrimaryClass}`}
            >
              Student Username (3–20 characters, letters, numbers, _)
            </label>
            <div className="relative">
              <span
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono ${themeConfig.textMutedClass}`}
              >
                @
              </span>
              <input
                id="unique-username-input"
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                maxLength={20}
                placeholder="maya_lin"
                className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl text-sm font-mono outline-none ${themeConfig.glassInputClass}`}
                required
              />
            </div>
          </div>

          {(localError || error) && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300"
            >
              {localError || error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onSignOut}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${themeConfig.borderClass} ${themeConfig.textSecondaryClass}`}
            >
              Sign Out
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 ${themeConfig.buttonBgClass}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Claiming & Migrating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Claim Username & Sync Cloud</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
