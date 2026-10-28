import React, { useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  KeyRound,
  Loader2,
  LogIn,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { MoodThemeConfig } from '../types';
import { validateUsername } from '../utils/focusLogic';
import { LumoLogo, MadeByAshuWatermark } from './LumoLogo';

interface AuthGateScreenProps {
  themeConfig: MoodThemeConfig;
  isSigningIn: boolean;
  authError: string | null;
  initialName?: string;
  onGoogleSignIn: (enteredName?: string) => void;
  onAdminEmailSignIn: (email: string, password: string) => Promise<void>;
  onContinueLocalMode: (enteredName?: string) => void;
}

export function GoogleSignInScreen({
  themeConfig,
  isSigningIn,
  authError,
  initialName = '',
  onGoogleSignIn,
  onAdminEmailSignIn,
  onContinueLocalMode,
}: AuthGateScreenProps) {
  const [guestName, setGuestName] = useState(
    initialName && initialName !== 'Guest' ? initialName : ''
  );
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [localAdminError, setLocalAdminError] = useState<string | null>(null);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalAdminError(null);
    const trimmedEmail = adminEmail.trim();
    if (!trimmedEmail || !adminPassword) {
      setLocalAdminError('Please enter both your admin email and password.');
      return;
    }
    try {
      await onAdminEmailSignIn(trimmedEmail, adminPassword);
      setAdminPassword('');
    } catch (err) {
      setLocalAdminError(
        err instanceof Error
          ? err.message
          : 'Failed to sign in with Email and Password.'
      );
    }
  };

  return (
    <div
      data-testid="welcome-screen"
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative z-20"
    >
      <div
        className={`w-full max-w-md p-6 sm:p-8 rounded-3xl shadow-2xl border ${themeConfig.glassCardClass}`}
      >
        <div className="mb-5">
          <LumoLogo
            themeConfig={themeConfig}
            variant="wide"
            size="lg"
            subtitle="Cloud Study Planner · Pomodoro · Friends & Study Rooms"
            dataTestId="signin-brand-logo"
          />
        </div>

        <div className="space-y-3 mb-5">
          <h2
            className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
            style={{ fontFamily: themeConfig.fontDisplay }}
          >
            Welcome to Lumo
          </h2>
          <p
            className={`text-xs leading-relaxed ${themeConfig.textSecondaryClass}`}
          >
            Start focusing right away as a guest, or sign in with Google to
            sync across devices, add friends, join study rooms, and unlock AI
            study tools.
          </p>

          <div>
            <label
              htmlFor="welcome-name-input"
              className={`block text-xs font-semibold mb-1.5 ${themeConfig.textPrimaryClass}`}
            >
              Your Name
            </label>
            <input
              id="welcome-name-input"
              data-testid="welcome-name-input"
              type="text"
              maxLength={60}
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onContinueLocalMode(guestName.trim());
                }
              }}
              placeholder="Enter your name (saved locally)"
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none ${themeConfig.glassInputClass}`}
            />
          </div>
        </div>

        {(authError || localAdminError) && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300"
          >
            {localAdminError || authError}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            data-testid="continue-guest-btn"
            onClick={() => onContinueLocalMode(guestName.trim())}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 shadow-md transition-all ${themeConfig.buttonBgClass}`}
          >
            <span>Continue as guest</span>
          </button>

          <button
            type="button"
            data-testid="google-signin-btn"
            onClick={() => onGoogleSignIn(guestName.trim())}
            disabled={isSigningIn}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-sm border flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
          >
            {isSigningIn && !showAdminForm ? (
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

          {/* Secure Admin Login Option (Firebase Auth Email/Password) */}
          <div
            className={`pt-2 border-t ${themeConfig.borderClass} space-y-3`}
          >
            <button
              type="button"
              onClick={() => {
                setShowAdminForm((prev) => !prev);
                setLocalAdminError(null);
              }}
              aria-expanded={showAdminForm}
              className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs border flex items-center justify-center gap-2 transition-all ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                {showAdminForm ? 'Hide Admin login' : 'Admin login'}
              </span>
            </button>

            {showAdminForm && (
              <form
                onSubmit={handleAdminSubmit}
                data-testid="admin-login-form"
                className={`p-4 rounded-2xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 space-y-3`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <ShieldCheck
                    className="w-4 h-4"
                    style={{ color: themeConfig.accentHex }}
                  />
                  <span className={themeConfig.textPrimaryClass}>
                    Admin Email & Password Sign-In
                  </span>
                </div>
                <p className={`text-[11px] ${themeConfig.textMutedClass}`}>
                  Authenticates via Firebase Authentication Email/Password. Admin
                  Panel access requires <span className="font-mono">users/&#123;uid&#125;.role === &quot;admin&quot;</span>.
                </p>

                <div>
                  <label
                    htmlFor="admin-login-email"
                    className={`block text-xs font-semibold mb-1 ${themeConfig.textPrimaryClass}`}
                  >
                    Admin Email
                  </label>
                  <input
                    id="admin-login-email"
                    type="email"
                    autoComplete="username"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Enter admin email"
                    className={`w-full px-3 py-2 rounded-xl text-xs outline-none ${themeConfig.glassInputClass}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-login-password"
                    className={`block text-xs font-semibold mb-1 ${themeConfig.textPrimaryClass}`}
                  >
                    Password
                  </label>
                  <input
                    id="admin-login-password"
                    type="password"
                    autoComplete="current-password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter password"
                    className={`w-full px-3 py-2 rounded-xl text-xs outline-none ${themeConfig.glassInputClass}`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSigningIn}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 ${themeConfig.buttonBgClass}`}
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Sign in as Admin</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={`mt-5 pt-3.5 border-t ${themeConfig.borderClass} flex justify-center`}>
          <MadeByAshuWatermark
            themeConfig={themeConfig}
            dataTestId="signin-watermark"
          />
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
          <LumoLogo
            themeConfig={themeConfig}
            variant="icon"
            size="md"
            dataTestId="onboarding-brand-logo"
          />
          <div>
            <h2
              id="claim-username-title"
              className={`text-lg font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Welcome to Lumo — Choose Your Username
            </h2>
            <p className={`text-xs ${themeConfig.textMutedClass}`}>
              Hi {displayName || email}! Claim your unique student handle once.
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

        <div className={`mt-5 pt-3.5 border-t ${themeConfig.borderClass} flex justify-center`}>
          <MadeByAshuWatermark
            themeConfig={themeConfig}
            dataTestId="onboarding-watermark"
          />
        </div>
      </div>
    </div>
  );
}
