import { MoodThemeId, MyMusicTrack } from '../types';
import {
  classifyCuratedTrackError,
  isValidHttpsAudioUrl,
  sanitizePlainText,
  validateCustomAudioFile,
} from './focusLogic';

const DB_NAME = 'focusflow_my_music_db';
const DB_VERSION = 1;
const STORE_NAME = 'custom_tracks';

interface StoredMyMusicRecord extends MyMusicTrack {
  audioBlob?: Blob;
}

// Fallback in-memory map if IndexedDB is unavailable in a restricted context
const memoryFallbackStore = new Map<string, StoredMyMusicRecord>();

function openMyMusicDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function stripBlob(record: StoredMyMusicRecord): MyMusicTrack {
  const { audioBlob: _blob, ...meta } = record;
  void _blob;
  return meta;
}

export async function loadAllMyMusicTracks(): Promise<MyMusicTrack[]> {
  const db = await openMyMusicDb();
  if (!db) {
    return Array.from(memoryFallbackStore.values())
      .map(stripBlob)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result)
          ? (req.result as StoredMyMusicRecord[])
          : [];
        const tracks = rows
          .map(stripBlob)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        resolve(tracks);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function putRecord(record: StoredMyMusicRecord): Promise<void> {
  memoryFallbackStore.set(record.id, record);
  const db = await openMyMusicDb();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(new Error('Failed to store track in IndexedDB.'));
    } catch (err) {
      reject(err);
    }
  });
}

async function getRecord(id: string): Promise<StoredMyMusicRecord | null> {
  const db = await openMyMusicDb();
  if (!db) {
    return memoryFallbackStore.get(id) || null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        resolve((req.result as StoredMyMusicRecord) || memoryFallbackStore.get(id) || null);
      };
      req.onerror = () => resolve(memoryFallbackStore.get(id) || null);
    } catch {
      resolve(memoryFallbackStore.get(id) || null);
    }
  });
}

export async function addMyMusicFileTrack(params: {
  file: File;
  name: string;
  moodTag: MoodThemeId;
}): Promise<MyMusicTrack> {
  const validation = validateCustomAudioFile(params.file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Unsupported audio file.');
  }

  const defaultTitle = params.file.name.replace(/\.[^.]+$/, '');
  const safeName =
    sanitizePlainText(params.name || defaultTitle, 80) || 'Custom Audio Track';

  const record: StoredMyMusicRecord = {
    id: `my-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: safeName,
    moodTag: params.moodTag,
    sourceType: 'file',
    fileName: sanitizePlainText(params.file.name, 100),
    mimeType: params.file.type || 'audio/mpeg',
    fileSize: params.file.size,
    loop: true,
    createdAt: new Date().toISOString(),
    audioBlob: params.file,
  };

  await putRecord(record);
  return stripBlob(record);
}

export async function addMyMusicLinkTrack(params: {
  url: string;
  name: string;
  moodTag: MoodThemeId;
}): Promise<MyMusicTrack> {
  const trimmedUrl = params.url.trim();
  if (!isValidHttpsAudioUrl(trimmedUrl)) {
    throw new Error(
      'Invalid link. Audio URL must start with https:// and be a valid direct link.'
    );
  }
  const safeName =
    sanitizePlainText(params.name, 80) || 'Custom Stream Track';

  const record: StoredMyMusicRecord = {
    id: `my-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: safeName,
    moodTag: params.moodTag,
    sourceType: 'link',
    url: trimmedUrl,
    loop: true,
    createdAt: new Date().toISOString(),
  };

  await putRecord(record);
  return stripBlob(record);
}

export async function renameMyMusicTrack(
  id: string,
  newName: string,
  nextMoodTag?: MoodThemeId
): Promise<MyMusicTrack | null> {
  const existing = await getRecord(id);
  if (!existing) return null;
  const safeName = sanitizePlainText(newName, 80);
  if (!safeName) {
    throw new Error('Track name cannot be empty.');
  }
  const updated: StoredMyMusicRecord = {
    ...existing,
    name: safeName,
    moodTag: nextMoodTag ?? existing.moodTag,
  };
  await putRecord(updated);
  return stripBlob(updated);
}

export async function toggleMyMusicTrackLoop(
  id: string,
  loop: boolean
): Promise<MyMusicTrack | null> {
  const existing = await getRecord(id);
  if (!existing) return null;
  const updated: StoredMyMusicRecord = {
    ...existing,
    loop: Boolean(loop),
  };
  await putRecord(updated);
  return stripBlob(updated);
}

export async function deleteMyMusicTrack(id: string): Promise<void> {
  memoryFallbackStore.delete(id);
  const db = await openMyMusicDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getMyMusicPlaybackSource(id: string): Promise<{
  src: string;
  loop: boolean;
  isObjectUrl: boolean;
} | null> {
  const record = await getRecord(id);
  if (!record) return null;
  if (record.sourceType === 'file' && record.audioBlob) {
    const objUrl = URL.createObjectURL(record.audioBlob);
    return {
      src: objUrl,
      loop: record.loop,
      isObjectUrl: true,
    };
  }
  if (record.sourceType === 'link' && record.url) {
    if (!isValidHttpsAudioUrl(record.url)) return null;
    return {
      src: record.url,
      loop: record.loop,
      isObjectUrl: false,
    };
  }
  return null;
}

/**
 * Tests whether a direct https:// audio URL (or blob: URL) can actually load and decode in the browser.
 * Returns { playable: true } or { playable: false, reason } with a specific explanation.
 */
export async function testAudioPlayability(
  rawUrl: string,
  timeoutMs = 6000
): Promise<{ playable: boolean; reason?: string }> {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { playable: false, reason: 'Please enter an audio URL first.' };
  }
  if (!trimmed.startsWith('blob:') && !isValidHttpsAudioUrl(trimmed)) {
    if (trimmed.startsWith('http://')) {
      return {
        playable: false,
        reason:
          'Insecure http:// link blocked. Audio links must start with https://.',
      };
    }
    return {
      playable: false,
      reason:
        'Invalid URL format. Please enter a direct https:// link to an .mp3, .wav, .ogg, or .m4a file.',
    };
  }

  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    return { playable: true };
  }

  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;

    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.oncanplay = null;
      audio.onerror = null;
      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // ignore
      }
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      const classified = classifyCuratedTrackError({
        mediaErrorCode: 2,
        src: trimmed,
        errorMessage: 'timeout',
      });
      resolve({
        playable: false,
        reason: classified.message,
      });
    }, timeoutMs);

    audio.preload = 'metadata';

    audio.onloadedmetadata = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve({ playable: true });
    };

    audio.oncanplay = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve({ playable: true });
    };

    audio.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      const mediaErr = audio.error;
      const classified = classifyCuratedTrackError({
        mediaErrorCode: mediaErr?.code ?? null,
        src: trimmed,
        errorMessage: mediaErr?.message,
      });
      cleanup();
      resolve({ playable: false, reason: classified.message });
    };

    audio.src = trimmed;
    audio.load();
  });
}
