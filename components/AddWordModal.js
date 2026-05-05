import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ARTICLE_COLORS, ARTICLES } from '../constants/articleColors';

const STORAGE_KEY = 'words';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function AddWordModal({ visible, onClose, onSaved }) {
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [article, setArticle] = useState('der');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setWord('');
    setTranslation('');
    setArticle('der');
    setError('');
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    const trimmedWord = word.trim();
    const trimmedTranslation = translation.trim();

    if (!trimmedWord && !trimmedTranslation) {
      setError('Please fill in the word and translation.');
      return;
    }
    if (!trimmedWord) {
      setError('Please enter a German word.');
      return;
    }
    if (!trimmedTranslation) {
      setError('Please enter a translation.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      const newEntry = {
        id: generateId(),
        word: trimmedWord,
        translation: trimmedTranslation,
        article,
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([newEntry, ...existing]));
      reset();
      onSaved(newEntry);
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.kavWrapper}
          >
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />

                <Text style={styles.title}>Add new word</Text>

                {/* Article selector */}
                <Text style={styles.fieldLabel}>Article</Text>
                <View style={styles.articleRow}>
                  {ARTICLES.map((art) => {
                    const colors = ARTICLE_COLORS[art];
                    const selected = article === art;
                    return (
                      <TouchableOpacity
                        key={art}
                        style={[
                          styles.articleChip,
                          { backgroundColor: selected ? colors.bg : '#F3F4F6' },
                          selected && styles.articleChipSelected,
                        ]}
                        onPress={() => setArticle(art)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.articleChipText,
                            { color: selected ? colors.text : '#9CA3AF' },
                          ]}
                        >
                          {art}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* German word */}
                <Text style={styles.fieldLabel}>German word</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Hund"
                  placeholderTextColor="#D1D5DB"
                  value={word}
                  onChangeText={(t) => { setWord(t); setError(''); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />

                {/* Translation */}
                <Text style={styles.fieldLabel}>Translation</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. the dog"
                  placeholderTextColor="#D1D5DB"
                  value={translation}
                  onChangeText={(t) => { setTranslation(t); setError(''); }}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  activeOpacity={0.8}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Saving…' : 'Save word'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  kavWrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  articleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  articleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  articleChipSelected: {
    borderColor: 'transparent',
  },
  articleChipText: {
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A2E',
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '500',
  },
});
