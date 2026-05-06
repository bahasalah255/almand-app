import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANG_KEY } from './LanguageContext';

const WORDS_KEY     = 'words';
const SENTENCES_KEY = 'sentences';
const SETTINGS_KEY  = 'notificationSettings';
const INDEX_KEY     = 'notificationIndex'; // position in the combined cycle

const NOTIF_SUBTITLE = {
  en: 'Tap to quiz yourself',
  ar: 'اضغط لاختبار نفسك',
  fr: 'Appuyez pour tester vos connaissances',
};
const NOTIF_EMPTY_TITLE = {
  en: 'Time to learn!',
  ar: 'حان وقت التعلم!',
  fr: "C'est l'heure d'apprendre !",
};
const NOTIF_EMPTY_BODY = {
  en: 'Add words to start your German learning journey.',
  ar: 'أضف كلمات لبدء رحلتك في تعلم الألمانية.',
  fr: "Ajoutez des mots pour commencer votre apprentissage de l'allemand.",
};

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

/**
 * Build notification content for a single item.
 *
 * ACTIVE-RECALL DESIGN: Only ONE side of the word is shown.
 * The user must mentally recall the other side before tapping to quiz.
 * Showing both sides at once (word = translation) has zero learning value.
 *
 * `displayMode` stored in `data` tells QuizScreen which direction to ask:
 *   de_shown → user saw German  → quiz asks for Arabic  (de_to_ar)
 *   ar_shown → user saw Arabic  → quiz asks for German  (ar_to_de)
 */
function contentFromItem(item, language = 'en') {
  const prompt      = NOTIF_SUBTITLE[language] ?? NOTIF_SUBTITLE.en;
  const showGerman  = Math.random() < 0.5;
  const displayMode = showGerman ? 'de_shown' : 'ar_shown';

  if (item.type === 'word') {
    return {
      // title = the ONE side to show; body = prompt only — never reveal the answer
      title: showGerman ? item.word : item.translation,
      body:  prompt,
      data: {
        type:        'word',
        id:          item.id,
        wordId:      item.id,
        word:        item.word,
        translation: item.translation,
        article:     item.article,
        displayMode,
      },
    };
  }

  // sentence — same rule: show only one side
  return {
    title: showGerman ? item.sentence : item.translation,
    body:  prompt,
    data: {
      type:        'sentence',
      id:          item.id,
      sentenceId:  item.id,
      sentence:    item.sentence,
      translation: item.translation,
      category:    item.category,
      displayMode,
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

  const [list, rawIndex, langRaw] = await Promise.all([
    buildItemList(),
    AsyncStorage.getItem(INDEX_KEY),
    AsyncStorage.getItem(LANG_KEY),
  ]);

  const language = langRaw || 'en';

  // ── Empty list fallback ────────────────────────────────────────────────────
  if (list.length === 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: NOTIF_EMPTY_TITLE[language] ?? NOTIF_EMPTY_TITLE.en,
        body:  NOTIF_EMPTY_BODY[language]  ?? NOTIF_EMPTY_BODY.en,
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
      const content = contentFromItem(item, language);

      return Notifications.scheduleNotificationAsync({
        content: {
          title: content.title,
          body:  content.body,
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

  // Shift the starting point by one item so the next refresh doesn't restart
  // on the same lead word when the batch size lines up with the list length.
  await writeIndex((startIndex + 1) % list.length);
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

/**
 * Rebuild pending notifications only when reminders are enabled and already
 * authorized. Useful after words/sentences are added or deleted so Android APK
 * users do not stay stuck on the empty-list fallback notification.
 */
export async function refreshScheduledNotificationsIfEnabled() {
  const settings = await loadNotificationSettings();
  if (!settings.enabled) return 'disabled';

  const status = await getPermissionStatus();
  if (status !== 'granted') return 'denied';

  await scheduleNotifications(settings.frequency);
  return 'scheduled';
}
