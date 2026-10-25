import React, { useState } from 'react';
import {
  Edit3,
  Music,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { CloudAudioTrack, MoodThemeConfig } from '../types';

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
  const [category, setCategory] = useState('Lo-Fi');
  const [url, setUrl] = useState('');
  const [createdAtHold, setCreatedAtHold] = useState<string | undefined>(
    undefined
  );
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setCategory('Lo-Fi');
    setUrl('');
    setCreatedAtHold(undefined);
  };

  const handleStartEdit = (track: CloudAudioTrack) => {
    setEditingId(track.id);
    setTitle(track.title);
    setCategory(track.category);
    setUrl(track.url);
    setCreatedAtHold(track.createdAt);
    setStatusMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !category.trim() || !url.trim()) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await onSaveTrack({
        id: editingId || undefined,
        title: title.trim(),
        category: category.trim(),
        url: url.trim(),
        createdAt: createdAtHold,
      });
      setStatusMessage(
        editingId
          ? `Updated track "${title.trim()}".`
          : `Added track "${title.trim()}" to the Focus music player.`
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
          <p className={`text-xs sm:text-sm mt-1 ${themeConfig.textSecondaryClass}`}>
            Manage curated ambient tracks in <span className="font-mono">tracks/&#123;id&#125;</span>.
            All tracks appear live inside the Focus music player alongside built-in
            sounds. ({isCloudConnected ? 'Firestore Admin Sync' : 'Local Admin Preview'})
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
                maxLength={100}
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
              <input
                id="admin-track-category"
                type="text"
                maxLength={50}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Lo-Fi, Nature, Classical, Ambient"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none ${themeConfig.glassInputClass}`}
                required
              />
            </div>

            <div>
              <label
                htmlFor="admin-track-url"
                className={`block text-xs font-semibold mb-1.5 ${themeConfig.textPrimaryClass}`}
              >
                Direct Audio URL (.mp3, .ogg, .wav)
              </label>
              <input
                id="admin-track-url"
                type="url"
                maxLength={500}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono outline-none ${themeConfig.glassInputClass}`}
                required
              />
            </div>

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
              Published Focus Tracks ({tracks.length})
            </h2>
          </div>

          {tracks.length === 0 ? (
            <p className={`text-xs ${themeConfig.textMutedClass}`}>
              No custom tracks in the collection yet. Add one on the left!
            </p>
          ) : (
            <div className="space-y-3">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  data-testid={`admin-track-${track.id}`}
                  className={`p-4 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3`}
                >
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
