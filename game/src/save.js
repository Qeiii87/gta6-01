// Save and best-progress persistence in localStorage. Nothing here ever
// touches the network; a missing or corrupt save simply starts fresh.
import { BEST_KEY, SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      money: Number(data.money) || 0,
      missionIndex: Number(data.missionIndex) || 0,
      completed: Array.isArray(data.completed) ? data.completed : [],
      stashes: Array.isArray(data.stashes) ? data.stashes : [],
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        money: data.money,
        missionIndex: data.missionIndex,
        completed: data.completed,
        stashes: data.stashes,
      }),
    );
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Best score then lasts this visit only.
  }
}
