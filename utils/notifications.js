import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WORDS_KEY     = 'words';
const SENTENCES_KEY = 'sentences';
const SETTINGS_KEY  = 'notificationSettings';
const INDEX_KEY     = 'notificationIndex'; // position in the combined cycle

// ⚠️  EXPO GO LIMITATION
// Custom sounds are NOT supported in Expo Go. The notification will fire but
// will use the system default sound. A development or EAS production build is
// required to hear the custom sound file.
const SOUND_FILE = 'notification.mp3';
const CHANNEL_ID = 'default';

// How many notifications to schedule ahead in one batch.
// On iOS the system cap is 64 pending local notifications, so keep this low.
// Each batch is refreshed whenever the user opens the app.
const SCHEDULE_COUNT = 20;

export const FREQUENCIES = [
  { id: '5min',  label: 'Every 5 min',  sublabel: 'Testing',     seconds: 5 * 60 },
  { id: '30min', label: 'Every 30 min', sublabel: 'Frequent',    seconds: 30 * 60 },
  { id: 'daily', label: 'Once a day',   sublabel: 'Recommended', seconds: 24 * 60 * 60 },
];

export const DEFAULT_SETTINGS = {
  enabled: false,
  frequency: '30min',
};

// ─── Android channel ──────────────────────────────────────────────────────────

export async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
    sound: SOUND_FILE,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4F46E5',
    enableVibrate: true,
  });
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestPermissions() {
  const { status: current } = await Notifications.getPermissionsAsync();
  if (current === 'granted') return 'granted';
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

export async function getPermissionStatus() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

// ─── Combined item list ───────────────────────────────────────────────────────

/**
 * Build the unified cycling list: all words followed by all sentences.
 * The order is deterministic so the stored index always points to the same item.
 */
async function buildItemList() {
  const [wordsRaw, sentencesRaw] = await Promise.all([
    AsyncStorage.getItem(WORDS_KEY),
    AsyncStorage.getItem(SENTENCES_KEY),
  ]);

  const words     = wordsRaw     ? JSON.parse(wordsRaw)     : [];
  const sentences = sentencesRaw ? JSON.parse(sentencesRaw) : [];

  return [
    ...words.map((w) => ({
      type:        'word',
      id:          w.id,
      word:        w.word,
      translation: w.translation,
      article:     w.article,
    })),
    ...sentences.map((s) => ({
      type:        'sentence',
      id:          s.id,
      sentence:    s.sentence,
      translation: s.translation,
      category:    s.category ?? null,
    })),
  ];
}

// ─── Index management ─────────────────────────────────────────────────────────

async function readIndex() {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  return parseInt(raw ?? '0', 10);
}

async function writeIndex(index) {
  await AsyncStorage.setItem(INDEX_KEY, String(index));
}

// ─── Public: get the next item and advance the index ─────────────────────────

/**
 * Returns the item currently pointed to by the stored index and advances
 * the index by 1 (wrapping around the full list).
 * Returns null when the list is empty.
 */
export async function getNextNotificationItem() {
  const [list, rawIndex] = await Promise.all([
    buildItemList(),
    AsyncStorage.getItem(INDEX_KEY),
  ]);

  if (list.length === 0) return null;

  const index    = parseInt(rawIndex ?? '0', 10) % list.length;
  const item     = list[index];
  const nextIdx  = (index + 1) % list.length;

  await writeIndex(nextIdx);
  return item;
}

// ─── Content builder ──────────────────────────────────────────────────────────

function contentFromItem(item) {
  if (item.type === 'word') {
    return {
      title:    `🇩🇪 ${item.word}`,
      body:     item.translation,
      subtitle: 'Tap to test yourself',
      data: {
        type:        'word',
        id:          item.id,
        wordId:      item.id,
        word:        item.word,
        translation: item.translation,
        article:     item.article,
      },
    };
  }

  // sentence
  return {
    title:    '🇩🇪 Sentence',
    body:     item.translation,
    subtitle: 'Tap to test yourself',
    data: {
      type:        'sentence',
      id:          item.id,
      sentenceId:  item.id,
      sentence:    item.sentence,
      translation: item.translation,
      category:    item.category,
    },
  };
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

export async function cancelNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Schedule SCHEDULE_COUNT individual (non-repeating) notifications, each one
 * interval apart, each carrying the next item from the combined list.
 *
 * Why not `repeats: true`?
 * A repeating trigger fires the SAME content every interval. The content is
 * fixed at the moment scheduleNotificationAsync() is called and never changes,
 * so the user sees the identical notification on every tick.
 *
 * By scheduling N separate non-repeating notifications we can give each a
 * different item from the cycle. When the user opens the app the batch is
 * refreshed and the index continues from where it left off.
 */
export async function scheduleNotifications(frequencyId) {
  await cancelNotifications();

  const freq = FREQUENCIES.find((f) => f.id === frequencyId) ?? FREQUENCIES[1];

  const [list, rawIndex] = await Promise.all([
    buildItemList(),
    AsyncStorage.getItem(INDEX_KEY),
  ]);

  // ── Empty list fallback ────────────────────────────────────────────────────
  if (list.length === 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🇩🇪 Time to learn!',
        body:  'Add words to start your German learning journey.',
        sound: SOUND_FILE,
        data:  {},
      },
      trigger: {
        type:      'timeInterval',
        seconds:   freq.seconds,
        repeats:   true,   // ok to repeat a static fallback
        channelId: CHANNEL_ID,
      },
    });
    return;
  }

  // ── Schedule the next SCHEDULE_COUNT items ─────────────────────────────────
  const startIndex = parseInt(rawIndex ?? '0', 10) % list.length;

  await Promise.all(
    Array.from({ length: SCHEDULE_COUNT }, (_, i) => {
      const item    = list[(startIndex + i) % list.length];
      const content = contentFromItem(item);

      return Notifications.scheduleNotificationAsync({
        content: {
          title: content.title,
          body:  content.body,
          ...(content.subtitle ? { subtitle: content.subtitle } : {}),
          sound: SOUND_FILE,
          data:  content.data,
        },
        trigger: {
          type:      'timeInterval',
          seconds:   freq.seconds * (i + 1), // 1×, 2×, 3× … SCHEDULE_COUNT×
          repeats:   false,
          channelId: CHANNEL_ID,
        },
      });
    })
  );

  // Advance the index past this entire batch so the next reschedule continues
  // from where this batch ends.
  await writeIndex((startIndex + SCHEDULE_COUNT) % list.length);
}

// ─── Settings persistence ─────────────────────────────────────────────────────

export async function loadNotificationSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveNotificationSettings(settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Apply (save + act) ───────────────────────────────────────────────────────

export async function applyNotificationSettings(settings) {
  await saveNotificationSettings(settings);

  if (!settings.enabled) {
    await cancelNotifications();
    return 'cancelled';
  }

  const status = await requestPermissions();
  if (status !== 'granted') {
    await saveNotificationSettings({ ...settings, enabled: false });
    return 'denied';
  }

  await scheduleNotifications(settings.frequency);
  return 'scheduled';
}
