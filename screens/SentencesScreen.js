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
import { GradientFAB } from '../components/ui';
import { speakGerman, stopSpeech } from '../utils/speech';
import { refreshScheduledNotificationsIfEnabled } from '../utils/notifications';
import { useLanguage } from '../utils/LanguageContext';

const STORAGE_KEY = 'sentences';

export default function SentencesScreen() {
  const navigation = useNavigation();
  const { t, isRTL } = useLanguage();
  const [sentences, setSentences] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);

  const loadSentences = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      setSentences(stored ? JSON.parse(stored) : []);
    } catch {
      setSentences([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback((text) => setSearch(text), []);

  useFocusEffect(useCallback(() => {
    loadSentences();
    return () => { stopSpeech(); setPlayingId(null); };
  }, [loadSentences]));

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

  const handleDelete = (item) => {
    Alert.alert(
      t('sentences.deleteTitle'),
      t('sentences.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = sentences.filter((s) => s.id !== item.id);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              setSentences(updated);
              await refreshScheduledNotificationsIfEnabled();
            } catch {
              Alert.alert(t('common.error'), t('sentences.errorDelete'));
            }
          },
        },
      ]
    );
  };

  const filteredSentences = sentences.filter((s) => {
    const q = search.trim().toLowerCase();
    return !q || s.sentence.toLowerCase().includes(q) || s.translation.toLowerCase().includes(q);
  });

  const renderEmpty = () => {
    if (loading) return null;
    const isSearching = search.trim();
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons
            name={isSearching ? 'search-outline' : 'chatbubbles-outline'}
            size={36}
            color={isSearching ? '#9CA3AF' : '#EC4899'}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isSearching ? t('sentences.noSentencesFound') : t('sentences.noSentencesYet')}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isSearching ? t('sentences.tryDifferent') : t('sentences.tapToSave')}
        </Text>
      </View>
    );
  };

  const sentenceCount = sentences.length;

  const renderItem = ({ item }) => {
    const isPlaying = playingId === item.id;
    return (
      <View style={styles.card}>
        <View style={[styles.cardTopRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <View />
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Ionicons name="trash-outline" size={18} color="#F87171" />
          </TouchableOpacity>
        </View>

        <Text style={styles.germanText}>{item.sentence}</Text>

        <View style={styles.divider} />

        <Text style={styles.translationText}>{item.translation}</Text>

        <View style={[styles.cardActions, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity
            style={[styles.listenBtn, isPlaying && styles.listenBtnActive]}
            onPress={() => handleSpeak(item.id, item.sentence)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
              size={14}
              color={isPlaying ? '#FFFFFF' : '#8B5CF6'}
            />
            <Text style={[styles.listenText, isPlaying && styles.listenTextActive]}>
              {isPlaying ? t('sentences.playing') : t('sentences.listen')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />

      {/* Static header — kept outside FlatList so search TextInput never remounts on re-render */}
      <View style={styles.staticHeader} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={['#EC4899', '#8B5CF6', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={[styles.bannerInnerRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={styles.bannerLeft}>
              <Text style={[styles.bannerEyebrow, isRTL && { textAlign: 'right' }]}>
                {t('sentences.bannerEyebrow')}
              </Text>
              <Text style={[styles.bannerTitle, isRTL && { textAlign: 'right' }]}>
                {t('sentences.title')}
              </Text>
              <Text style={[styles.bannerSubtitle, isRTL && { textAlign: 'right' }]}>
                {sentenceCount > 0
                  ? t('sentences.sentencesSaved', { n: sentenceCount, s: sentenceCount === 1 ? '' : 's' })
                  : t('sentences.learnInContext')}
              </Text>
            </View>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="chatbubbles-outline" size={38} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.searchWrapper, isRTL && { flexDirection: 'row-reverse' }]}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
            placeholder={t('sentences.searchHint')}
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
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
      </View>

      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color="#EC4899" />
        </View>
      ) : (
        <FlatList
          data={filteredSentences}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        />
      )}

      <GradientFAB onPress={() => navigation.navigate('AddSentence')} />
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

  /* Sentence card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  germanText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
    lineHeight: 25,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  translationText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginBottom: 14,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F3FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listenBtnActive: {
    backgroundColor: '#8B5CF6',
  },
  listenText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  listenTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#FDF2F8',
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
