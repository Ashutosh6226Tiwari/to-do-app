import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bird,
  Bug,
  Check,
  CheckCircle2,
  CloudLightning,
  CloudRain,
  Disc3,
  Edit3,
  Flame,
  HardDrive,
  Headphones,
  Link2,
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import {
  CloudAudioTrack,
  MoodThemeConfig,
  MoodThemeId,
  MyMusicTrack,
} from '../types';
import {
  BUILT_IN_SOUND_CATEGORIES,
  BUILT_IN_SOUNDS,
  BuiltInSoundCategory,
  BuiltInTrackId,
  classifyCuratedTrackError,
  isValidHttpsAudioUrl,
  sanitizePlainText,
  sanitizeRoomVibe,
  validateCustomAudioFile,
} from '../utils/focusLogic';
import {
  addMyMusicFileTrack,
  addMyMusicLinkTrack,
  deleteMyMusicTrack,
  getMyMusicPlaybackSource,
  loadAllMyMusicTracks,
  renameMyMusicTrack,
  testAudioPlayability,
  toggleMyMusicTrackLoop,
} from '../utils/myMusicDb';
import { MixerSnapshot, soundEngine } from '../utils/soundEngine';
import { MOOD_THEMES } from '../utils/themes';

interface RoomVibeContext {
  isHost: boolean;
  currentVibe?: string;
  onHostChangeVibe: (nextVibe: string) => Promise<void>;
}

interface SoundMixerPanelProps {
  themeConfig: MoodThemeConfig;
  customTracks?: CloudAudioTrack[];
  roomContext?: RoomVibeContext;
  compact?: boolean;
}

const MOOD_TAG_LABELS: Record<MoodThemeId, string> = {
  calm: 'Calm',
  cozy: 'Cozy',
  'deep-focus': 'Deep Focus',
  fresh: 'Fresh',
  energetic: 'Energetic',
};

function getBuiltInIcon(id: BuiltInTrackId) {
  switch (id) {
    case 'rain':
      return CloudRain;
    case 'thunderstorm':
      return CloudLightning;
    case 'fireplace':
      return Flame;
    case 'birds':
      return Bird;
    case 'crickets':
      return Bug;
    case 'lofi':
    case 'lofichill':
      return Disc3;
    case 'alphawaves':
      return Radio;
    case 'ocean':
    case 'whitenoise':
    case 'pinknoise':
    case 'brownnoise':
    default:
      return Waves;
  }
}

export function SoundMixerPanel({
  themeConfig,
  customTracks = [],
  roomContext,
  compact = false,
}: SoundMixerPanelProps) {
  const [mixerSnap, setMixerSnap] = useState<MixerSnapshot>(() =>
    soundEngine.getMixerSnapshot()
  );
  const [selectedCategory, setSelectedCategory] = useState<
    'All' | BuiltInSoundCategory
  >('All');
  const [activeTab, setActiveTab] = useState<'beats' | 'mymusic' | 'curated'>(
    'beats'
  );
  const [hideBrokenTracks, setHideBrokenTracks] = useState(false);

  // My Music state (loaded from IndexedDB)
  const [myTracks, setMyTracks] = useState<MyMusicTrack[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'file' | 'link'>('file');
  const [newTrackName, setNewTrackName] = useState('');
  const [newTrackMood, setNewTrackMood] = useState<MoodThemeId>(
    themeConfig.id
  );
  const [newTrackUrl, setNewTrackUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [myMusicError, setMyMusicError] = useState<string | null>(null);
  const [myMusicSuccess, setMyMusicSuccess] = useState<string | null>(null);
  const [isTestingLink, setIsTestingLink] = useState(false);
  const [linkTestResult, setLinkTestResult] = useState<{
    testedUrl: string;
    playable: boolean;
    message: string;
  } | null>(null);
  const [isSavingMyTrack, setIsSavingMyTrack] = useState(false);

  // Inline rename state for My Music
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Subscribe to singleton soundEngine
  useEffect(() => {
    return soundEngine.subscribe((snap) => {
      setMixerSnap(snap);
    });
  }, []);

  const refreshMyTracks = useCallback(async () => {
    const loaded = await loadAllMyMusicTracks();
    setMyTracks(loaded);
  }, []);

  useEffect(() => {
    void refreshMyTracks();
  }, [refreshMyTracks]);

  const resolveExternalLayerForResume = useCallback(
    async (layerId: string) => {
      if (layerId.startsWith('track:')) {
        const trackId = layerId.slice('track:'.length);
        const found = customTracks.find((t) => t.id === trackId);
        if (!found || !isValidHttpsAudioUrl(found.url)) return null;
        return {
          title: found.title,
          src: found.url.trim(),
          loop: true,
          isObjectUrl: false,
        };
      }
      if (layerId.startsWith('custom:')) {
        const customId = layerId.slice('custom:'.length);
        const foundMeta = myTracks.find((t) => t.id === customId);
        const source = await getMyMusicPlaybackSource(customId);
        if (!source) return null;
        return {
          title: foundMeta?.name || 'Custom Track',
          src: source.src,
          loop: source.loop,
          isObjectUrl: source.isObjectUrl,
        };
      }
      return null;
    },
    [customTracks, myTracks]
  );

  const handleTapToPlayResume = () => {
    soundEngine.resumeBlockedPlayback(resolveExternalLayerForResume);
  };

  const handleToggleBuiltIn = (trackId: BuiltInTrackId) => {
    soundEngine.toggleBuiltInLayer(trackId);
  };

  const handleToggleCuratedTrack = (track: CloudAudioTrack) => {
    const layerId = `track:${track.id}`;
    soundEngine.toggleExternalLayer({
      layerId,
      title: track.title,
      src: (track.url || '').trim(),
      loop: true,
      isObjectUrl: false,
    });
  };

  const handleToggleMyMusicTrack = async (track: MyMusicTrack) => {
    const layerId = `custom:${track.id}`;
    if (mixerSnap.activeLayerIds.includes(layerId)) {
      soundEngine.toggleExternalLayer({
        layerId,
        title: track.name,
        src: '',
      });
      return;
    }
    setMyMusicError(null);
    const source = await getMyMusicPlaybackSource(track.id);
    if (!source) {
      setMyMusicError(
        `This track ("${track.name}") could not be loaded from device storage.`
      );
      return;
    }
    soundEngine.startExternalLayer({
      layerId,
      title: track.name,
      src: source.src,
      loop: source.loop,
      isObjectUrl: source.isObjectUrl,
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMyMusicError(null);
    setMyMusicSuccess(null);
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const validation = validateCustomAudioFile(file);
    if (!validation.valid) {
      setSelectedFile(null);
      setMyMusicError(validation.error || 'Invalid audio file.');
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
    if (!newTrackName.trim()) {
      setNewTrackName(file.name.replace(/\.[^.]+$/, '').slice(0, 80));
    }
  };

  const handleTestCustomLink = async () => {
    setMyMusicError(null);
    const trimmed = newTrackUrl.trim();
    if (!trimmed) {
      setLinkTestResult({
        testedUrl: '',
        playable: false,
        message: 'Please paste a direct https:// audio link first.',
      });
      return;
    }
    setIsTestingLink(true);
    try {
      const res = await testAudioPlayability(trimmed);
      setLinkTestResult({
        testedUrl: trimmed,
        playable: res.playable,
        message: res.playable
          ? 'Link verified! Audio stream is valid and playable.'
          : `This link can't be played: ${res.reason || 'Unplayable audio stream.'}`,
      });
    } finally {
      setIsTestingLink(false);
    }
  };

  const handleAddMyTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMyMusicError(null);
    setMyMusicSuccess(null);

    const safeName = sanitizePlainText(newTrackName, 80);
    if (!safeName) {
      setMyMusicError('Please enter a name for your track.');
      return;
    }

    if (addMode === 'file') {
      if (!selectedFile) {
        setMyMusicError(
          'Please choose an .mp3, .wav, .ogg, or .m4a file (max 20 MB).'
        );
        return;
      }
      const check = validateCustomAudioFile(selectedFile);
      if (!check.valid) {
        setMyMusicError(check.error || 'Unsupported file.');
        return;
      }
      setIsSavingMyTrack(true);
      try {
        const created = await addMyMusicFileTrack({
          file: selectedFile,
          name: safeName,
          moodTag: newTrackMood,
        });
        await refreshMyTracks();
        setNewTrackName('');
        setSelectedFile(null);
        setShowAddForm(false);
        setMyMusicSuccess(
          `Saved "${created.name}" to IndexedDB on this device.`
        );
      } catch (err) {
        setMyMusicError(
          err instanceof Error ? err.message : 'Failed to save audio file.'
        );
      } finally {
        setIsSavingMyTrack(false);
      }
    } else {
      const trimmedUrl = newTrackUrl.trim();
      if (!isValidHttpsAudioUrl(trimmedUrl)) {
        setMyMusicError(
          'Unsupported link: URL must start with https:// and point to a valid audio stream.'
        );
        return;
      }
      setIsSavingMyTrack(true);
      try {
        const playCheck = await testAudioPlayability(trimmedUrl);
        if (!playCheck.playable) {
          setMyMusicError(
            `This link can't be played: ${playCheck.reason || 'Invalid audio stream.'}`
          );
          setIsSavingMyTrack(false);
          return;
        }
        const created = await addMyMusicLinkTrack({
          url: trimmedUrl,
          name: safeName,
          moodTag: newTrackMood,
        });
        await refreshMyTracks();
        setNewTrackName('');
        setNewTrackUrl('');
        setLinkTestResult(null);
        setShowAddForm(false);
        setMyMusicSuccess(`Added "${created.name}" to My Music.`);
      } catch (err) {
        setMyMusicError(
          err instanceof Error ? err.message : 'Failed to add audio link.'
        );
      } finally {
        setIsSavingMyTrack(false);
      }
    }
  };

  const handleConfirmRename = async (trackId: string) => {
    const clean = sanitizePlainText(renameInput, 80);
    if (!clean) return;
    await renameMyMusicTrack(trackId, clean);
    setRenamingId(null);
    setRenameInput('');
    await refreshMyTracks();
  };

  const handleToggleLoop = async (track: MyMusicTrack) => {
    const nextLoop = !track.loop;
    await toggleMyMusicTrackLoop(track.id, nextLoop);
    soundEngine.updateExternalLayerLoop(`custom:${track.id}`, nextLoop);
    await refreshMyTracks();
  };

  const handleDeleteMyTrack = async (trackId: string) => {
    soundEngine.stopExternalLayer(`custom:${trackId}`);
    await deleteMyMusicTrack(trackId);
    await refreshMyTracks();
  };

  // Room Vibe helpers
  const activeRoomVibe = sanitizeRoomVibe(roomContext?.currentVibe || '');
  const roomVibeLabel = useMemo(() => {
    if (!activeRoomVibe) return null;
    if (activeRoomVibe.startsWith('builtin:')) {
      const id = activeRoomVibe.slice('builtin:'.length) as BuiltInTrackId;
      const spec = BUILT_IN_SOUNDS.find((s) => s.id === id);
      return spec ? `${spec.label} (${spec.category})` : null;
    }
    if (activeRoomVibe.startsWith('track:')) {
      const id = activeRoomVibe.slice('track:'.length);
      const found = customTracks.find((t) => t.id === id);
      return found ? `${found.title} (${found.category})` : 'Curated Track';
    }
    return null;
  }, [activeRoomVibe, customTracks]);

  const isRoomVibePlaying = Boolean(
    activeRoomVibe && mixerSnap.activeLayerIds.includes(activeRoomVibe)
  );

  const handlePlayRoomVibe = () => {
    if (!activeRoomVibe) return;
    if (activeRoomVibe.startsWith('builtin:')) {
      const id = activeRoomVibe.slice('builtin:'.length) as BuiltInTrackId;
      soundEngine.toggleBuiltInLayer(id);
    } else if (activeRoomVibe.startsWith('track:')) {
      const id = activeRoomVibe.slice('track:'.length);
      const found = customTracks.find((t) => t.id === id);
      if (found) {
        handleToggleCuratedTrack(found);
      }
    }
  };

  const filteredBuiltInSounds = useMemo(() => {
    if (selectedCategory === 'All') return BUILT_IN_SOUNDS;
    return BUILT_IN_SOUNDS.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  // Sort My Music tracks: if autoSuggestByMood is enabled, surface tracks matching current themeConfig.id first
  const sortedMyTracks = useMemo(() => {
    if (!mixerSnap.autoSuggestByMood) return myTracks;
    return [...myTracks].sort((a, b) => {
      const aMatch = a.moodTag === themeConfig.id ? 1 : 0;
      const bMatch = b.moodTag === themeConfig.id ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [myTracks, mixerSnap.autoSuggestByMood, themeConfig.id]);

  const suggestedMoodTracksCount = useMemo(
    () => myTracks.filter((t) => t.moodTag === themeConfig.id).length,
    [myTracks, themeConfig.id]
  );

  const activeCount = mixerSnap.activeLayerIds.length;

  return (
    <div
      data-testid="sound-mixer-panel"
      className={`p-5 rounded-2xl ${themeConfig.glassCardClass}`}
    >
      {/* Top Header: Title + Active Layers Badge + Stop All */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Headphones
            className="w-4 h-4 shrink-0"
            style={{ color: themeConfig.accentHex }}
          />
          <h2
            className={`text-base font-bold ${themeConfig.textPrimaryClass}`}
            style={{ fontFamily: themeConfig.fontDisplay }}
          >
            Soundscape Mixer
          </h2>
          {activeCount > 0 && (
            <span
              data-testid="mixer-active-count"
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
            >
              {activeCount} {activeCount === 1 ? 'layer' : 'layers'} playing
            </span>
          )}
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => soundEngine.stopAllLayers()}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} hover:bg-rose-500/15 hover:text-rose-500`}
          >
            Stop All
          </button>
        )}
      </div>

      {/* Browser Autoplay Blocked / Saved Mix "Tap to Play" Banner */}
      {(mixerSnap.autoplayBlocked ||
        mixerSnap.pendingSavedLayerIds.length > 0) && (
        <div
          data-testid="tap-to-play-banner"
          className="mb-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-3"
        >
          <div className="text-xs">
            <span className={`font-bold block ${themeConfig.textPrimaryClass}`}>
              Tap to play your sound mix
            </span>
            <span className={themeConfig.textSecondaryClass}>
              Browser paused audio until you interact. Click to start your{' '}
              {mixerSnap.pendingSavedLayerIds.length > 0
                ? `${mixerSnap.pendingSavedLayerIds.length} saved sound layer(s)`
                : 'selected audio'}
              .
            </span>
          </div>
          <button
            type="button"
            onClick={handleTapToPlayResume}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 ${themeConfig.buttonBgClass}`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Tap to Play</span>
          </button>
        </div>
      )}

      {/* Study Room Vibe Section (only rendered when inside a Study Room) */}
      {roomContext && (
        <div
          data-testid="room-vibe-section"
          className={`mb-4 p-3.5 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 space-y-2.5`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Radio
                className="w-3.5 h-3.5"
                style={{ color: themeConfig.accentHex }}
              />
              <span
                className={`text-xs font-bold ${themeConfig.textPrimaryClass}`}
              >
                Room Vibe:{' '}
                <span className="font-semibold">
                  {roomVibeLabel || 'None set by host'}
                </span>
              </span>
            </div>

            {activeRoomVibe && (
              <button
                type="button"
                data-testid="play-room-vibe-btn"
                onClick={handlePlayRoomVibe}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isRoomVibePlaying
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40'
                    : themeConfig.buttonBgClass
                }`}
              >
                {isRoomVibePlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Playing Room Vibe</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play room vibe</span>
                  </>
                )}
              </button>
            )}
          </div>

          {roomContext.isHost && (
            <div className="pt-2 border-t border-black/5 dark:border-white/10">
              <label
                htmlFor="host-room-vibe-select"
                className={`block text-[11px] font-semibold mb-1 ${themeConfig.textSecondaryClass}`}
              >
                Host Room Vibe (shared with members · private uploaded files are
                never shared)
              </label>
              <select
                id="host-room-vibe-select"
                data-testid="host-room-vibe-select"
                value={activeRoomVibe}
                onChange={(e) =>
                  void roomContext.onHostChangeVibe(
                    sanitizeRoomVibe(e.target.value)
                  )
                }
                className={`w-full px-3 py-1.5 rounded-xl text-xs font-medium outline-none ${themeConfig.glassInputClass}`}
              >
                <option value="">No shared room vibe</option>
                <optgroup label="Built-in Procedural Beats">
                  {BUILT_IN_SOUNDS.map((s) => (
                    <option key={s.id} value={`builtin:${s.id}`}>
                      [{s.category}] {s.label}
                    </option>
                  ))}
                </optgroup>
                {customTracks.length > 0 && (
                  <optgroup label="Cloud Curated Tracks">
                    {customTracks.map((ct) => (
                      <option key={ct.id} value={`track:${ct.id}`}>
                        [{ct.category}] {ct.title}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Master Volume Control */}
      <div className="mb-4 p-3 rounded-xl bg-black/5 dark:bg-white/5 flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            soundEngine.setMasterVolume(mixerSnap.masterVolume > 0 ? 0 : 0.75)
          }
          aria-label={
            mixerSnap.masterVolume === 0
              ? 'Unmute master volume'
              : 'Mute master volume'
          }
          className={`p-1 rounded-lg ${themeConfig.textSecondaryClass}`}
        >
          {mixerSnap.masterVolume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        <span
          className={`text-xs font-semibold whitespace-nowrap ${themeConfig.textSecondaryClass}`}
        >
          Master
        </span>
        <input
          type="range"
          aria-label="Master sound mixer volume"
          min={0}
          max={1}
          step={0.05}
          value={mixerSnap.masterVolume}
          onChange={(e) => soundEngine.setMasterVolume(Number(e.target.value))}
          className="flex-1 accent-sky-600 cursor-pointer"
        />
        <span
          className={`text-xs font-mono tabular-nums w-10 text-right ${themeConfig.textMutedClass}`}
        >
          {Math.round(mixerSnap.masterVolume * 100)}%
        </span>
      </div>

      {/* Section Switcher Tabs: Built-in Beats | My Music | Curated Tracks */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10 mb-3"
        role="tablist"
        aria-label="Music mixer sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'beats'}
          onClick={() => setActiveTab('beats')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'beats'
              ? themeConfig.activeTabClass
              : themeConfig.textSecondaryClass
          }`}
        >
          Built-in Beats ({BUILT_IN_SOUNDS.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'mymusic'}
          onClick={() => setActiveTab('mymusic')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'mymusic'
              ? themeConfig.activeTabClass
              : themeConfig.textSecondaryClass
          }`}
        >
          My Music ({myTracks.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'curated'}
          onClick={() => setActiveTab('curated')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'curated'
              ? themeConfig.activeTabClass
              : themeConfig.textSecondaryClass
          }`}
        >
          Curated ({customTracks.length})
        </button>
      </div>

      {/* TAB 1: BUILT-IN PROCEDURAL BEATS (Nature, Noise, Beats, Brainwaves) */}
      {activeTab === 'beats' && (
        <div className="space-y-3">
          {/* Category Filter Bar */}
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Built-in sound categories"
          >
            {(['All', ...BUILT_IN_SOUND_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  selectedCategory === cat
                    ? themeConfig.activeTabClass
                    : `border ${themeConfig.borderClass} ${themeConfig.textSecondaryClass} hover:opacity-85`
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid of Built-in Beats with individual layer volume sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredBuiltInSounds.map((spec) => {
              const layerId = `builtin:${spec.id}`;
              const isPlaying = mixerSnap.activeLayerIds.includes(layerId);
              const isPreviewing = mixerSnap.previewTrackId === spec.id;
              const layerVol = mixerSnap.layerVolumes[layerId] ?? 0.65;
              const Icon = getBuiltInIcon(spec.id);

              return (
                <div
                  key={spec.id}
                  data-testid={`sound-card-${spec.id}`}
                  className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                    isPlaying
                      ? `${themeConfig.activeTabClass} shadow-sm`
                      : isPreviewing
                        ? `border-sky-500/60 bg-sky-500/10 ${themeConfig.textPrimaryClass} shadow-sm`
                        : `${themeConfig.borderClass} ${themeConfig.textPrimaryClass} bg-white/30 dark:bg-slate-900/30`
                  }`}
                >
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => handleToggleBuiltIn(spec.id)}
                      aria-pressed={isPlaying}
                      className="w-full text-left flex items-center gap-1.5"
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold truncate">
                        {spec.label}
                      </span>
                    </button>

                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] opacity-75 truncate">
                        {spec.category}
                      </span>
                      <button
                        type="button"
                        data-testid={`preview-builtin-${spec.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEngine.previewBuiltInTrack(spec.id);
                        }}
                        aria-label={
                          isPreviewing
                            ? `Stop preview of ${spec.label}`
                            : `Preview ${spec.label} (3-second sample)`
                        }
                        title="Play 3-second preview sample"
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors shrink-0 ${
                          isPreviewing
                            ? 'bg-sky-500 text-white border-sky-400'
                            : `${themeConfig.borderClass} bg-black/5 dark:bg-white/10 hover:opacity-90`
                        }`}
                      >
                        {isPreviewing ? 'Previewing (3s)…' : 'Preview'}
                      </button>
                    </div>
                  </div>

                  {spec.note && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/15 dark:bg-white/15 text-[10px] font-semibold w-fit">
                      <Headphones className="w-2.5 h-2.5" />
                      {spec.note}
                    </span>
                  )}

                  {/* Per-sound volume slider */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-black/10 dark:border-white/10">
                    <input
                      type="range"
                      aria-label={`${spec.label} volume`}
                      min={0}
                      max={1}
                      step={0.05}
                      value={layerVol}
                      onChange={(e) =>
                        soundEngine.setLayerVolume(
                          layerId,
                          Number(e.target.value)
                        )
                      }
                      className="w-full h-1.5 accent-sky-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-mono tabular-nums opacity-80 w-7 text-right">
                      {Math.round(layerVol * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MY MUSIC (Custom Uploaded Files in IndexedDB & Direct HTTPS Links) */}
      {activeTab === 'mymusic' && (
        <div className="space-y-3" data-testid="my-music-section">
          {/* Device Privacy Note & Mood Auto-Suggest Toggle */}
          <div
            className={`p-3 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 space-y-2`}
          >
            <div className="flex items-start gap-2 text-[11px]">
              <HardDrive className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-500" />
              <span className={themeConfig.textSecondaryClass}>
                Uploaded files (.mp3, .wav, .ogg, .m4a up to 20 MB) are saved in{' '}
                <strong>IndexedDB</strong> and{' '}
                <strong>stay on this device only</strong>.
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={mixerSnap.autoSuggestByMood}
                onChange={(e) =>
                  soundEngine.setAutoSuggestByMood(e.target.checked)
                }
                className="rounded"
              />
              <span className={themeConfig.textPrimaryClass}>
                Auto-suggest my tracks for the current mood theme (
                {MOOD_THEMES[themeConfig.id].name})
              </span>
            </label>
          </div>

          {/* Add Track Toggle Button */}
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold ${themeConfig.textSecondaryClass}`}
            >
              {mixerSnap.autoSuggestByMood && suggestedMoodTracksCount > 0
                ? `${suggestedMoodTracksCount} track(s) matched for ${MOOD_THEMES[themeConfig.id].name}`
                : 'Your custom study tracks'}
            </span>
            <button
              type="button"
              data-testid="toggle-add-my-music-btn"
              onClick={() => {
                setShowAddForm((prev) => !prev);
                setMyMusicError(null);
                setMyMusicSuccess(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${themeConfig.buttonBgClass}`}
            >
              {showAddForm ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Close</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add My Track</span>
                </>
              )}
            </button>
          </div>

          {myMusicError && (
            <div
              role="alert"
              data-testid="my-music-error"
              className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{myMusicError}</span>
            </div>
          )}

          {myMusicSuccess && (
            <div
              role="status"
              className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{myMusicSuccess}</span>
            </div>
          )}

          {/* Add Custom Track Form */}
          {showAddForm && (
            <form
              onSubmit={handleAddMyTrackSubmit}
              className={`p-3.5 rounded-xl border ${themeConfig.borderClass} bg-black/5 dark:bg-white/5 space-y-3`}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode('file');
                    setMyMusicError(null);
                  }}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                    addMode === 'file'
                      ? themeConfig.activeTabClass
                      : `${themeConfig.textSecondaryClass} border ${themeConfig.borderClass}`
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File (max 20 MB)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddMode('link');
                    setMyMusicError(null);
                  }}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                    addMode === 'link'
                      ? themeConfig.activeTabClass
                      : `${themeConfig.textSecondaryClass} border ${themeConfig.borderClass}`
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Paste HTTPS Link</span>
                </button>
              </div>

              {addMode === 'file' ? (
                <div>
                  <label
                    htmlFor="my-music-file-input"
                    className={`block text-[11px] font-semibold mb-1 ${themeConfig.textPrimaryClass}`}
                  >
                    Audio File (.mp3, .wav, .ogg, .m4a · max 20 MB)
                  </label>
                  <input
                    id="my-music-file-input"
                    type="file"
                    accept=".mp3,.wav,.ogg,.m4a,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a"
                    onChange={handleFileInputChange}
                    className={`w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold ${themeConfig.textSecondaryClass}`}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label
                    htmlFor="my-music-link-input"
                    className={`block text-[11px] font-semibold ${themeConfig.textPrimaryClass}`}
                  >
                    Direct HTTPS Audio URL (.mp3, .ogg, .wav, .m4a)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="my-music-link-input"
                      type="url"
                      value={newTrackUrl}
                      onChange={(e) => {
                        setNewTrackUrl(e.target.value);
                        setLinkTestResult(null);
                      }}
                      placeholder="https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg"
                      className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-mono outline-none ${themeConfig.glassInputClass}`}
                    />
                    <button
                      type="button"
                      data-testid="my-music-test-link-btn"
                      disabled={isTestingLink}
                      onClick={() => void handleTestCustomLink()}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border shrink-0 ${themeConfig.borderClass} ${themeConfig.textPrimaryClass} ${themeConfig.buttonHoverClass}`}
                    >
                      {isTestingLink ? 'Testing...' : 'Test link'}
                    </button>
                  </div>

                  {linkTestResult && (
                    <div
                      data-testid="my-music-test-link-result"
                      className={`p-2 rounded-lg text-[11px] font-medium ${
                        linkTestResult.playable
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                      }`}
                    >
                      {linkTestResult.message}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="my-music-name-input"
                    className={`block text-[11px] font-semibold mb-1 ${themeConfig.textPrimaryClass}`}
                  >
                    Track Name
                  </label>
                  <input
                    id="my-music-name-input"
                    type="text"
                    maxLength={80}
                    value={newTrackName}
                    onChange={(e) => setNewTrackName(e.target.value)}
                    placeholder="e.g. Late Night Piano Loop"
                    className={`w-full px-3 py-1.5 rounded-xl text-xs outline-none ${themeConfig.glassInputClass}`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="my-music-mood-select"
                    className={`block text-[11px] font-semibold mb-1 ${themeConfig.textPrimaryClass}`}
                  >
                    Mood Tag
                  </label>
                  <select
                    id="my-music-mood-select"
                    value={newTrackMood}
                    onChange={(e) =>
                      setNewTrackMood(e.target.value as MoodThemeId)
                    }
                    className={`w-full px-3 py-1.5 rounded-xl text-xs outline-none ${themeConfig.glassInputClass}`}
                  >
                    {(Object.keys(MOOD_TAG_LABELS) as MoodThemeId[]).map(
                      (mId) => (
                        <option key={mId} value={mId}>
                          {MOOD_TAG_LABELS[mId]}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingMyTrack}
                className={`w-full py-2 rounded-xl text-xs font-semibold ${themeConfig.buttonBgClass}`}
              >
                {isSavingMyTrack ? 'Verifying & Saving...' : 'Save to My Music'}
              </button>
            </form>
          )}

          {/* My Music Tracks List */}
          {sortedMyTracks.length === 0 ? (
            <p className={`text-xs py-2 ${themeConfig.textMutedClass}`}>
              No custom tracks added yet. Upload an audio file or paste a direct
              HTTPS link above!
            </p>
          ) : (
            <div className="space-y-2">
              {sortedMyTracks.map((track) => {
                const layerId = `custom:${track.id}`;
                const isPlaying = mixerSnap.activeLayerIds.includes(layerId);
                const layerVol = mixerSnap.layerVolumes[layerId] ?? 0.7;
                const isMoodSuggested =
                  mixerSnap.autoSuggestByMood &&
                  track.moodTag === themeConfig.id;
                const errText = mixerSnap.trackErrors[layerId];

                return (
                  <div
                    key={track.id}
                    data-testid={`my-music-item-${track.id}`}
                    className={`p-3 rounded-xl border transition-all space-y-2 ${
                      isPlaying
                        ? `${themeConfig.activeTabClass}`
                        : `${themeConfig.borderClass} bg-white/30 dark:bg-slate-900/30`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => void handleToggleMyMusicTrack(track)}
                          aria-label={
                            isPlaying
                              ? `Pause ${track.name}`
                              : `Play ${track.name}`
                          }
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isPlaying
                              ? 'bg-black/20 dark:bg-white/20'
                              : themeConfig.buttonBgClass
                          }`}
                        >
                          {isPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                        </button>

                        {renamingId === track.id ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="text"
                              aria-label="New track name"
                              value={renameInput}
                              onChange={(e) => setRenameInput(e.target.value)}
                              className={`flex-1 px-2 py-1 rounded-lg text-xs ${themeConfig.glassInputClass}`}
                            />
                            <button
                              type="button"
                              aria-label="Save new track name"
                              onClick={() =>
                                void handleConfirmRename(track.id)
                              }
                              className="p-1 rounded bg-emerald-500/20 text-emerald-500"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Cancel rename"
                              onClick={() => setRenamingId(null)}
                              className="p-1 rounded bg-black/10"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold truncate">
                                {track.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-black/10 dark:bg-white/15">
                                {MOOD_TAG_LABELS[track.moodTag]}
                              </span>
                              {isMoodSuggested && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-300">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Suggested
                                </span>
                              )}
                            </div>
                            <span className="block text-[10px] opacity-75">
                              {track.sourceType === 'file'
                                ? 'Device File (IndexedDB)'
                                : 'HTTPS Stream'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleToggleLoop(track)}
                          aria-label={`Toggle loop for ${track.name}`}
                          aria-pressed={track.loop}
                          title={track.loop ? 'Loop enabled' : 'Loop disabled'}
                          className={`p-1.5 rounded-lg text-xs transition-opacity ${
                            track.loop ? 'opacity-100' : 'opacity-40'
                          }`}
                        >
                          <Repeat className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(track.id);
                            setRenameInput(track.name);
                          }}
                          aria-label={`Rename ${track.name}`}
                          className="p-1.5 rounded-lg opacity-80 hover:opacity-100"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteMyTrack(track.id)}
                          aria-label={`Delete ${track.name}`}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/15"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Volume slider for this custom track */}
                    <div className="flex items-center gap-2 pt-1 border-t border-black/10 dark:border-white/10">
                      <Volume2 className="w-3.5 h-3.5 opacity-70" />
                      <input
                        type="range"
                        aria-label={`${track.name} volume`}
                        min={0}
                        max={1}
                        step={0.05}
                        value={layerVol}
                        onChange={(e) =>
                          soundEngine.setLayerVolume(
                            layerId,
                            Number(e.target.value)
                          )
                        }
                        className="flex-1 h-1.5 accent-sky-500 cursor-pointer"
                      />
                      <span className="text-[10px] font-mono tabular-nums w-8 text-right">
                        {Math.round(layerVol * 100)}%
                      </span>
                    </div>

                    {errText && (
                      <div className="text-[11px] text-rose-500 font-medium">
                        {errText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CLOUD CURATED TRACKS */}
      {activeTab === 'curated' && (
        <div className="space-y-2.5" data-testid="curated-tracks-section">
          {/* Header with "Hide broken tracks" toggle */}
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span
              className={`text-[11px] font-semibold ${themeConfig.textSecondaryClass}`}
            >
              Cloud Curated Tracks
            </span>
            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="hide-broken-tracks-toggle"
                checked={hideBrokenTracks}
                onChange={(e) => setHideBrokenTracks(e.target.checked)}
                className="rounded accent-sky-600"
              />
              <span className={`text-[11px] font-medium ${themeConfig.textPrimaryClass}`}>
                Hide broken tracks
              </span>
            </label>
          </div>

          {customTracks.length === 0 ? (
            <p className={`text-xs py-2 ${themeConfig.textMutedClass}`}>
              No Cloud Curated Tracks published yet.
            </p>
          ) : (
            (() => {
              const itemsWithError = customTracks.map((ct) => {
                const layerId = `track:${ct.id}`;
                const runtimeError = mixerSnap.trackErrors[layerId];
                const staticInvalidReason = !isValidHttpsAudioUrl(ct.url)
                  ? classifyCuratedTrackError({
                      mediaErrorCode: 4,
                      src: ct.url,
                    }).message
                  : undefined;
                return {
                  track: ct,
                  layerId,
                  playError: runtimeError || staticInvalidReason,
                };
              });

              const visibleItems = hideBrokenTracks
                ? itemsWithError.filter((item) => !item.playError)
                : itemsWithError;

              if (visibleItems.length === 0) {
                return (
                  <p
                    data-testid="curated-tracks-all-hidden"
                    className={`text-xs py-2 ${themeConfig.textMutedClass}`}
                  >
                    All broken tracks are hidden.
                  </p>
                );
              }

              return visibleItems.map(({ track: ct, layerId, playError }) => {
                const isPlaying = mixerSnap.activeLayerIds.includes(layerId);
                const layerVol = mixerSnap.layerVolumes[layerId] ?? 0.7;

                return (
                  <div
                    key={ct.id}
                    data-testid={`curated-track-item-${ct.id}`}
                    className={`p-3 rounded-xl border transition-all space-y-2 ${
                      isPlaying
                        ? themeConfig.activeTabClass
                        : `${themeConfig.borderClass} ${themeConfig.textPrimaryClass} bg-white/30 dark:bg-slate-900/30`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCuratedTrack(ct)}
                        aria-pressed={isPlaying}
                        className="flex items-center gap-2 text-left text-xs font-semibold truncate flex-1"
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5 shrink-0 fill-current" />
                        ) : (
                          <Music className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{ct.title}</span>
                      </button>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 shrink-0">
                        {ct.category}
                      </span>
                    </div>

                    {/* Individual volume slider */}
                    <div className="flex items-center gap-2 pt-1 border-t border-black/10 dark:border-white/10">
                      <Volume2 className="w-3.5 h-3.5 opacity-70" />
                      <input
                        type="range"
                        aria-label={`${ct.title} volume`}
                        min={0}
                        max={1}
                        step={0.05}
                        value={layerVol}
                        onChange={(e) =>
                          soundEngine.setLayerVolume(
                            layerId,
                            Number(e.target.value)
                          )
                        }
                        className="flex-1 h-1.5 accent-sky-500 cursor-pointer"
                      />
                      <span className="text-[10px] font-mono tabular-nums w-8 text-right">
                        {Math.round(layerVol * 100)}%
                      </span>
                    </div>

                    {playError && (
                      <div
                        role="alert"
                        data-testid={`curated-track-error-${ct.id}`}
                        className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-600 dark:text-rose-300 flex items-start justify-between gap-2"
                      >
                        <div className="flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{playError}</span>
                        </div>
                        {mixerSnap.trackErrors[layerId] && (
                          <button
                            type="button"
                            onClick={() => soundEngine.clearTrackError(layerId)}
                            className="underline text-[10px] shrink-0"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()
          )}
        </div>
      )}
    </div>
  );
}
