import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Info,
  Music,
  Play,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { CloudAudioTrack, MoodThemeConfig } from '../types';
import {
  ALLOWED_TRACK_CATEGORIES,
  AllowedTrackCategory,
  isValidHttpsAudioUrl,
  sanitizePlainText,
} from '../utils/focusLogic';
import { testAudioPlayability } from '../utils/myMusicDb';

interface AdminTracksViewProps {
  tracks: CloudAudioTrack[];
  themeConfig: MoodThemeConfig;
  isCloudConnected: boolean;
  onSaveTrack: (
    track: Omit<CloudAudioTrack, 'id' | 'createdAt'> & {
      id?: string;
      createdAt?: string;
    }
  ) => Promise<void>;
  onDeleteTrack: (trackId: string) => Promise<void>;
}

export function AdminTracksView({
  tracks,
  themeConfig,
  isCloudConnected,
  onSaveTrack,
  onDeleteTrack,
}: AdminTracksViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<AllowedTrackCategory>('Lo-Fi');
  const [url, setUrl] = useState('');
  const [createdAtHold, setCreatedAtHold] = useState<string | undefined>(
    undefined
  );
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [testResult, setTestResult] = useState<{
    playable: boolean;
    message: string;
  } | null>(null);
  const [listTrackErrors, setListTrackErrors] = useState<
    Record<string, string>
  >({});
  const [testingTrackId, setTestingTrackId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setCategory('Lo-Fi');
    setUrl('');
    setCreatedAtHold(undefined);
    setTestResult(null);
  };

  const handleStartEdit = (track: CloudAudioTrack) => {
    setEditingId(track.id);
    setTitle(track.title);
    const validCat = ALLOWED_TRACK_CATEGORIES.includes(
      track.category as AllowedTrackCategory
    )
      ? (track.category as AllowedTrackCategory)
      : 'Ambient';
    setCategory(validCat);
    setUrl(track.url);
    setCreatedAtHold(track.createdAt);
    setStatusMessage(null);
    setTestResult(null);
  };

  const handleTestFormUrl = async () => {
    setStatusMessage(null);
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setTestResult({
        playable: false,
        message: "This link can't be played: Please enter an https:// audio URL first.",
      });
      return;
    }
    setIsTestingUrl(true);
    try {
      const check = await testAudioPlayability(trimmedUrl);
      if (check.playable) {
        setTestResult({
          playable: true,
          message: 'Audio stream verified! This link plays cleanly.',
        });
      } else {
        setTestResult({
          playable: false,
          message: `This link can't be played: ${check.reason || 'Unplayable audio stream.'}`,
        });
      }
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handleTestPublishedTrack = async (track: CloudAudioTrack) => {
    setTestingTrackId(track.id);
    try {
      const check = await testAudioPlayability(track.url);
      if (check.playable) {
        setListTrackErrors((prev) => {
          const next = { ...prev };
          delete next[track.id];
          return next;
        });
      } else {
        setListTrackErrors((prev) => ({
          ...prev,
          [track.id]: `This link can't be played: ${check.reason || 'Stream unreachable.'}`,
        }));
      }
    } finally {
      setTestingTrackId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeTitle = sanitizePlainText(title, 99);
    const trimmedUrl = url.trim();
    if (!safeTitle) {
      setStatusMessage(
        'Please enter a valid track title (under 100 characters).'
      );
      return;
    }
    if (!ALLOWED_TRACK_CATEGORIES.includes(category)) {
      setStatusMessage('Please select a valid track category.');
      return;
    }
    if (!isValidHttpsAudioUrl(trimmedUrl)) {
      setTestResult({
        playable: false,
        message:
          "This link can't be played: Audio URL must start with https:// and point directly to an audio file.",
      });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    try {
      const check = await testAudioPlayability(trimmedUrl);
      if (!check.playable) {
        setTestResult({
          playable: false,
          message: `This link can't be played: ${check.reason || 'Stream failed validation.'}`,
        });
        setIsSaving(false);
        return;
      }

      await onSaveTrack({
        id: editingId || undefined,
        title: safeTitle,
        category,
        url: trimmedUrl,
        createdAt: createdAtHold,
      });
      setStatusMessage(
        editingId
          ? `Updated track "${safeTitle}".`
          : `Added track "${safeTitle}" to the Focus music player.`
      );
      resetForm();
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Failed to save audio track.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={`p-5 sm:p-6 rounded-2xl ${themeConfig.glassCardClass} flex flex-wrap items-center justify-between gap-4`}
      >
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert
              className="w-5 h-5"
              style={{ color: themeConfig.accentHex }}
            />
            <h1
              className={`text-xl sm:text-2xl font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Admin Audio Tracks Manager
            </h1>
          </div>
          <p
            className={`text-xs sm:text-sm mt-1 ${themeConfig.textSecondaryClass}`}
          >
            Manage Cloud Curated Tracks in{' '}
            <span className="font-mono">tracks/&#123;id&#125;</span>. All tracks
            appear live inside the Focus &amp; Study Room sound mixers alongside
            built-in beats. (
            {isCloudConnected ? 'Firestore Admin Sync' : 'Local Admin Preview'})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Add / Edit Track Form (5 cols) */}
        <div
          className={`lg:col-span-5 p-6 rounded-2xl ${themeConfig.glassCardClass}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              className={`text-base font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              {editingId ? 'Edit Audio Track' : 'Add New Audio Track'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className={`text-xs font-semibold flex items-center gap-1 ${themeConfig.textMutedClass}`}
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {/* Pixabay & Free Music Archive Tip */}
          <div
            data-testid="admin-pixabay-fma-tip"
            className={`mb-4 p-3.5 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 text-xs space-y-1`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Info
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: themeConfig.accentHex }}
              />
              <span className={themeConfig.textPrimaryClass}>
                Tip: Using Pixabay &amp; Free Music Archive
              </span>
            </div>
            <p className={`text-[11px] leading-relaxed ${themeConfig.textSecondaryClass}`}>
              When sourcing royalty-free study beats from{' '}
              <strong>Pixabay Music</strong> or{' '}
              <strong>Free Music Archive (FMA)</strong>, copy the{' '}
              <strong>direct https:// audio file URL</strong> (ending in{' '}
              <span className="font-mono">.mp3</span>,{' '}
              <span className="font-mono">.ogg</span>, or{' '}
              <span className="font-mono">.wav</span>) rather than the webpage
              share link, then click <strong>Test</strong> below to verify
              streaming before saving.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-track-title"
                className={`block text-xs font-semibold mb-1.5 ${themeConfig.textPrimaryClass}`}
              >
                Track Title
              </label>
              <input
                id="admin-track-title"
                type="text"
                maxLength={99}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kyoto Rainy Cafe Lo-Fi"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none ${themeConfig.glassInputClass}`}
                required
              />
            </div>

            <div>
              <label
                htmlFor="admin-track-category"
                className={`block text-xs font-semibold mb-1.5 ${themeConfig.textPrimaryClass}`}
              >
                Category
              </label>
              <select
                id="admin-track-category"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as AllowedTrackCategory)
                }
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none ${themeConfig.glassInputClass}`}
                required
              >
                {ALLOWED_TRACK_CATEGORIES.map((cat) => (
                  <option
                    key={cat}
                    value={cat}
                    className="bg-slate-900 text-white"
                  >
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="admin-track-url"
                className={`block text-xs font-semibold mb-1.5 ${themeConfig.textPrimaryClass}`}
              >
                Direct Audio URL (https:// .mp3, .ogg, .wav)
              </label>
              <div className="flex gap-2">
                <input
                  id="admin-track-url"
                  type="url"
                  maxLength={500}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg"
                  className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs font-mono outline-none ${themeConfig.glassInputClass}`}
                  required
                />
                <button
                  type="button"
                  data-testid="admin-test-track-btn"
                  disabled={isTestingUrl}
                  onClick={() => void handleTestFormUrl()}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 shrink-0 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isTestingUrl ? 'Testing...' : 'Test'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div
                role="alert"
                data-testid="admin-test-track-result"
                className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                  testResult.playable
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300'
                }`}
              >
                {testResult.playable ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {statusMessage && (
              <p
                role="status"
                className={`text-xs font-medium ${themeConfig.textSecondaryClass}`}
              >
                {statusMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 ${themeConfig.buttonBgClass}`}
            >
              <Plus className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Saving...'
                  : editingId
                    ? 'Save Track Changes'
                    : 'Add Track to Collection'}
              </span>
            </button>
          </form>
        </div>

        {/* Tracks Collection List (7 cols) */}
        <div
          className={`lg:col-span-7 p-6 rounded-2xl ${themeConfig.glassCardClass}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              className={`text-base font-bold ${themeConfig.textPrimaryClass}`}
              style={{ fontFamily: themeConfig.fontDisplay }}
            >
              Cloud Curated Tracks ({tracks.length})
            </h2>
          </div>

          {tracks.length === 0 ? (
            <p className={`text-xs ${themeConfig.textMutedClass}`}>
              No custom tracks in the collection yet. Add one on the left!
            </p>
          ) : (
            <div className="space-y-3">
              {tracks.map((track) => {
                const trackErr = listTrackErrors[track.id];
                return (
                  <div
                    key={track.id}
                    data-testid={`admin-track-${track.id}`}
                    className={`p-4 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 space-y-2`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: themeConfig.accentHex }}
                        >
                          <Music className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-bold truncate ${themeConfig.textPrimaryClass}`}
                            >
                              {track.title}
                            </span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/10 font-medium ${themeConfig.textSecondaryClass}`}
                            >
                              {track.category}
                            </span>
                          </div>
                          <div
                            className={`text-xs font-mono truncate mt-0.5 ${themeConfig.textMutedClass}`}
                          >
                            {track.url}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleTestPublishedTrack(track)}
                          aria-label={`Test track ${track.title}`}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
                        >
                          <Play className="w-3 h-3" />
                          <span>
                            {testingTrackId === track.id ? '...' : 'Test'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(track)}
                          aria-label={`Edit track ${track.title}`}
                          className={`p-2 rounded-lg border ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} ${themeConfig.buttonHoverClass}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTrack(track.id)}
                          aria-label={`Delete track ${track.title}`}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/15 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {trackErr && (
                      <div
                        role="alert"
                        className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{trackErr}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
