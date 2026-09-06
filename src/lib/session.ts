import { get, set, del } from 'idb-keyval';
import type { SwipeData, SwipeProgress } from '../types';

const DATA_KEY = 'swipe-review-data-v1';
const PROGRESS_KEY = 'swipe-review-progress-v1';

export async function loadData(): Promise<SwipeData | null> {
  try {
    return (await get<SwipeData>(DATA_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function saveData(data: SwipeData): Promise<void> {
  try {
    await set(DATA_KEY, data);
  } catch {
    // Storage can fail (private browsing, quota). Review still works in-memory.
  }
}

export async function loadProgress(): Promise<SwipeProgress | null> {
  try {
    return (await get<SwipeProgress>(PROGRESS_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function saveProgress(progress: SwipeProgress): Promise<void> {
  try {
    await set(PROGRESS_KEY, progress);
  } catch {
    // ignore
  }
}

export async function clearSession(): Promise<void> {
  try {
    await del(DATA_KEY);
    await del(PROGRESS_KEY);
  } catch {
    // ignore
  }
}
