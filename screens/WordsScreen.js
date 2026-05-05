import React, { useState, useEffect, useCallback } from 'react';
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
import { ARTICLE_COLORS, FILTER_OPTIONS } from '../constants/articleColors';
import AddWordModal from '../components/AddWordModal';

const STORAGE_KEY = 'words';

export default function WordsScreen() {
  const [words, setWords] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

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

  useFocusEffect(
    useCallback(() => {
      loadWords();
    }, [loadWords])
  );

  const handleWordSaved = (newWord) => {
    setWords((prev) => [newWord, ...prev]);
    setModalVisible(false);
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete word',
      `Remove "${item.word}" from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = words.filter((w) => w.id !== item.id);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              setWords(updated);
            } catch {
              Alert.alert('Error', 'Could not delete the word. Please try again.');
            }
          },
        },
      ]
    );
  };

  const filteredWords = words.filter((w) => {
    const matchesFilter = activeFilter === 'All' || w.article === activeFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      w.word.toLowerCase().includes(q) ||
      w.translation.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.title}>Words</Text>
          <Text style={styles.subtitle}>
            {words.length === 0
              ? 'Start building your vocabulary'
              : `${words.length} word${words.length === 1 ? '' : 's'} saved`}
          </Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search words or translations…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => {
          const isActive = opt === activeFilter;
          const colors = opt !== 'All' ? ARTICLE_COLORS[opt] : null;
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
        <Text style={styles.emptyIcon}>{isSearching ? '🔍' : '📚'}</Text>
        <Text style={styles.emptyTitle}>
          {isSearching ? 'No words found' : 'No words yet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isSearching
            ? 'Try a different search or filter'
            : 'Tap the + button to add your first word'}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const colors = ARTICLE_COLORS[item.article] || ARTICLE_COLORS.der;
    return (
      <View style={styles.wordCard}>
        <View style={[styles.articleBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.articleText, { color: colors.text }]}>
            {item.article}
          </Text>
        </View>

        <View style={styles.wordInfo}>
          <Text style={styles.wordText}>{item.word}</Text>
          <Text style={styles.translationText}>{item.translation}</Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
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
          data={filteredWords}
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

      <AddWordModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={handleWordSaved}
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

  /* Word card */
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  articleBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  articleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  wordInfo: {
    flex: 1,
  },
  wordText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  translationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  deleteButton: {
    padding: 4,
  },
  deleteIcon: {
    fontSize: 18,
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
