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
  Dimensions,
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
const MIN_WORDS      = 3;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2;

const ARTICLE_PILL = {
  der:    { color: '#4A8FE8', bg: '#EBF4FF' },
  die:    { color: '#E8706A', bg: '#FFF0EF' },
  das:    { color: '#4DBFA0', bg: '#EDFAF6' },
  plural: { color: '#F5C842', bg: '#FFF8E0' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(words) {
  return shuffle(words)
    .slice(0, Math.min(QUIZ_LENGTH, words.length))
    .map((w, i) => ({
      key:         w.id + '_' + i,
      german:      w.word,
      translation: w.translation,
      article:     w.article || null,
    }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuizScreen({ route, navigation }) {
  const { t, isRTL } = useLanguage();

  // ── Core state ────────────────────────────────────────────────────────────
  const [words,        setWords]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [phase,        setPhase]        = useState('mode_select'); // 'mode_select'|'quiz'|'done'
  const [quizMode,     setQuizMode]     = useState(null);          // 'de_to_tr'|'tr_to_de'
  const [questions,    setQuestions]    = useState([]);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [inputValue,   setInputValue]   = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  // 'idle' → user is typing
  // 'correct' → answer accepted, show green + Next button
  // 'wrong'   → wrong answer, show red feedback, then auto-reset so user retypes
  const [answerState,  setAnswerState]  = useState('idle');
  const [score,        setScore]        = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount,   setWrongCount]   = useState(0);
  const [streak,       setStreak]       = useState(0);
  const [bestStreak,   setBestStreak]   = useState(0);
  const [isPlaying,    setIsPlaying]    = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const shakeAnim            = useRef(new Animated.Value(0)).current;
  const cardEnterAnim        = useRef(new Animated.Value(0)).current;
  const inputRef             = useRef(null);
  const routeRef             = useRef(route);
  routeRef.current           = route;
  const focusItemConsumedRef = useRef(false);
  const retryTimerRef        = useRef(null); // holds wrong-answer reset timer

  // ── Card entrance animation ───────────────────────────────────────────────
  const runCardEntrance = useCallback(() => {
    cardEnterAnim.setValue(0);
    Animated.timing(cardEnterAnim, {
      toValue: 1, duration: 380, useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (phase === 'quiz' && questions.length > 0 && !loading) runCardEntrance();
  }, [currentIdx, phase, loading]);

  // ── Reset helpers ─────────────────────────────────────────────────────────
  const resetGameState = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setCurrentIdx(0);
    setInputValue('');
    setAnswerState('idle');
    setScore(0);
    setCorrectCount(0);
    setWrongCount(0);
    setStreak(0);
    setBestStreak(0);
  };

  // ── Load words on focus + notification handling ───────────────────────────
  const applyFocusedQuiz = (focusItem, loadedWords) => {
    const focused = {
      key:         String(focusItem.id) + '_focus',
      german:      focusItem.word      || focusItem.sentence    || '',
      translation: focusItem.translation || '',
      article:     focusItem.article   || null,
    };
    const others = loadedWords.filter(w => w.id !== (focusItem.wordId || focusItem.id));
    const fillQs = shuffle(others)
      .slice(0, Math.min(QUIZ_LENGTH - 1, others.length))
      .map((w, i) => ({ key: w.id + '_' + i, german: w.word, translation: w.translation, article: w.article || null }));
    setQuestions([focused, ...fillQs]);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      stopSpeech();
      setIsPlaying(false);
      const focusItem = routeRef.current?.params?.focusItem;

      AsyncStorage.getItem(WORDS_KEY)
        .then((raw) => {
          const loaded = raw ? JSON.parse(raw) : [];
          setWords(loaded);
          resetGameState();

          if (focusItem?.type) {
            focusItemConsumedRef.current = true;
            const mode = focusItem.displayMode === 'ar_shown' ? 'tr_to_de' : 'de_to_tr';
            setQuizMode(mode);
            applyFocusedQuiz(focusItem, loaded);
            setPhase('quiz');
            navigation?.setParams({ focusItem: null });
          } else {
            setPhase('mode_select');
            setQuizMode(null);
            setQuestions([]);
          }
        })
        .catch(() => setWords([]))
        .finally(() => setLoading(false));
    }, [])
  );

  useEffect(() => {
    const focusItem = route?.params?.focusItem;
    if (!focusItem?.type) return;
    if (focusItemConsumedRef.current) { focusItemConsumedRef.current = false; return; }
    stopSpeech();
    setIsPlaying(false);
    AsyncStorage.getItem(WORDS_KEY)
      .then((raw) => {
        const loaded = raw ? JSON.parse(raw) : [];
        setWords(loaded);
        const mode = focusItem.displayMode === 'ar_shown' ? 'tr_to_de' : 'de_to_tr';
        setQuizMode(mode);
        applyFocusedQuiz(focusItem, loaded);
        resetGameState();
        setPhase('quiz');
        navigation?.setParams({ focusItem: null });
      })
      .catch(() => {});
  }, [route?.params?.focusItem]);

  // ── Shake animation ───────────────────────────────────────────────────────
  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // ── Start quiz ────────────────────────────────────────────────────────────
  const startQuiz = (mode) => {
    setQuizMode(mode);
    setQuestions(buildQuestions(words));
    setPhase('quiz');
    setTimeout(() => inputRef.current?.focus(), 400);
  };

  // ── Submit answer ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!inputValue.trim() || answerState !== 'idle') return;

    const q             = questions[currentIdx];
    const userAnswer    = inputValue.trim().toLowerCase();
    const correctAnswer = quizMode === 'de_to_tr'
      ? q.translation.trim().toLowerCase()
      : q.german.trim().toLowerCase();

    const correct =
      userAnswer === correctAnswer ||
      correctAnswer.includes(userAnswer) ||
      userAnswer.includes(correctAnswer);

    if (correct) {
      // ✅ Correct — show green state, user taps Next to continue
      setAnswerState('correct');
      const newStreak = streak + 1;
      setStreak(newStreak);
      setBestStreak(prev => Math.max(prev, newStreak));
      setScore(prev => prev + XP_PER_CORRECT);
      setCorrectCount(prev => prev + 1);
      await addXP(XP_PER_CORRECT);
    } else {
      // ❌ Wrong — shake, show red state, then auto-reset so user can retype
      setAnswerState('wrong');
      setWrongCount(prev => prev + 1);
      setStreak(0);
      triggerShake();

      // Clear and let user try again after a short pause
      retryTimerRef.current = setTimeout(() => {
        setAnswerState('idle');
        setInputValue('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }, 1400);
    }
  };

  // ── Advance to next question (only after correct) ─────────────────────────
  const handleNext = () => {
    stopSpeech();
    setIsPlaying(false);
    setAnswerState('idle');
    setInputValue('');

    if (currentIdx + 1 >= questions.length) {
      setPhase('done');
    } else {
      setCurrentIdx(prev => prev + 1);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  // ── Play again ────────────────────────────────────────────────────────────
  const handlePlayAgain = () => {
    resetGameState();
    setPhase('mode_select');
    setQuizMode(null);
    setQuestions([]);
  };

  // ── TTS ───────────────────────────────────────────────────────────────────
  const handleListen = (germanWord) => {
    if (isPlaying) { stopSpeech(); setIsPlaying(false); return; }
    setIsPlaying(true);
    speakGerman(germanWord, {
      onDone:  () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7B61FF" />
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE SELECTOR
  // ═══════════════════════════════════════════════════════════════════════════

  if (phase === 'mode_select') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>

          <LinearGradient
            colors={['#7B61FF', '#9B6FE8', '#C850C0']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={[styles.bannerRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={styles.bannerLeft}>
                <Text style={[styles.bannerEyebrow, isRTL && { textAlign: 'right' }]}>
                  {t('quiz.subtitle').toUpperCase()}
                </Text>
                <Text style={[styles.bannerTitle, isRTL && { textAlign: 'right' }]}>
                  {t('quiz.title')}
                </Text>
              </View>
              <Ionicons name="star" size={40} color="rgba(255,255,255,0.85)" />
            </View>
          </LinearGradient>

          {words.length < MIN_WORDS ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="library-outline" size={36} color="#7B61FF" />
              </View>
              <Text style={[styles.emptyTitle, isRTL && { textAlign: 'right' }]}>
                {t('quiz.noWords')}
              </Text>
              <Text style={[styles.emptyBody, isRTL && { textAlign: 'right' }]}>
                {t('quiz.addWordsFirst')}
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.modeHeading, isRTL && { textAlign: 'right' }]}>
                Quiz mode
              </Text>

              <View style={[styles.modeGrid, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity style={styles.modeCardTouch} onPress={() => startQuiz('de_to_tr')} activeOpacity={0.88}>
                  <LinearGradient colors={['#7B61FF', '#9B6FE8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeCard}>
                    <Text style={styles.modeCardFlag}>🇩🇪 → 🌍</Text>
                    <Text style={styles.modeCardTitle}>German → Translation</Text>
                    <Text style={styles.modeCardSub}>See German word, type the translation</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modeCardTouch} onPress={() => startQuiz('tr_to_de')} activeOpacity={0.88}>
                  <LinearGradient colors={['#4DBFA0', '#2E9E80']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeCard}>
                    <Text style={styles.modeCardFlag}>🌍 → 🇩🇪</Text>
                    <Text style={styles.modeCardTitle}>Translation → German</Text>
                    <Text style={styles.modeCardSub}>See the translation, type the German word</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={styles.wordCountPill}>
                <Ionicons name="book-outline" size={14} color="#9090A0" />
                <Text style={styles.wordCountText}>
                  {words.length} word{words.length !== 1 ? 's' : ''} available
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTS SCREEN
  // ═══════════════════════════════════════════════════════════════════════════

  if (phase === 'done') {
    const perfect = correctCount === questions.length && wrongCount === 0;
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>

          <LinearGradient
            colors={['#7B61FF', '#9B6FE8', '#C850C0']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={[styles.bannerRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={styles.bannerLeft}>
                <Text style={[styles.bannerEyebrow, isRTL && { textAlign: 'right' }]}>QUIZ COMPLETE</Text>
                <Text style={[styles.bannerTitle,   isRTL && { textAlign: 'right' }]}>
                  {perfect ? t('quiz.perfect') : t('quiz.wellDone')}
                </Text>
              </View>
              <Ionicons name={perfect ? 'trophy' : 'star'} size={40} color="rgba(255,255,255,0.9)" />
            </View>
          </LinearGradient>

          <View style={styles.xpHeadline}>
            <View style={styles.xpIconWrap}>
              <Ionicons name="flash" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.xpHeadlineText}>+{score} XP earned</Text>
          </View>

          <View style={styles.statsCard}>
            <View style={[styles.statsRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={styles.statItem}>
                <View style={[styles.statIconWrap, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="checkmark-circle" size={22} color="#4DBFA0" />
                </View>
                <Text style={styles.statValue}>{correctCount}</Text>
                <Text style={styles.statLabel}>Correct</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={[styles.statIconWrap, { backgroundColor: '#FFF0EF' }]}>
                  <Ionicons name="close-circle" size={22} color="#E8706A" />
                </View>
                <Text style={styles.statValue}>{wrongCount}</Text>
                <Text style={styles.statLabel}>Wrong tries</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={[styles.statIconWrap, { backgroundColor: '#FFF8E0' }]}>
                  <Ionicons name="flame" size={22} color="#F5C842" />
                </View>
                <Text style={styles.statValue}>{bestStreak}</Text>
                <Text style={styles.statLabel}>Best streak</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={handlePlayAgain} activeOpacity={0.88} style={styles.gradientTouch}>
            <LinearGradient
              colors={['#7B61FF', '#C850C0', '#FF6B9D']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.gradientBtn, isRTL && { flexDirection: 'row-reverse' }]}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.gradientBtnText}>Play again</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.backBtn, isRTL && { flexDirection: 'row-reverse' }]}
            onPress={() => navigation.navigate('Words')}
            activeOpacity={0.8}
          >
            <Ionicons name="book-outline" size={18} color="#7B61FF" />
            <Text style={styles.backBtnText}>Back to words</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVE QUIZ
  // ═══════════════════════════════════════════════════════════════════════════

  const currentQ  = questions[currentIdx];
  const isDeToTr  = quizMode === 'de_to_tr';
  const isCorrect = answerState === 'correct';
  const isWrong   = answerState === 'wrong';

  const inputBorderColor =
    isCorrect    ? '#4DBFA0' :
    isWrong      ? '#E8706A' :
    inputFocused ? '#7B61FF' :
    '#E8E8F0';
  const inputBgColor =
    isCorrect ? '#F0FBF8' :
    isWrong   ? '#FFF5F5' :
    '#FFFFFF';
  const inputTextColor =
    isCorrect ? '#4DBFA0' :
    isWrong   ? '#E8706A' :
    '#1A1A2E';

  const cardTranslateY = cardEnterAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.inner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Banner ── */}
          <LinearGradient
            colors={['#7B61FF', '#9B6FE8', '#C850C0']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={[styles.bannerRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={styles.bannerLeft}>
                <Text style={[styles.bannerEyebrow, isRTL && { textAlign: 'right' }]}>
                  {t('quiz.subtitle').toUpperCase()}
                </Text>
                <Text style={[styles.bannerTitle, isRTL && { textAlign: 'right' }]}>
                  {t('quiz.title')}
                </Text>
              </View>
              <View style={styles.scoreBubble}>
                <Text style={styles.scoreBubbleNum}>{score}</Text>
                <Text style={styles.scoreBubbleLabel}>XP</Text>
              </View>
            </View>
          </LinearGradient>

          {/* ── Progress bar ── */}
          <View style={styles.progressRow}>
            {questions.map((_, i) => (
              <View key={i} style={[
                styles.progressSeg,
                i === currentIdx && styles.progressSegActive,
                i < currentIdx  && styles.progressSegDone,
              ]} />
            ))}
          </View>

          {/* ── Question count ── */}
          <Text style={[styles.questionCount, isRTL && { textAlign: 'right' }]}>
            {currentIdx + 1} / {questions.length}
          </Text>

          {/* ══════════════════════════════════════════
              PREMIUM WORD CARD
          ══════════════════════════════════════════ */}
          <Animated.View style={[
            styles.wordCardOuter,
            { opacity: cardEnterAnim, transform: [{ translateY: cardTranslateY }] },
          ]}>
            <LinearGradient
              colors={['#6B4FD8', '#9B59E8', '#C850C0']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.wordCardGradient}
            >
              <View style={[styles.blob, styles.blob1]} />
              <View style={[styles.blob, styles.blob2]} />
              <View style={[styles.blob, styles.blob3]} />
              <View style={[styles.blob, styles.blob4]} />
              <View style={[styles.blob, styles.blob5]} />

              <View style={styles.glassCard}>
                <View style={styles.wordBadge}>
                  <Text style={styles.wordBadgeText}>
                    {isDeToTr ? 'What does this mean?' : 'How do you say this in German?'}
                  </Text>
                </View>

                <Text style={[styles.wordCardWord, !isDeToTr && styles.wordCardWordArabic]}>
                  {isDeToTr ? currentQ.german : currentQ.translation}
                </Text>

                {isDeToTr && currentQ.article && ARTICLE_PILL[currentQ.article] && (
                  <View style={[styles.articleInfoPill, { backgroundColor: ARTICLE_PILL[currentQ.article].bg }]}>
                    <Text style={[styles.articleInfoText, { color: ARTICLE_PILL[currentQ.article].color }]}>
                      {currentQ.article}
                    </Text>
                  </View>
                )}

                {!isDeToTr && currentQ.article && (
                  <Text style={styles.nounHint}>(noun)</Text>
                )}

                {isDeToTr && (
                  <TouchableOpacity
                    style={[styles.wordCardListenBtn, isPlaying && styles.wordCardListenBtnActive]}
                    onPress={() => handleListen(currentQ.german)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
                      size={18}
                      color={isPlaying ? '#FFFFFF' : '#7B61FF'}
                    />
                    <Text style={[styles.wordCardListenText, isPlaying && styles.wordCardListenTextActive]}>
                      {isPlaying ? 'Playing…' : 'Listen'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ══════════════════════════════════════════
              INPUT SECTION
          ══════════════════════════════════════════ */}
          <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
            {isDeToTr ? 'TYPE THE TRANSLATION' : 'TYPE THE GERMAN WORD'}
          </Text>

          <View style={[styles.inputRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor:     inputBorderColor,
                backgroundColor: inputBgColor,
                transform: [{ translateX: shakeAnim }],
              },
            ]}>
              <TextInput
                ref={inputRef}
                style={[styles.textInput, { color: inputTextColor }, isRTL && { textAlign: 'right' }]}
                placeholder={isDeToTr ? 'Type translation…' : 'Type German word…'}
                placeholderTextColor="#C0C0CC"
                value={inputValue}
                onChangeText={(text) => {
                  setInputValue(text);
                  // Typing after a wrong answer clears the wrong state immediately
                  if (answerState === 'wrong') {
                    setAnswerState('idle');
                    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                  }
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                editable={answerState !== 'correct'}
                autoCapitalize="none"
                autoCorrect={false}
                blurOnSubmit={false}
                returnKeyType="done"
                onSubmitEditing={answerState === 'idle' ? handleSubmit : undefined}
              />
            </Animated.View>

            {/* Submit arrow — hidden when correct (Next button takes over) */}
            {!isCorrect && (
              <TouchableOpacity
                onPress={handleSubmit}
                activeOpacity={0.88}
                disabled={!inputValue.trim() || answerState !== 'idle'}
                style={[
                  styles.submitBtnTouch,
                  (!inputValue.trim() || answerState !== 'idle') && { opacity: 0.4 },
                ]}
              >
                <LinearGradient
                  colors={['#7B61FF', '#FF6B9D']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Inline feedback ── */}
          {isCorrect && (
            <View style={[styles.feedbackBox, styles.feedbackCorrect, isRTL && { flexDirection: 'row-reverse' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#4DBFA0" />
              <Text style={styles.feedbackCorrectText}>Richtig!</Text>
            </View>
          )}
          {isWrong && (
            <View style={[styles.feedbackBox, styles.feedbackWrong, isRTL && { flexDirection: 'row-reverse' }]}>
              <Ionicons name="close-circle" size={20} color="#E8706A" />
              <Text style={styles.feedbackWrongText}>Falsch! — try again</Text>
            </View>
          )}

          {/* ── Next button (only after correct) ── */}
          {isCorrect && (
            <TouchableOpacity onPress={handleNext} activeOpacity={0.88} style={[styles.gradientTouch, { marginTop: 8 }]}>
              <LinearGradient
                colors={['#4DBFA0', '#2E9E80']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.gradientBtn, isRTL && { flexDirection: 'row-reverse' }]}
              >
                <Text style={styles.gradientBtnText}>
                  {currentIdx + 1 >= questions.length ? t('quiz.seeResults') : t('quiz.next')}
                </Text>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color="#FFFFFF" />
              </LinearGradient>
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

  banner:        { borderRadius: 24, padding: 22, marginBottom: 16 },
  bannerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerLeft:    { flex: 1 },
  bannerEyebrow: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 5 },
  bannerTitle:   { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },

  scoreBubble: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  scoreBubbleNum:   { fontSize: 22, fontWeight: '800', color: '#FFFFFF', lineHeight: 26 },
  scoreBubbleLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },

  progressRow:       { flexDirection: 'row', gap: 6, marginBottom: 10 },
  progressSeg:       { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E2E5F0' },
  progressSegActive: { backgroundColor: '#7B61FF' },
  progressSegDone:   { backgroundColor: '#C4B5FD' },

  questionCount: { fontSize: 13, fontWeight: '600', color: '#9090A0', marginBottom: 14 },

  // Mode selector
  modeHeading:   { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  modeGrid:      { flexDirection: 'row', gap: 12, marginBottom: 20 },
  modeCardTouch: { flex: 1, borderRadius: 20, overflow: 'hidden', shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 6 },
  modeCard:      { borderRadius: 20, padding: 20, minHeight: 160, justifyContent: 'flex-end' },
  modeCardFlag:  { fontSize: 22, marginBottom: 10 },
  modeCardTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 6, lineHeight: 20 },
  modeCardSub:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 16 },
  wordCountPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: '#F0EDFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  wordCountText: { fontSize: 13, color: '#9090A0', fontWeight: '500' },

  // Word card
  wordCardOuter:    { width: '100%', borderRadius: 32, overflow: 'hidden', marginBottom: 0, minHeight: 220, shadowColor: '#6B4FD8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  wordCardGradient: { borderRadius: 32, overflow: 'hidden', minHeight: 220, position: 'relative' },
  blob:  { position: 'absolute' },
  blob1: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.12)', top: -30, left: -30 },
  blob2: { width: 90,  height: 90,  borderRadius: 45, backgroundColor: '#C850C0', opacity: 0.35, top: 10, right: 20 },
  blob3: { width: 70,  height: 70,  borderRadius: 35, backgroundColor: '#4DBFA0', opacity: 0.25, bottom: 15, left: 25 },
  blob4: { width: 50,  height: 50,  borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.08)', bottom: -10, right: 30 },
  blob5: { width: 40,  height: 40,  borderRadius: 20, backgroundColor: '#FF6B9D', opacity: 0.2, top: '40%', left: 60 },
  glassCard: {
    margin: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    zIndex: 2,
  },
  wordBadge:     { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 14 },
  wordBadgeText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  wordCardWord:        { fontSize: 48, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', letterSpacing: -1, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, marginBottom: 10 },
  wordCardWordArabic:  { fontSize: 34, lineHeight: 48, letterSpacing: 0 },
  articleInfoPill:     { borderRadius: 50, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  articleInfoText:     { fontSize: 13, fontWeight: '700' },
  nounHint:            { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', marginBottom: 12 },
  wordCardListenBtn:       { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 50, paddingHorizontal: 22, paddingVertical: 10, alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  wordCardListenBtnActive: { backgroundColor: '#7B61FF' },
  wordCardListenText:       { fontSize: 14, fontWeight: '700', color: '#7B61FF' },
  wordCardListenTextActive: { color: '#FFFFFF' },

  // Input
  inputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.4, color: '#9090A0', marginTop: 24, marginBottom: 10 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inputWrapper: {
    flex: 1,
    height: 62,
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  textInput: { fontSize: 20, fontWeight: '600', padding: 0 },
  submitBtnTouch: { borderRadius: 18, overflow: 'hidden', shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitBtn:      { width: 62, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Inline feedback
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  feedbackCorrect:     { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  feedbackWrong:       { backgroundColor: '#FFF0EF', borderWidth: 1, borderColor: '#FCD0C8' },
  feedbackCorrectText: { fontSize: 15, fontWeight: '700', color: '#4DBFA0' },
  feedbackWrongText:   { fontSize: 15, fontWeight: '700', color: '#E8706A' },

  // Gradient buttons
  gradientTouch:  { borderRadius: 18, overflow: 'hidden', marginBottom: 14, shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  gradientBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, paddingHorizontal: 20, gap: 8 },
  gradientBtnText:{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },

  backBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E8E0FF' },
  backBtnText: { fontSize: 16, fontWeight: '700', color: '#7B61FF' },

  // Results screen
  xpHeadline:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  xpIconWrap:     { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FEF9C3', alignItems: 'center', justifyContent: 'center' },
  xpHeadlineText: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  statsCard:      { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  statsRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statItem:       { alignItems: 'center', flex: 1 },
  statIconWrap:   { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue:      { fontSize: 28, fontWeight: '800', color: '#1A1A2E', lineHeight: 32 },
  statLabel:      { fontSize: 12, color: '#9090A0', fontWeight: '500', marginTop: 2 },
  statDivider:    { width: 1, height: 60, backgroundColor: '#F0F0F8' },

  // Empty state
  emptyCard:    { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 36, alignItems: 'center', shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
  emptyIconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle:   { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 10 },
  emptyBody:    { fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 23 },
});
