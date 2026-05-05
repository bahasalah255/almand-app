import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  loadProgress,
  updateStreak,
  xpInCurrentLevel,
  xpForNextLevel,
  XP_PER_LEVEL,
} from '../utils/progress';

export default function HomeScreen() {
  const navigation = useNavigation();

  const [streak, setStreak]     = useState(0);
  const [xp,     setXp]         = useState(0);
  const [level,  setLevel]      = useState(1);

  // Update streak and load progress every time the Home tab is focused
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { streakCount }      = await updateStreak();
        const { xp: savedXP, level: savedLevel } = await loadProgress();
        setStreak(streakCount);
        setXp(savedXP);
        setLevel(savedLevel);
      })();
    }, [])
  );

  const currentLevelXP = xpInCurrentLevel(xp, level);
  const neededXP       = xpForNextLevel();
  const progressPct    = Math.min(currentLevelXP / neededXP, 1);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Guten Morgen 👋</Text>
          <Text style={styles.subtitle}>Ready to learn German today?</Text>
        </View>

        {/* ── Stats row: streak + level ── */}
        <View style={styles.statsRow}>

          {/* Streak card */}
          <View style={[styles.statCard, styles.statCardStreak]}>
            <Text style={styles.statIcon}>🔥</Text>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>
              {streak === 1 ? 'day streak' : 'day streak'}
            </Text>
          </View>

          {/* Level / XP card */}
          <View style={[styles.statCard, styles.statCardLevel]}>
            <View style={styles.levelHeader}>
              <Text style={styles.statIcon}>⭐</Text>
              <Text style={styles.levelBadge}>Lv {level}</Text>
            </View>

            {/* XP bar */}
            <View style={styles.xpBarTrack}>
              <View style={[styles.xpBarFill, { width: `${progressPct * 100}%` }]} />
            </View>

            <Text style={styles.xpLabel}>
              {currentLevelXP} / {neededXP} XP
            </Text>
          </View>
        </View>

        {/* ── Word of the Day ── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Word of the Day</Text>
          <View style={styles.wordRow}>
            <View style={styles.articleBadge}>
              <Text style={styles.articleText}>die</Text>
            </View>
            <Text style={styles.wordText}>Sonne</Text>
          </View>
          <Text style={styles.translation}>the sun</Text>
        </View>

        {/* ── CTA ── */}
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Quiz')}
        >
          <Text style={styles.buttonText}>Start today's quiz</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  scroll: {
    padding: 24,
    paddingTop: 40,
  },

  /* Header */
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },

  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardStreak: {
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
  },
  statCardLevel: {
    backgroundColor: '#FFFFFF',
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1A2E',
    lineHeight: 36,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 2,
  },

  /* Level card internals */
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  levelBadge: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  xpBarTrack: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  xpLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },

  /* Word of the Day card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  articleBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  articleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  wordText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  translation: {
    fontSize: 16,
    color: '#6B7280',
  },

  /* CTA button */
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
