import React, { useState, useRef } from 'react';
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
import { CATEGORY_COLORS, CATEGORIES } from '../constants/categoryColors';

const STORAGE_KEY = 'sentences';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function AddSentenceModal({ visible, onClose, onSaved }) {
  const [sentence, setSentence] = useState('');
  const [translation, setTranslation] = useState('');
  const [category, setCategory] = useState('Daily');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const translationRef = useRef(null);

  const reset = () => {
    setSentence('');
    setTranslation('');
    setCategory('Daily');
    setError('');
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    const trimmedSentence = sentence.trim();
    const trimmedTranslation = translation.trim();

    if (!trimmedSentence && !trimmedTranslation) {
      setError('Please fill in the sentence and translation.');
      return;
    }
    if (!trimmedSentence) {
      setError('Please enter a German sentence.');
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
        sentence: trimmedSentence,
        translation: trimmedTranslation,
        category,
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

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                >
                  <Text style={styles.title}>Add new sentence</Text>

                  {/* Category selector */}
                  <Text style={styles.fieldLabel}>Category</Text>
                  <View style={styles.categoryGrid}>
                    {CATEGORIES.map((cat) => {
                      const colors = CATEGORY_COLORS[cat];
                      const selected = category === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryChip,
                            { backgroundColor: selected ? colors.bg : '#F3F4F6' },
                          ]}
                          onPress={() => setCategory(cat)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.categoryChipText,
                              { color: selected ? colors.text : '#9CA3AF' },
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* German sentence */}
                  <Text style={styles.fieldLabel}>German sentence</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="e.g. Ich lerne jeden Tag Deutsch."
                    placeholderTextColor="#D1D5DB"
                    value={sentence}
                    onChangeText={(t) => { setSentence(t); setError(''); }}
                    autoCapitalize="sentences"
                    multiline
                    numberOfLines={3}
                    returnKeyType="next"
                    blurOnSubmit
                    onSubmitEditing={() => translationRef.current?.focus()}
                  />

                  {/* Translation */}
                  <Text style={styles.fieldLabel}>Translation</Text>
                  <TextInput
                    ref={translationRef}
                    style={[styles.input, styles.multilineInput]}
                    placeholder="e.g. I learn German every day."
                    placeholderTextColor="#D1D5DB"
                    value={translation}
                    onChangeText={(t) => { setTranslation(t); setError(''); }}
                    autoCapitalize="sentences"
                    multiline
                    numberOfLines={3}
                    returnKeyType="done"
                    blurOnSubmit
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
                      {saving ? 'Saving…' : 'Save sentence'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </ScrollView>
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
    maxHeight: '90%',
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
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  categoryChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  categoryChipText: {
    fontSize: 14,
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
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
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
