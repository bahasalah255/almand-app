import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATEGORY_COLORS, FILTER_OPTIONS } from '../constants/categoryColors';
import AddSentenceModal from '../components/AddSentenceModal';

const STORAGE_KEY = 'sentences';

export default function SentencesScreen() {
  const [sentences, setSentences] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

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

  useFocusEffect(
    useCallback(() => {
      loadSentences();
    }, [loadSentences])
  );

  const handleSentenceSaved = (newSentence) => {
    setSentences((prev) => [newSentence, ...prev]);
    setModalVisible(false);
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete sentence',
      'Remove this sentence from your list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = sentences.filter((s) => s.id !== item.id);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              setSentences(updated);
            } catch {
              Alert.alert('Error', 'Could not delete the sentence. Please try again.');
            }
          },
        },
      ]
    );
  };

  const filteredSentences = sentences.filter((s) => {
    const matchesFilter = activeFilter === 'All' || s.category === activeFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.sentence.toLowerCase().includes(q) ||
      s.translation.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <Text style={styles.title}>Sentences</Text>
        <Text style={styles.subtitle}>
          {sentences.length === 0
            ? 'Learn German in context'
            : `${sentences.length} sentence${sentences.length === 1 ? '' : 's'} saved`}
        </Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search sentences or translations…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => {
          const isActive = opt === activeFilter;
          const colors = opt !== 'All' ? CATEGORY_COLORS[opt] : null;
          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.filterChip,
                isActive && (colors
                  ? { backgroundColor: colors.bg }
                  : styles.filterChipActiveAll),
              ]}
              onPress={() => setActiveFilter(opt)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && (colors
                    ? { color: colors.text }
                    : styles.filterChipTextAll),
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    const isSearching = search.trim() || activeFilter !== 'All';
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>{isSearching ? '🔍' : '💬'}</Text>
        <Text style={styles.emptyTitle}>
          {isSearching ? 'No sentences found' : 'No sentences yet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isSearching
            ? 'Try a different search or filter'
            : 'Tap + to save your first sentence'}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const colors = item.category ? CATEGORY_COLORS[item.category] : null;
    return (
      <View style={styles.card}>
        {/* Card top row: category badge + delete */}
        <View style={styles.cardTopRow}>
          {colors ? (
            <View style={[styles.categoryBadge, { backgroundColor: colors.bg }]}>
              <Text style={[styles.categoryBadgeText, { color: colors.text }]}>
                {item.category}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Text style={styles.deleteIcon}>🗑</Text>
          </TouchableOpacity>
        </View>

        {/* German sentence */}
        <Text style={styles.germanText}>{item.sentence}</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Translation */}
        <Text style={styles.translationText}>{item.translation}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          data={filteredSentences}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating add button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <AddSentenceModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={handleSentenceSaved}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  /* List header */
  listHeader: {
    paddingTop: 36,
    marginBottom: 8,
  },
  pageHeader: {
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
  },

  /* Search */
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A2E',
    padding: 0,
  },
  clearIcon: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
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

  /* Sentence card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  deleteIcon: {
    fontSize: 17,
  },
  germanText: {
    fontSize: 17,
    fontWeight: '600',
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
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
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
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 30,
    color: '#FFFFFF',
    lineHeight: 34,
    fontWeight: '300',
  },
});
