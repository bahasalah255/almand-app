import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ARTICLE_COLORS, FILTER_OPTIONS } from '../constants/articleColors';
import { GradientFAB } from '../components/ui';
import { speakGerman, stopSpeech } from '../utils/speech';
import { refreshScheduledNotificationsIfEnabled } from '../utils/notifications';
import { useLanguage } from '../utils/LanguageContext';

const STORAGE_KEY = 'words';

const ARTICLE_ICONS = {
  der:    'cube-outline',
  die:    'flower-outline',
  das:    'shapes-outline',
  plural: 'layers-outline',
};

function getWordIcon(article) {
  return ARTICLE_ICONS[article] || 'cube-outline';
}

export default function WordsScreen() {
  const navigation = useNavigation();
  const { t, isRTL } = useLanguage();
  const [words, setWords] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);

  const loadWords = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      setWords(stored ? JSON.parse(stored) : []);
    } catch {
      setWords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback((text) => setSearch(text), []);

  useFocusEffect(useCallback(() => {
    loadWords();
    return () => { stopSpeech(); setPlayingId(null); };
  }, [loadWords]));

  const handleDelete = (item) => {
    Alert.alert(
      t('words.deleteTitle'),
      t('words.deleteMsg', { word: item.word }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = words.filter((w) => w.id !== item.id);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              setWords(updated);
              await refreshScheduledNotificationsIfEnabled();
            } catch {
              Alert.alert(t('common.error'), t('words.errorDelete'));
            }
          },
        },
      ]
    );
  };

  const handleSpeak = (id, text) => {
    if (playingId === id) {
      stopSpeech();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    speakGerman(text, {
      onDone: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  const filteredWords = words.filter((w) => {
    const matchesFilter = activeFilter === 'All' || w.article === activeFilter;
    const q = search.trim().toLowerCase();
    return matchesFilter && (!q || w.word.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q));
  });

  const renderEmpty = () => {
    if (loading) return null;
    const isSearching = search.trim() || activeFilter !== 'All';
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons
            name={isSearching ? 'search-outline' : 'library-outline'}
            size={36}
            color={isSearching ? '#9CA3AF' : '#6366F1'}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isSearching ? t('words.noWordsFound') : t('words.noWordsYet')}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isSearching ? t('words.tryDifferent') : t('words.tapToAdd')}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const colors    = ARTICLE_COLORS[item.article] || ARTICLE_COLORS.der;
    const isPlaying = playingId === item.id;
    return (
      <View style={[styles.wordCard, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={[styles.wordIconCircle, { backgroundColor: colors.bg }]}>
          <Ionicons name={getWordIcon(item.article)} size={20} color={colors.text} />
        </View>

        <View style={styles.wordInfo}>
          <View style={[styles.wordNameRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.articlePill, { backgroundColor: colors.bg }]}>
              <Text style={[styles.articlePillText, { color: colors.text }]}>{item.article}</Text>
            </View>
            <Text style={styles.wordText}>{item.word}</Text>
          </View>
          <Text style={[styles.translationText, isRTL && { textAlign: 'right' }]}>{item.translation}</Text>
        </View>

        <View style={[styles.cardActions, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity
            style={[styles.listenIconBtn, isPlaying && styles.listenIconBtnActive]}
            onPress={() => handleSpeak(item.id, `${item.article} ${item.word}`)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Ionicons
              name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
              size={20}
              color={isPlaying ? '#FFFFFF' : '#8B5CF6'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Ionicons name="trash-outline" size={18} color="#F87171" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const wordCount = words.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />

      {/* Static header — kept outside FlatList so search TextInput never remounts on re-render */}
      <View style={styles.staticHeader} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={[styles.bannerInnerRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={styles.bannerLeft}>
              <Text style={[styles.bannerEyebrow, isRTL && { textAlign: 'right' }]}>
                {t('words.bannerEyebrow')}
              </Text>
              <Text style={[styles.bannerTitle, isRTL && { textAlign: 'right' }]}>
                {t('words.title')}
              </Text>
              <Text style={[styles.bannerSubtitle, isRTL && { textAlign: 'right' }]}>
                {wordCount > 0
                  ? t('words.wordsSaved', { n: wordCount, s: wordCount === 1 ? '' : 's' })
                  : t('words.buildVocab')}
              </Text>
            </View>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="library-outline" size={38} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.searchWrapper, isRTL && { flexDirection: 'row-reverse' }]}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
            placeholder={t('words.searchHint')}
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            onSubmitEditing={() => {}}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#D1D5DB" />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.filterRow, isRTL && { flexDirection: 'row-reverse' }]}>
          {FILTER_OPTIONS.map((opt) => {
            const isActive = opt === activeFilter;
            const colors = opt !== 'All' ? ARTICLE_COLORS[opt] : null;
            const chipLabel = opt === 'All' ? t('common.all') : opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.filterChip,
                  isActive && (colors ? { backgroundColor: colors.bg } : styles.filterChipActiveAll),
                ]}
                onPress={() => setActiveFilter(opt)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && (colors ? { color: colors.text } : styles.filterChipTextAll),
                  ]}
                >
                  {chipLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={filteredWords}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        />
      )}

      <GradientFAB onPress={() => navigation.navigate('AddWord')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },

  /* Static header above the list */
  staticHeader: {
    paddingTop: 20,
    paddingHorizontal: 20,
    marginBottom: 4,
  },

  /* Banner */
  banner: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  bannerInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flex: 1,
  },
  bannerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
  },
  bannerIconWrap: {
    marginLeft: 12,
    opacity: 0.9,
  },

  /* Search */
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A2E',
    padding: 0,
  },

  /* Filters */
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterChipActiveAll: {
    backgroundColor: '#EEF2FF',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  filterChipTextAll: {
    color: '#4F46E5',
  },

  /* Word card */
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  wordIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  wordInfo: {
    flex: 1,
  },
  wordNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  articlePill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  articlePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  wordText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  translationText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listenIconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  listenIconBtnActive: {
    backgroundColor: '#8B5CF6',
  },
  iconBtn: {
    padding: 4,
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 21,
  },
});
