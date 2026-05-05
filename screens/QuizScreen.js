import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ARTICLE_COLORS } from '../constants/articleColors';
import { addXP } from '../utils/progress';

const WORDS_KEY     = 'words';
const SENTENCES_KEY = 'sentences';
const MODE          = { TRANSLATION: 'translation', ARTICLE: 'article' };
const MIN_TRANSLATION = 3;
const MIN_ARTICLE     = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Normal quiz builders ─────────────────────────────────────────────────────

function buildTranslationQuestion(words, previousWordId) {
  const pool =
    words.length > MIN_TRANSLATION
      ? words.filter((w) => w.id !== previousWordId)
      : words;
  const correct    = pool[Math.floor(Math.random() * pool.length)];
  const distractors = shuffle(words.filter((w) => w.id !== correct.id)).slice(0, 2);
  return {
    wordId:        correct.id,
    word:          correct.word,
    article:       correct.article,
    correctAnswer: correct.translation,
    options: shuffle([correct, ...distractors]).map((w) => ({
      id:        w.id,
      label:     w.translation,
      isCorrect: w.id === correct.id,
    })),
  };
}

function buildArticleQuestion(words, previousWordId) {
  const pool =
    words.length > MIN_ARTICLE
      ? words.filter((w) => w.id !== previousWordId)
      : words;
  const correct = pool[Math.floor(Math.random() * pool.length)];
  return {
    wordId:        correct.id,
    word:          correct.word,
    correctAnswer: correct.article,
    options: shuffle(['der', 'die', 'das', 'plural']).map((art) => ({
      id:        art,
      label:     art,
      isCorrect: art === correct.article,
    })),
  };
}

// ─── Focus quiz builders (notification-triggered) ────────────────────────────

/** Q1 for word notifications: choose the article */
function buildFocusArticleQuestion(focusItem) {
  return {
    stepLabel:     'Choose the correct article',
    displayText:   focusItem.word,
    hint:          'What is the article for this word?',
    correctAnswer: focusItem.article,
    isArticleStep: true,
    options: shuffle(['der', 'die', 'das', 'plural']).map((art) => ({
      id:        art,
      label:     art,
      isCorrect: art === focusItem.article,
    })),
  };
}

/** Q2 for word notifications: choose the German word from its translation */
function buildFocusWordQuestion(focusItem, allWords) {
  const distractors = shuffle(
    allWords.filter((w) => w.id !== focusItem.wordId)
  ).slice(0, 2);

  const correctOption = { id: focusItem.wordId, label: focusItem.word, isCorrect: true };
  const wrongOptions  = distractors.map((w) => ({ id: w.id, label: w.word, isCorrect: false }));

  return {
    stepLabel:     'Find the German word',
    displayText:   focusItem.translation,
    hint:          'What is the German word for this translation?',
    correctAnswer: focusItem.word,
    isArticleStep: false,
    options:       shuffle([correctOption, ...wrongOptions]),
  };
}

/** Q1 for sentence notifications: choose the correct German sentence */
function buildFocusSentenceQuestion(focusItem, allSentences) {
  const distractors = shuffle(
    allSentences.filter((s) => s.id !== focusItem.sentenceId)
  ).slice(0, 2);

  const correctOption = {
    id:        focusItem.sentenceId,
    label:     focusItem.sentence,
    isCorrect: true,
  };
  const wrongOptions = distractors.map((s) => ({
    id:        s.id,
    label:     s.sentence,
    isCorrect: false,
  }));

  return {
    stepLabel:     'Find the German sentence',
    displayText:   focusItem.translation,
    hint:          'Which sentence matches this translation?',
    correctAnswer: focusItem.sentence,
    isArticleStep: false,
    options:       shuffle([correctOption, ...wrongOptions]),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuizScreen({ route, navigation }) {
  // ── Normal quiz state ──────────────────────────────────────────────────────
  const [words,     setWords]     = useState([]);
  const [sentences, setSentences] = useState([]);
  const [mode,      setMode]      = useState(MODE.TRANSLATION);
  const [question,  setQuestion]  = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [score,     setScore]     = useState({ correct: 0, total: 0 });
  const [loading,   setLoading]   = useState(true);

  // ── Focus quiz state ───────────────────────────────────────────────────────
  // focusItem: full data from the notification { type, ...fields }
  const [focusItem,      setFocusItem]      = useState(null);
  const [focusQuestions, setFocusQuestions] = useState([]);
  const [focusStep,      setFocusStep]      = useState(0);
  const [focusSelected,  setFocusSelected]  = useState(null);
  const [focusScore,     setFocusScore]     = useState({ correct: 0, total: 0 });

  // ── Enter focus quiz when notification param arrives ───────────────────────
  useEffect(() => {
    const fi = route.params?.focusItem;
    if (!fi) return;
    setFocusItem(fi);
    setFocusStep(0);
    setFocusSelected(null);
    setFocusScore({ correct: 0, total: 0 });
  }, [route.params?.focusItem]);

  // Build focus questions once focusItem + data lists are ready
  useEffect(() => {
    if (!focusItem) return;

    if (focusItem.type === 'word') {
      const q1     = buildFocusArticleQuestion(focusItem);
      const others = words.filter((w) => w.id !== focusItem.wordId);
      const q2     = others.length >= 1 ? buildFocusWordQuestion(focusItem, words) : null;
      setFocusQuestions(q2 ? [q1, q2] : [q1]);

    } else if (focusItem.type === 'sentence') {
      // Need at least 2 other sentences for distractors; if not, just ask the 1 question
      const q1 = buildFocusSentenceQuestion(focusItem, sentences);
      setFocusQuestions([q1]);
    }
  }, [focusItem, words, sentences]);

  // ── Reload words + sentences on every tab focus ────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setSelected(null);
      setScore({ correct: 0, total: 0 });
      Promise.all([
        AsyncStorage.getItem(WORDS_KEY).then((r) => (r ? JSON.parse(r) : [])),
        AsyncStorage.getItem(SENTENCES_KEY).then((r) => (r ? JSON.parse(r) : [])),
      ])
        .then(([w, s]) => { setWords(w); setSentences(s); })
        .catch(() => { setWords([]); setSentences([]); })
        .finally(() => setLoading(false));
    }, [])
  );

  // Regenerate normal quiz question when words/mode change
  useEffect(() => {
    if (focusItem) return; // don't reset while focus quiz is active
    if (mode === MODE.TRANSLATION && words.length >= MIN_TRANSLATION) {
      setQuestion(buildTranslationQuestion(words, null));
    } else if (mode === MODE.ARTICLE && words.length >= MIN_ARTICLE) {
      setQuestion(buildArticleQuestion(words, null));
    } else {
      setQuestion(null);
    }
    setSelected(null);
  }, [words, mode, focusItem]);

  // ── Handlers: normal quiz ──────────────────────────────────────────────────

  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return;
    setQuestion(null);
    setSelected(null);
    setMode(newMode);
    setScore({ correct: 0, total: 0 });
  };

  const handleSelect = (option) => {
    if (selected !== null) return;
    setSelected(option.id);
    setScore((prev) => ({
      correct: prev.correct + (option.isCorrect ? 1 : 0),
      total:   prev.total + 1,
    }));
    if (option.isCorrect) addXP();
  };

  const handleNext = () => {
    setSelected(null);
    setQuestion((prev) =>
      mode === MODE.TRANSLATION
        ? buildTranslationQuestion(words, prev?.wordId ?? null)
        : buildArticleQuestion(words, prev?.wordId ?? null)
    );
  };

  // ── Handlers: focus quiz ───────────────────────────────────────────────────

  const handleFocusSelect = (option) => {
    if (focusSelected !== null) return;
    setFocusSelected(option.id);
    setFocusScore((prev) => ({
      correct: prev.correct + (option.isCorrect ? 1 : 0),
      total:   prev.total + 1,
    }));
    if (option.isCorrect) addXP();
  };

  const handleFocusNext = () => {
    if (focusStep + 1 >= focusQuestions.length) {
      setFocusStep(focusQuestions.length); // → done
    } else {
      setFocusStep((s) => s + 1);
      setFocusSelected(null);
    }
  };

  const exitFocusQuiz = () => {
    setFocusItem(null);
    setFocusStep(0);
    setFocusSelected(null);
    setFocusScore({ correct: 0, total: 0 });
    navigation.setParams({ focusItem: null });
  };

  // ── Derived: normal quiz ───────────────────────────────────────────────────

  const isAnswered     = selected !== null;
  const wasCorrect     = isAnswered && question?.options.find((o) => o.id === selected)?.isCorrect;
  const minRequired    = mode === MODE.TRANSLATION ? MIN_TRANSLATION : MIN_ARTICLE;
  const hasEnoughWords = words.length >= minRequired;

  const getOptionStyle = (option, isArticleMode) => {
    if (isAnswered) {
      if (option.isCorrect)        return [styles.option, styles.optionCorrect];
      if (option.id === selected)  return [styles.option, styles.optionWrong];
      return [styles.option, styles.optionDimmed];
    }
    if (isArticleMode) {
      const colors = ARTICLE_COLORS[option.id];
      if (!colors) return styles.option;
      return [styles.option, { backgroundColor: colors.bg, borderColor: 'transparent' }];
    }
    return styles.option;
  };

  const getOptionTextStyle = (option, isArticleMode) => {
    if (isAnswered) {
      if (option.isCorrect)        return [styles.optionText, styles.optionTextCorrect];
      if (option.id === selected)  return [styles.optionText, styles.optionTextWrong];
      return [styles.optionText, styles.optionTextDimmed];
    }
    if (isArticleMode) {
      const colors = ARTICLE_COLORS[option.id];
      if (!colors) return styles.optionText;
      return [styles.optionText, { color: colors.text, fontWeight: '800' }];
    }
    return styles.optionText;
  };

  // ── Derived: focus quiz ────────────────────────────────────────────────────

  const focusCurrentQ    = focusQuestions[focusStep] ?? null;
  const focusDone        = focusStep >= focusQuestions.length && focusQuestions.length > 0;
  const isFocusAnswered  = focusSelected !== null;
  const focusWasCorrect  =
    isFocusAnswered && focusCurrentQ?.options.find((o) => o.id === focusSelected)?.isCorrect;

  const getFocusOptionStyle = (option) => {
    if (isFocusAnswered) {
      if (option.isCorrect)              return [styles.option, styles.optionCorrect];
      if (option.id === focusSelected)   return [styles.option, styles.optionWrong];
      return [styles.option, styles.optionDimmed];
    }
    if (focusCurrentQ?.isArticleStep) {
      const colors = ARTICLE_COLORS[option.id];
      if (!colors) return styles.option;
      return [styles.option, { backgroundColor: colors.bg, borderColor: 'transparent' }];
    }
    return styles.option;
  };

  const getFocusOptionTextStyle = (option) => {
    if (isFocusAnswered) {
      if (option.isCorrect)              return [styles.optionText, styles.optionTextCorrect];
      if (option.id === focusSelected)   return [styles.optionText, styles.optionTextWrong];
      return [styles.optionText, styles.optionTextDimmed];
    }
    if (focusCurrentQ?.isArticleStep) {
      const colors = ARTICLE_COLORS[option.id];
      if (!colors) return styles.optionText;
      return [styles.optionText, { color: colors.text, fontWeight: '800' }];
    }
    return styles.optionText;
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FOCUS QUIZ  (notification-triggered — word OR sentence)
  // ════════════════════════════════════════════════════════════════════════════

  if (focusItem) {
    // Label shown in the done card
    const focusLabel =
      focusItem.type === 'word' ? focusItem.word : 'this sentence';

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Quick Quiz</Text>
              <Text style={styles.subtitle}>Started from notification 🔔</Text>
            </View>
            <TouchableOpacity style={styles.exitButton} onPress={exitFocusQuiz} activeOpacity={0.7}>
              <Text style={styles.exitButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Done card ── */}
          {focusDone ? (
            <>
              <View style={styles.doneCard}>
                <Text style={styles.doneEmoji}>
                  {focusScore.correct === focusScore.total ? '🎉' :
                   focusScore.correct > 0 ? '👍' : '💪'}
                </Text>
                <Text style={styles.doneTitle}>Quiz complete!</Text>
                <Text style={styles.doneBody}>
                  You got{' '}
                  <Text style={styles.doneScore}>
                    {focusScore.correct} / {focusScore.total}
                  </Text>{' '}
                  correct for{' '}
                  <Text style={{ fontWeight: '700', color: '#1A1A2E' }}>{focusLabel}</Text>
                </Text>
              </View>
              <TouchableOpacity style={styles.nextButton} onPress={exitFocusQuiz} activeOpacity={0.85}>
                <Text style={styles.nextButtonText}>Continue to full quiz →</Text>
              </TouchableOpacity>
            </>

          ) : focusCurrentQ ? (
            <>
              {/* Step counter */}
              <View style={styles.stepRow}>
                {focusQuestions.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.stepDot,
                      i === focusStep && styles.stepDotActive,
                      i < focusStep  && styles.stepDotDone,
                    ]}
                  />
                ))}
                <Text style={styles.stepLabel}>
                  Question {focusStep + 1} of {focusQuestions.length}
                </Text>
              </View>

              {/* Question card */}
              <View style={styles.card}>
                <Text style={styles.questionLabel}>{focusCurrentQ.stepLabel}</Text>
                <Text style={[
                  styles.wordText,
                  focusItem.type === 'sentence' && styles.sentenceText,
                ]}>
                  {focusCurrentQ.displayText}
                </Text>
                <Text style={styles.questionHint}>{focusCurrentQ.hint}</Text>

                <View style={styles.options}>
                  {focusCurrentQ.options.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={getFocusOptionStyle(option)}
                      onPress={() => handleFocusSelect(option)}
                      activeOpacity={isFocusAnswered ? 1 : 0.75}
                      disabled={isFocusAnswered}
                    >
                      <Text style={[
                        getFocusOptionTextStyle(option),
                        focusItem.type === 'sentence' && styles.optionSentenceText,
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {isFocusAnswered && (
                  <View style={[styles.feedbackRow, focusWasCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
                    <Text style={[styles.feedbackText, focusWasCorrect ? styles.feedbackTextCorrect : styles.feedbackTextWrong]}>
                      {focusWasCorrect
                        ? '✓  Correct!'
                        : `✗  "${focusCurrentQ.correctAnswer}"`}
                    </Text>
                  </View>
                )}
              </View>

              {isFocusAnswered && (
                <TouchableOpacity style={styles.nextButton} onPress={handleFocusNext} activeOpacity={0.85}>
                  <Text style={styles.nextButtonText}>
                    {focusStep + 1 < focusQuestions.length ? 'Next question →' : 'See results →'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // NORMAL QUIZ
  // ════════════════════════════════════════════════════════════════════════════

  const articleColors =
    question && mode === MODE.TRANSLATION ? ARTICLE_COLORS[question.article] : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Quiz</Text>
            <Text style={styles.subtitle}>Test your knowledge</Text>
          </View>
          {score.total > 0 && (
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>
                {score.correct}
                <Text style={styles.scoreTotal}> / {score.total}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* Mode selector */}
        <View style={styles.modeSelector}>
          {[MODE.TRANSLATION, MODE.ARTICLE].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeButton, mode === m && styles.modeButtonActive]}
              onPress={() => handleModeSwitch(m)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeButtonText, mode === m && styles.modeButtonTextActive]}>
                {m === MODE.TRANSLATION ? 'Translation' : 'Article'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Not enough words */}
        {!hasEnoughWords && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>
              {words.length === 0 ? 'No words yet' : 'Not enough words'}
            </Text>
            <Text style={styles.emptyBody}>
              {words.length === 0
                ? 'Add words in the Words tab to start the quiz.'
                : `Translation Quiz needs at least ${MIN_TRANSLATION} words. Add ${MIN_TRANSLATION - words.length} more to continue.`}
            </Text>
            {words.length > 0 && (
              <View style={styles.emptyPill}>
                <Text style={styles.emptyPillText}>
                  {words.length} / {MIN_TRANSLATION} words added
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Question card */}
        {hasEnoughWords && question && (
          <View style={styles.card}>
            <Text style={styles.questionLabel}>
              {mode === MODE.TRANSLATION ? 'Translate this word' : 'Choose the correct article'}
            </Text>
            <View style={styles.wordRow}>
              {mode === MODE.TRANSLATION && articleColors && (
                <View style={[styles.articleBadge, { backgroundColor: articleColors.bg }]}>
                  <Text style={[styles.articleBadgeText, { color: articleColors.text }]}>
                    {question.article}
                  </Text>
                </View>
              )}
              <Text style={styles.wordText}>{question.word}</Text>
            </View>
            <Text style={styles.questionHint}>
              {mode === MODE.TRANSLATION ? 'What is the correct translation?' : 'What is the article for this word?'}
            </Text>
            <View style={styles.options}>
              {question.options.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={getOptionStyle(option, mode === MODE.ARTICLE)}
                  onPress={() => handleSelect(option)}
                  activeOpacity={isAnswered ? 1 : 0.75}
                  disabled={isAnswered}
                >
                  <Text style={getOptionTextStyle(option, mode === MODE.ARTICLE)}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {isAnswered && (
              <View style={[styles.feedbackRow, wasCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
                <Text style={[styles.feedbackText, wasCorrect ? styles.feedbackTextCorrect : styles.feedbackTextWrong]}>
                  {wasCorrect ? '✓  Correct!' : `✗  The answer is "${question.correctAnswer}"`}
                </Text>
              </View>
            )}
          </View>
        )}

        {isAnswered && hasEnoughWords && (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextButtonText}>Next question →</Text>
          </TouchableOpacity>
        )}

        {score.total > 0 && (
          <Text style={styles.progressHint}>
            {score.total} question{score.total === 1 ? '' : 's'} answered this session
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inner:     { padding: 24, paddingTop: 36, paddingBottom: 60 },

  /* Header */
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title:     { fontSize: 30, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  subtitle:  { fontSize: 15, color: '#6B7280' },

  /* Exit button */
  exitButton:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  exitButtonText: { fontSize: 14, color: '#6B7280', fontWeight: '700' },

  /* Score pill */
  scorePill:  { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start', marginTop: 4 },
  scoreText:  { fontSize: 20, fontWeight: '800', color: '#4F46E5' },
  scoreTotal: { fontSize: 14, fontWeight: '600', color: '#A5B4FC' },

  /* Mode selector */
  modeSelector:         { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 4, marginBottom: 24 },
  modeButton:           { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  modeButtonActive:     { backgroundColor: '#4F46E5', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  modeButtonText:       { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  modeButtonTextActive: { color: '#FFFFFF' },

  /* Step indicator */
  stepRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  stepDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  stepDotActive:  { backgroundColor: '#4F46E5', width: 20, borderRadius: 4 },
  stepDotDone:    { backgroundColor: '#A5B4FC' },
  stepLabel:      { fontSize: 13, color: '#9CA3AF', marginLeft: 4, fontWeight: '500' },

  /* Question card */
  card:          { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3, marginBottom: 20 },
  questionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 18 },
  wordRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  articleBadge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  articleBadgeText: { fontSize: 14, fontWeight: '700' },
  wordText:      { fontSize: 32, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.5, marginBottom: 8, flexShrink: 1 },
  // Sentences are longer — smaller font so they fit
  sentenceText:  { fontSize: 20, fontWeight: '700', letterSpacing: 0, lineHeight: 28 },
  questionHint:  { fontSize: 14, color: '#9CA3AF', marginBottom: 24 },

  /* Options */
  options:        { gap: 12 },
  option:         { borderRadius: 14, paddingVertical: 18, paddingHorizontal: 20, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', alignItems: 'center' },
  optionCorrect:  { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  optionWrong:    { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  optionDimmed:   { borderColor: '#F3F4F6', backgroundColor: '#FAFAFA', opacity: 0.45 },
  optionText:         { fontSize: 17, fontWeight: '600', color: '#374151', textAlign: 'center' },
  optionSentenceText: { fontSize: 15 }, // narrower font for long sentence options
  optionTextCorrect:  { color: '#059669', fontWeight: '700' },
  optionTextWrong:    { color: '#DC2626', fontWeight: '700' },
  optionTextDimmed:   { color: '#9CA3AF' },

  /* Feedback strip */
  feedbackRow:          { marginTop: 18, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  feedbackCorrect:      { backgroundColor: '#ECFDF5' },
  feedbackWrong:        { backgroundColor: '#FEF2F2' },
  feedbackText:         { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  feedbackTextCorrect:  { color: '#059669' },
  feedbackTextWrong:    { color: '#DC2626' },

  /* Next button */
  nextButton:     { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginBottom: 20 },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  progressHint: { textAlign: 'center', fontSize: 13, color: '#D1D5DB' },

  /* Done card */
  doneCard:  { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3, marginBottom: 20 },
  doneEmoji: { fontSize: 52, marginBottom: 16 },
  doneTitle: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', marginBottom: 12 },
  doneBody:  { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
  doneScore: { fontWeight: '800', color: '#4F46E5', fontSize: 18 },

  /* Empty state */
  emptyCard:     { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  emptyIcon:     { fontSize: 52, marginBottom: 18 },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 10 },
  emptyBody:     { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  emptyPill:     { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  emptyPillText: { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
});
