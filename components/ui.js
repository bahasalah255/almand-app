import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Full-width gradient save/action button used in modals
export function GradientButton({ onPress, disabled, label, loadingLabel = 'Saving…' }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <LinearGradient
        colors={disabled ? ['#D1D5DB', '#D1D5DB'] : ['#6366F1', '#8B5CF6', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.button}
      >
        <Text style={s.buttonText}>{disabled ? loadingLabel : label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Circular gradient floating action button — positioned absolute bottom-right
export function GradientFAB({ onPress }) {
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.fabWrap, { bottom: insets.bottom + 88 }]}
    >
      <LinearGradient
        colors={['#A855F7', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.fab}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fabWrap: {
    position: 'absolute',
    right: 24,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
