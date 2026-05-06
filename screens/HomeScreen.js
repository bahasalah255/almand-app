import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  loadProgress,
  updateStreak,
  xpInCurrentLevel,
  xpForNextLevel,
} from '../utils/progress';
import { useLanguage } from '../utils/LanguageContext';

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  const { t, isRTL } = useLanguage();
  const now    = new Date();
  const days   = t('days');
  const months = t('months');
  const day    = Array.isArray(days)   ? days[now.getDay()]    : '';
  const month  = Array.isArray(months) ? months[now.getMonth()] : '';
  const dateStr = isRTL
    ? `${now.getDate()} ${month} · ${day}`
    : `${day} · ${month} ${now.getDate()}`;

  const hour     = now.getHours();
  const greetKey = hour < 12 ? 'greeting.morning' : hour < 17 ? 'greeting.afternoon' : 'greeting.evening';

  return (
    <View style={[h.row, isRTL && { flexDirection: 'row-reverse' }]}>
      <View>
        <Text style={[h.date, isRTL && { textAlign: 'right' }]}>{dateStr}</Text>
        <Text style={[h.greeting, isRTL && { textAlign: 'right' }]}>{t(greetKey)}</Text>
      </View>
      <View style={h.avatar}>
        <Text style={h.avatarLetter}>L</Text>
      </View>
    </View>
  );
}

const h = StyleSheet.create({
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  date:         { fontSize: 13, color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  greeting:     { fontSize: 26, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', borderWidth: 2, borderColor: '#C7D2FE', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '800', color: '#4F46E5' },
});

// ─── HeroCard ─────────────────────────────────────────────────────────────────

function HeroCard({ streak, onPress }) {
  const { t, isRTL } = useLanguage();
  return (
    <LinearGradient
      colors={['#6366F1', '#8B5CF6', '#EC4899']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={hero.card}
    >
      <View style={[hero.topRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={hero.streakPill}>
          <Ionicons name="flame" size={13} color="#FFFFFF" />
          <Text style={hero.streakPillText}> {t('home.streakDays', { n: streak })}</Text>
        </View>
        <Ionicons name="trophy" size={28} color="rgba(255,255,255,0.9)" />
      </View>

      <Text style={[hero.eyebrow,  isRTL && { textAlign: 'right' }]}>{t('home.letLearnToday')}</Text>
      <Text style={[hero.title,    isRTL && { textAlign: 'right' }]}>{t('home.buildStreak')}</Text>
      <Text style={[hero.subtitle, isRTL && { textAlign: 'right' }]}>{t('home.keepGoing')}</Text>

      <TouchableOpacity
        style={[hero.button, isRTL && { alignSelf: 'flex-end', flexDirection: 'row-reverse' }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={hero.buttonText}>{t('home.startNow')}</Text>
        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const hero = StyleSheet.create({
  card:           { borderRadius: 24, padding: 22, marginBottom: 18 },
  topRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  streakPill:     { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' },
  streakPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  eyebrow:        { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 6 },
  title:          { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, letterSpacing: -0.3 },
  subtitle:       { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 20, lineHeight: 20 },
  button:         { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttonText:     { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

// ─── StatsRow ─────────────────────────────────────────────────────────────────

function StatsRow({ streak, xp, level }) {
  const { t, isRTL } = useLanguage();
  const currentXP = xpInCurrentLevel(xp, level);
  const needed    = xpForNextLevel();
  const pct       = Math.min(currentXP / needed, 1);

  return (
    <View style={[sr.row, isRTL && { flexDirection: 'row-reverse' }]}>
      <View style={[sr.card, sr.streakCard]}>
        <Ionicons name="flame" size={24} color="#F97316" style={sr.icon} />
        <Text style={sr.label}>{t('home.streak')}</Text>
        <Text style={sr.value}>{streak}</Text>
        <Text style={sr.unit}>{t('home.days')}</Text>
      </View>

      <View style={[sr.card, sr.xpCard]}>
        <View style={[sr.xpTop, isRTL && { flexDirection: 'row-reverse' }]}>
          <Ionicons name="star" size={24} color="#F59E0B" style={sr.icon} />
          <View style={sr.levelPill}>
            <Text style={sr.levelText}>{t('home.level', { n: level })}</Text>
          </View>
        </View>
        <Text style={[sr.label, isRTL && { textAlign: 'right' }]}>{t('home.xp')}</Text>
        <Text style={[sr.value, isRTL && { textAlign: 'right' }]}>{xp}</Text>
        <View style={sr.barTrack}>
          <View style={[sr.barFill, { width: `${pct * 100}%` }]} />
        </View>
        <Text style={[sr.xpSub, isRTL && { textAlign: 'right' }]}>
          {t('home.toLevelUp', { cur: currentXP, max: needed })}
        </Text>
      </View>
    </View>
  );
}

const sr = StyleSheet.create({
  row:        { flexDirection: 'row', gap: 12, marginBottom: 18 },
  card:       { flex: 1, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  streakCard: { backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  xpCard:     { backgroundColor: '#FFFFFF' },
  icon:       { marginBottom: 6 },
  label:      { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 2 },
  value:      { fontSize: 30, fontWeight: '800', color: '#1A1A2E', lineHeight: 34 },
  unit:       { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  xpTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  levelPill:  { backgroundColor: '#EEF2FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  levelText:  { fontSize: 12, fontWeight: '800', color: '#4F46E5' },
  barTrack:   { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginTop: 8, marginBottom: 4 },
  barFill:    { height: '100%', backgroundColor: '#4F46E5', borderRadius: 3 },
  xpSub:      { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
});

// ─── WordCard ─────────────────────────────────────────────────────────────────

function WordCard({ wordData }) {
  const { t, isRTL } = useLanguage();
  const { article = 'die', word = 'Sonne', translation = 'the sun' } = wordData ?? {};

  return (
    <LinearGradient
      colors={['#F43F5E', '#EC4899', '#A855F7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={wc.card}
    >
      <Text style={[wc.sectionLabel, isRTL && { textAlign: 'right' }]}>{t('home.wordOfTheDay')}</Text>

      <View style={[wc.wordRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={wc.articleBadge}>
          <Text style={wc.articleText}>{article}</Text>
        </View>
        <Text style={wc.word}>{word}</Text>
      </View>

      <Text style={[wc.translation, isRTL && { textAlign: 'right' }]}>{translation}</Text>

      <View style={[wc.actions, isRTL && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity style={wc.actionBtn} activeOpacity={0.8}>
          <Ionicons name="volume-medium-outline" size={15} color="#FFFFFF" />
          <Text style={wc.actionBtnText}>{t('common.listen')}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const wc = StyleSheet.create({
  card:          { borderRadius: 24, padding: 22, marginBottom: 18 },
  sectionLabel:  { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 14 },
  wordRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  articleBadge:  { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.25)' },
  articleText:   { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  word:          { fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  translation:   { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 20 },
  actions:       { flexDirection: 'row', gap: 10 },
  actionBtn:     { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

// ─── Buttons ──────────────────────────────────────────────────────────────────

function QuizButton({ onPress }) {
  const { t, isRTL } = useLanguage();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={qb.wrapper}>
      <LinearGradient
        colors={['#6366F1', '#8B5CF6', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[qb.gradient, isRTL && { flexDirection: 'row-reverse' }]}
      >
        <Text style={qb.text}>{t('home.startQuiz')}</Text>
        <View style={qb.xpPill}>
          <Text style={qb.xpText}>{t('home.xpPill')}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function ScanButton({ onPress }) {
  const { t, isRTL } = useLanguage();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={sb.wrapper}>
      <LinearGradient
        colors={['#7B61FF', '#C850C0', '#FF6B9D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[sb.gradient, isRTL && { flexDirection: 'row-reverse' }]}
      >
        <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
        <Text style={sb.text}>{t('home.scanQR')}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const qb = StyleSheet.create({
  wrapper:  { borderRadius: 18, overflow: 'hidden', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6, marginBottom: 16 },
  gradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  text:     { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  xpPill:   { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  xpText:   { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

const sb = StyleSheet.create({
  wrapper:  { borderRadius: 18, overflow: 'hidden', shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6, marginBottom: 32 },
  gradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  text:     { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation();

  const [streak,    setStreak]    = useState(0);
  const [xp,        setXp]        = useState(0);
  const [level,     setLevel]     = useState(1);
  const [wordOfDay, setWordOfDay] = useState(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { streakCount }            = await updateStreak();
        const { xp: savedXP, level: lv } = await loadProgress();
        setStreak(streakCount);
        setXp(savedXP);
        setLevel(lv);
        const raw   = await AsyncStorage.getItem('words');
        const words = raw ? JSON.parse(raw) : [];
        if (words.length > 0) setWordOfDay(words[0]);
      })();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header />
        <HeroCard streak={streak} onPress={() => navigation.navigate('Quiz')} />
        <StatsRow streak={streak} xp={xp} level={level} />
        <WordCard wordData={wordOfDay} />
        <QuizButton onPress={() => navigation.navigate('Quiz')} />
        <ScanButton onPress={() => navigation.navigate('Scan')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  scroll:    { padding: 20, paddingTop: 16, paddingBottom: 24 },
});
