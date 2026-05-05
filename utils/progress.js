import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  lastActiveDate: 'lastActiveDate',
  streakCount:    'streakCount',
  xp:             'xp',
  level:          'level',
};

const XP_PER_LEVEL   = 100;
const XP_PER_CORRECT = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Load / save ──────────────────────────────────────────────────────────────

export async function loadProgress() {
  try {
    const [lastDate, streak, xp, level] = await Promise.all([
      AsyncStorage.getItem(KEYS.lastActiveDate),
      AsyncStorage.getItem(KEYS.streakCount),
      AsyncStorage.getItem(KEYS.xp),
      AsyncStorage.getItem(KEYS.level),
    ]);
    return {
      lastActiveDate: lastDate  ?? null,
      streakCount:    parseInt(streak  ?? '0', 10),
      xp:             parseInt(xp      ?? '0', 10),
      level:          parseInt(level   ?? '1', 10),
    };
  } catch {
    return { lastActiveDate: null, streakCount: 0, xp: 0, level: 1 };
  }
}

// ─── Streak ───────────────────────────────────────────────────────────────────

/**
 * Call once when the app opens (e.g. in App.js useEffect or HomeScreen focus).
 * - Same day    → no change
 * - Yesterday   → streak + 1
 * - Older / null → reset to 1
 * Returns the updated { streakCount, lastActiveDate }.
 */
export async function updateStreak() {
  const today     = todayString();
  const yesterday = yesterdayString();

  const [storedDate, storedStreak] = await Promise.all([
    AsyncStorage.getItem(KEYS.lastActiveDate),
    AsyncStorage.getItem(KEYS.streakCount),
  ]);

  const currentStreak = parseInt(storedStreak ?? '0', 10);

  let newStreak;
  if (storedDate === today) {
    // Already updated today — nothing to do
    return { streakCount: currentStreak, lastActiveDate: today };
  } else if (storedDate === yesterday) {
    newStreak = currentStreak + 1;
  } else {
    // Missed one or more days, or first visit
    newStreak = 1;
  }

  await Promise.all([
    AsyncStorage.setItem(KEYS.lastActiveDate, today),
    AsyncStorage.setItem(KEYS.streakCount,    String(newStreak)),
  ]);

  return { streakCount: newStreak, lastActiveDate: today };
}

// ─── XP / Level ───────────────────────────────────────────────────────────────

/**
 * Award XP for a correct answer.
 * Returns the updated { xp, level, leveledUp }.
 */
export async function addXP(amount = XP_PER_CORRECT) {
  const [storedXP, storedLevel] = await Promise.all([
    AsyncStorage.getItem(KEYS.xp),
    AsyncStorage.getItem(KEYS.level),
  ]);

  const currentXP    = parseInt(storedXP    ?? '0', 10);
  const currentLevel = parseInt(storedLevel ?? '1', 10);

  const newXP       = currentXP + amount;
  const newLevel    = Math.floor(newXP / XP_PER_LEVEL) + 1;
  const leveledUp   = newLevel > currentLevel;

  await Promise.all([
    AsyncStorage.setItem(KEYS.xp,    String(newXP)),
    AsyncStorage.setItem(KEYS.level, String(newLevel)),
  ]);

  return { xp: newXP, level: newLevel, leveledUp };
}

// ─── Derived helpers (pure — no I/O) ──────────────────────────────────────────

/** XP earned within the current level (0 – XP_PER_LEVEL). */
export function xpInCurrentLevel(xp, level) {
  return xp - (level - 1) * XP_PER_LEVEL;
}

/** XP needed to reach the next level. */
export function xpForNextLevel() {
  return XP_PER_LEVEL;
}

export { XP_PER_LEVEL, XP_PER_CORRECT };
