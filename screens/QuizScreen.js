import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addXP } from '../utils/progress';
import { speakGerman, stopSpeech } from '../utils/speech';
import { useLanguage } from '../utils/LanguageContext';

const WORDS_KEY      = 'words';
const QUIZ_LENGTH    = 5;
const XP_PER_CORRECT = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a standard random quiz from a words array.
 * Each question gets a random direction (de→ar or ar→de).
 */
function buildQuestions(words) {
  const pool = shuffle(words).slice(0, Math.min(QUIZ_LENGTH, words.length));
  return pool.map((word, i) => {
    const mode = Math.random() < 0.5 ? 'de_to_ar' : 'ar_to_de';
    return {
      key:        word.id + '_' + i,
      mode,
      prompt:     mode === 'de_to_ar' ? word.word        : word.translation,
      answer:     mode === 'de_to_ar' ? word.translation : word.word,
      germanWord: word.article ? `${word.article} ${word.word}` : word.word,
      isSentence: false,
    };
  });
}

/**
 * Build a single focused question from a notification focusItem.
 *
 * displayMode encodes what the notification SHOWED:
 *   'de_shown' → user saw German  → quiz asks for Arabic  (de_to_ar)
 *   'ar_shown' → user saw Arabic  → quiz asks for German  (ar_to_de)
 *   (no mode)  → default de_to_ar
 */
function buildFocusedQuestion(focusItem) {
  const mode = focusItem.displayMode === 'ar_shown' ? 'ar_to_de' : 'de_to_ar';

  if (focusItem.type === 'word') {
    return {
      key:        String(focusItem.id) + '_focus',
      mode,
      prompt:     mode === 'de_to_ar' ? focusItem.word        : focusItem.translation,
      answer:     mode === 'de_to_ar' ? focusItem.translation : focusItem.word,
      germanWord: focusItem.article ? `${focusItem.article} ${focusItem.word}` : focusItem.word,
      isSentence: false,
    };
  }

  // sentence
  const german = focusItem.sentence    || '';
  const arabic = focusItem.translation || '';
  return {
    key:        String(focusItem.sentenceId || focusItem.id) + '_focus',
    mode,
    prompt:     mode === 'de_to_ar' ? german : arabic,
    answer:     mode === 'de_to_ar' ? arabic : german,
    germanWord: german,
    isSentence: true,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuizScreen({ route, navigation }) {
  const { t, isRTL } = useLanguage();

  const [words,      setWords]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [phase,      setPhase]      = useState('quiz');   // 'quiz' | 'done'
  const [questions,  setQuestions]  = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userInput,  setUserInput]  = useState('');
  const [inputState, setInputState] = useState('idle');   // 'idle' | 'correct' | 'wrong'
  const [retryMsg,   setRetryMsg]   = useState('');
  const [score,      setScore]      = useState(0);
  const [sessionXP,  setSessionXP]  = useState(0);
  const [isPlaying,  setIsPlaying]  = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const inputRef  = useRef(null);

  // routeRef lets the stable useFocusEffect callback always see latest params
  const routeRef = useRef(route);
  routeRef.current = route;

  // Prevents double-handling when useFocusEffect consumes a focusItem and the
  // resulting setParams({ focusItem: null }) triggers useEffect again
  const focusItemConsumedRef = useRef(false);

  // ── Build focused questions from a notification item ─────────────────────

  const applyFocusedQuiz = (focusItem, loadedWords) => {
    const focusQ    = buildFocusedQuestion(focusItem);
    const otherIds  = new Set([focusItem.wordId, focusItem.id].filter(Boolean));
    const fillWords = loadedWords.filter(w => !otherIds.has(w.id));
    const fillQs    = buildQuestions(fillWords).slice(0, QUIZ_LENGTH - 1);
    setQuestions([focusQ, ...fillQs]);
  };

  // ── Load & start quiz on screen focus ────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      stopSpeech();
      setIsPlaying(false);
      setLoading(true);

      const focusItem = routeRef.current?.params?.focusItem;

      AsyncStorage.getItem(WORDS_KEY)
        .then((raw) => {
          const loaded = raw ? JSON.parse(raw) : [];
          setWords(loaded);

          if (focusItem?.type) {
            // Screen gained focus WITH a notification focusItem already in params
            focusItemConsumedRef.current = true;
            applyFocusedQuiz(focusItem, loaded);
            navigation?.setParams({ focusItem: null });
          } else if (loaded.length > 0) {
            setQuestions(buildQuestions(loaded));
          } else {
            setQuestions([]);
          }

          setCurrentIdx(0);
          setUserInput('');
          setInputState('idle');
          setRetryMsg('');
          setScore(0);
          setSessionXP(0);
          setPhase('quiz');
        })
        .catch(() => setWords([]))
        .finally(() => setLoading(false));
    }, [])
  );

  // ── Handle notification tap while quiz screen is already focused ──────────

  useEffect(() => {
    const focusItem = route?.params?.focusItem;
    if (!focusItem?.type) return;

    // Guard: focusItem was already consumed by useFocusEffect above
    if (focusItemConsumedRef.current) {
      focusItemConsumedRef.current = false;
      return;
    }

    stopSpeech();
    setIsPlaying(false);
    setLoading(true);

    AsyncStorage.getItem(WORDS_KEY)
      .then((raw) => {
        const loaded = raw ? JSON.parse(raw) : [];
        setWords(loaded);
        applyFocusedQuiz(focusItem, loaded);
        setCurrentIdx(0);
        setUserInput('');
        setInputState('idle');
        setRetryMsg('');
        setScore(0);
        setSessionXP(0);
        setPhase('quiz');
        navigation?.setParams({ focusItem: null });
      })
      .catch(() => setWords([]))
      .finally(() => setLoading(false));
  }, [route?.params?.focusItem]);

  // ── Shake animation ──────────────────────────────────────────────────────

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleInputChange = (text) => {
    setUserInput(text);
    if (inputState === 'wrong') {
      setInputState('idle');
      setRetryMsg('');
    }
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || inputState === 'correct') return;
    const q       = questions[currentIdx];
    const correct = userInput.toLowerCase().trim() === q.answer.toLowerCase().trim();
    if (correct) {
      setInputState('correct');
      setScore((prev) => prev + 1);
      setSessionXP((prev) => prev + XP_PER_CORRECT);
      await addXP(XP_PER_CORRECT);
    } else {
      setInputState('wrong');
      const retryMessages = t('quiz.retryMessages');
      setRetryMsg(retryMessages[Math.floor(Math.random() * retryMessages.length)]);
      triggerShake();
    }
  };

  const handleNext = () => {
    stopSpeech();
    setIsPlaying(false);
    if (currentIdx + 1 >= questions.length) {
      setPhase('done');
    } else {
      setCurrentIdx((prev) => prev + 1);
      setUserInput('');
      setInputState('idle');
      setRetryMsg('');
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  };

  const handleRestart = () => {
    stopSpeech();
    setIsPlaying(false);
    setQuestions(buildQuestions(words));
    setCurrentIdx(0);
    setUserInput('');
    setInputState('idle');
    setRetryMsg('');
    setScore(0);
    setSessionXP(0);
    setPhase('quiz');
  };

  const handleListen = (germanWord) => {
    if (isPlaying) {
      stopSpeech();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    speakGerman(germanWord, {
      onDone:  () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (words.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{t('quiz.title')}</Text>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="library-outline" size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>{t('quiz.noWords')}</Text>
            <Text style={styles.emptyBody}>{t('quiz.addWordsFirst')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Done screen ────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const perfect  = score === questions.length;
    const iconName = perfect ? 'trophy' : score > 0 ? 'star' : 'reload-circle';

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
          <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View>
              <Text style={styles.title}>{t('quiz.title')}</Text>
              <Text style={styles.subtitle}>{t('quiz.sessionComplete')}</Text>
            </View>
          </View>

          <LinearGradient
            colors={['#6366F1', '#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.resultCard}
          >
            <View style={styles.resultIconWrap}>
              <Ionicons name={iconName} size={44} color="#FFFFFF" />
            </View>
            <Text style={styles.resultTitle}>
              {perfect ? t('quiz.perfect') : score > 0 ? t('quiz.wellDone') : t('quiz.keepPracticing')}
            </Text>
            <Text style={styles.resultScore}>
              {score}
              <Text style={styles.resultScoreOf}> / {questions.length}</Text>
            </Text>
            <Text style={styles.resultScoreLabel}>{t('quiz.correctAnswers')}</Text>
          </LinearGradient>

          <View style={styles.xpCard}>
            <View style={styles.xpRow}>
              <View style={styles.xpIconWrap}>
                <Ionicons name="star" size={22} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.xpEarned}>{t('quiz.xpEarned', { n: sessionXP })}</Text>
                <Text style={styles.xpSub}>{t('quiz.addedToProgress')}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.restartButton}
            onPress={handleRestart}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.restartButtonText}>{t('quiz.restart')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Quiz screen ────────────────────────────────────────────────────────────

  const currentQ  = questions[currentIdx];
  const isCorrect = inputState === 'correct';
  const isWrong   = inputState === 'wrong';

  const inputBorderColor = isCorrect ? '#10B981' : isWrong ? '#EF4444' : '#E5E7EB';
  const inputBgColor     = isCorrect ? '#ECFDF5' : isWrong  ? '#FEF2F2' : '#FFFFFF';

  const modeLabel = currentQ.isSentence
    ? (currentQ.mode === 'de_to_ar' ? t('quiz.typeArabicSent') : t('quiz.typeGermanSent'))
    : (currentQ.mode === 'de_to_ar' ? t('quiz.toArabic') : t('quiz.toGerman'));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View>
              <Text style={styles.title}>{t('quiz.title')}</Text>
              <Text style={styles.subtitle}>{t('quiz.subtitle')}</Text>
            </View>
            <View style={styles.scorePill}>
              <Text style={styles.scoreNum}>{score}</Text>
              <Text style={styles.scoreOf}> / {questions.length}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            {questions.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSeg,
                  i === currentIdx && styles.progressSegActive,
                  i < currentIdx  && styles.progressSegDone,
                ]}
              />
            ))}
          </View>

          {/* Question card */}
          <View style={styles.questionCard}>
            <View style={[styles.modeBadge, isRTL && { flexDirection: 'row-reverse' }]}>
              <Ionicons
                name={currentQ.mode === 'de_to_ar' ? 'arrow-forward' : 'arrow-back'}
                size={12}
                color="#8B5CF6"
              />
              <Text style={styles.modeBadgeText}>{modeLabel}</Text>
            </View>

            <Text
              style={[
                styles.questionWord,
                currentQ.mode === 'ar_to_de' && styles.questionWordArabic,
                currentQ.isSentence           && styles.questionWordSentence,
              ]}
            >
              {currentQ.prompt}
            </Text>

            <TouchableOpacity
              style={[styles.listenBtn, isPlaying && styles.listenBtnActive, isRTL && { flexDirection: 'row-reverse' }]}
              onPress={() => handleListen(currentQ.germanWord)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
                size={15}
                color={isPlaying ? '#FFFFFF' : '#8B5CF6'}
              />
              <Text style={[styles.listenBtnText, isPlaying && styles.listenBtnTextActive]}>
                {isPlaying ? t('sentences.playing') : t('sentences.listen')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Input field */}
          <Animated.View
            style={[
              styles.inputWrapper,
              {
                borderColor:     inputBorderColor,
                backgroundColor: inputBgColor,
                transform: [{ translateX: shakeAnim }],
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={t('quiz.placeholder')}
              placeholderTextColor="#C0C0CC"
              value={userInput}
              onChangeText={handleInputChange}
              editable={!isCorrect}
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="done"
              onSubmitEditing={!isCorrect ? handleSubmit : undefined}
            />
            {isCorrect && (
              <Ionicons name="checkmark-circle" size={22} color="#10B981" style={styles.inputStatusIcon} />
            )}
            {isWrong && (
              <Ionicons name="close-circle" size={22} color="#EF4444" style={styles.inputStatusIcon} />
            )}
          </Animated.View>

          {/* Feedback */}
          {isCorrect && (
            <View style={styles.feedbackBox}>
              <Ionicons name="checkmark-circle" size={18} color="#059669" />
              <Text style={styles.feedbackTextCorrect}>{t('quiz.correct')} ✅</Text>
            </View>
          )}
          {isWrong && (
            <View style={styles.feedbackBoxWrong}>
              <Ionicons name="close-circle" size={18} color="#DC2626" />
              <Text style={styles.feedbackTextWrong}>{t('quiz.wrong')} ❌  {retryMsg}</Text>
            </View>
          )}

          {/* Submit button */}
          {!isCorrect && (
            <TouchableOpacity
              style={[styles.submitButton, !userInput.trim() && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={!userInput.trim()}
            >
              <Text style={styles.submitButtonText}>{t('quiz.submit')}</Text>
            </TouchableOpacity>
          )}

          {/* Next / Results button */}
          {isCorrect && (
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.nextButtonText}>
                {currentIdx + 1 >= questions.length ? t('quiz.seeResults') : t('quiz.next')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inner:     { padding: 20, paddingTop: 20, paddingBottom: 60 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title:    { fontSize: 30, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  subtitle: { fontSize: 14, color: '#9CA3AF' },

  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scoreNum: { fontSize: 22, fontWeight: '800', color: '#4F46E5' },
  scoreOf:  { fontSize: 14, fontWeight: '600', color: '#A5B4FC' },

  progressRow: { flexDirection: 'row', gap: 5, marginBottom: 20 },
  progressSeg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  progressSegActive: { backgroundColor: '#6366F1' },
  progressSegDone:   { backgroundColor: '#A5B4FC' },

  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F3FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 20,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B5CF6',
    letterSpacing: 1.2,
  },
  questionWord: {
    fontSize: 42,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 24,
  },
  questionWordArabic: {
    fontSize: 32,
    lineHeight: 48,
    letterSpacing: 0,
    writingDirection: 'rtl',
  },
  questionWordSentence: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: 0,
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  listenBtnActive: { backgroundColor: '#8B5CF6' },
  listenBtnText: { fontSize: 13, fontWeight: '600', color: '#8B5CF6' },
  listenBtnTextActive: { color: '#FFFFFF' },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 2,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#1A1A2E',
    paddingVertical: 14,
    padding: 0,
  },
  inputStatusIcon: { marginLeft: 8 },

  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  feedbackTextCorrect: { fontSize: 15, fontWeight: '600', color: '#059669' },
  feedbackBoxWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  feedbackTextWrong: { fontSize: 15, fontWeight: '600', color: '#DC2626', flex: 1 },

  submitButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 12,
  },
  submitButtonDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0, elevation: 0 },
  submitButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  nextButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 12,
  },
  nextButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  resultCard: {
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    marginBottom: 16,
  },
  resultIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resultTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },
  resultScore: { fontSize: 56, fontWeight: '800', color: '#FFFFFF', lineHeight: 64 },
  resultScoreOf: { fontSize: 32, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  resultScoreLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginTop: 4,
  },

  xpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  xpIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpEarned: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  xpSub:    { fontSize: 13, color: '#9CA3AF' },

  restartButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  restartButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 10 },
  emptyBody:  { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
});
