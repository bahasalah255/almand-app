import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import {
  FREQUENCIES,
  loadNotificationSettings,
  applyNotificationSettings,
} from '../utils/notifications';

export default function SettingsScreen() {
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [frequency, setFrequency]       = useState('30min');
  const [permDenied, setPermDenied]     = useState(false);
  const [applying, setApplying]         = useState(false);
  const [loading, setLoading]           = useState(true);

  // ─── Load saved settings whenever the tab is focused ─────────────────────

  useFocusEffect(
    useCallback(() => {
      loadNotificationSettings().then((s) => {
        setNotifEnabled(s.enabled);
        setFrequency(s.frequency);
        setLoading(false);
      });
    }, [])
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const applyAndSave = async (newEnabled, newFrequency) => {
    setApplying(true);
    setPermDenied(false);

    const result = await applyNotificationSettings({
      enabled: newEnabled,
      frequency: newFrequency,
    });

    if (result === 'denied') {
      setNotifEnabled(false);
      setPermDenied(true);
    } else if (result === 'scheduled') {
      setNotifEnabled(true);
      setPermDenied(false);
    }

    setApplying(false);
  };

  const handleToggle = async (value) => {
    setNotifEnabled(value);
    await applyAndSave(value, frequency);
  };

  const handleFrequency = async (id) => {
    if (id === frequency) return;
    setFrequency(id);
    if (notifEnabled) {
      await applyAndSave(true, id);
    } else {
      // Just persist the preference even if not yet enabled
      const { saveNotificationSettings } = await import('../utils/notifications');
      await saveNotificationSettings({ enabled: false, frequency: id });
    }
  };

  const openSettings = () => Linking.openSettings();

  // ─── Render ───────────────────────────────────────────────────────────────

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Customize your experience</Text>
        </View>

        {/* ════════════════ NOTIFICATIONS ════════════════ */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.sectionCard}>

          {/* Toggle row */}
          <View style={[styles.row, notifEnabled && styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Daily reminders</Text>
              <Text style={styles.rowHint}>
                {notifEnabled ? 'Notifications are on' : 'Get reminded to practice'}
              </Text>
            </View>
            {applying ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <Switch
                value={notifEnabled}
                onValueChange={handleToggle}
                trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
                thumbColor={notifEnabled ? '#4F46E5' : '#F3F4F6'}
              />
            )}
          </View>

          {/* Frequency selector — only visible when ON */}
          {notifEnabled && (
            <View style={styles.freqWrapper}>
              <Text style={styles.freqLabel}>Frequency</Text>
              <View style={styles.freqRow}>
                {FREQUENCIES.map((f) => {
                  const active = f.id === frequency;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.freqChip, active && styles.freqChipActive]}
                      onPress={() => handleFrequency(f.id)}
                      activeOpacity={0.75}
                      disabled={applying}
                    >
                      <Text
                        style={[
                          styles.freqChipLabel,
                          active && styles.freqChipLabelActive,
                        ]}
                      >
                        {f.label}
                      </Text>
                      <Text
                        style={[
                          styles.freqChipSub,
                          active && styles.freqChipSubActive,
                        ]}
                      >
                        {f.sublabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Permission denied banner */}
        {permDenied && (
          <TouchableOpacity
            style={styles.permBanner}
            onPress={openSettings}
            activeOpacity={0.8}
          >
            <Text style={styles.permBannerIcon}>⚠️</Text>
            <View style={styles.permBannerText}>
              <Text style={styles.permBannerTitle}>Permission denied</Text>
              <Text style={styles.permBannerBody}>
                Tap here to open Settings and allow notifications.
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Notification info box when enabled */}
        {notifEnabled && !permDenied && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Notifications include a random word or sentence from your saved
              lists. They refresh each time you open the app.
            </Text>
          </View>
        )}

        {/* ════════════════ LEARNING ════════════════ */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Learning</Text>
        <View style={styles.sectionCard}>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Daily word goal</Text>
            <Text style={styles.rowValue}>10 words</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Difficulty level</Text>
            <Text style={styles.rowValue}>Beginner (A1)</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>App language</Text>
            <Text style={styles.rowValue}>English</Text>
          </View>
        </View>

        {/* ════════════════ ABOUT ════════════════ */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>About</Text>
        <View style={styles.sectionCard}>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <TouchableOpacity style={[styles.row, styles.rowBorder]} activeOpacity={0.6}>
            <Text style={styles.rowLabel}>Send feedback</Text>
            <Text style={styles.rowLink}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} activeOpacity={0.6}>
            <Text style={styles.rowLabel}>Privacy policy</Text>
            <Text style={styles.rowLink}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: 24,
    paddingTop: 36,
  },

  /* Header */
  header: {
    marginBottom: 28,
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

  /* Section */
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  /* Row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    color: '#1A1A2E',
    fontWeight: '500',
  },
  rowHint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  rowValue: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  rowLink: {
    fontSize: 20,
    color: '#9CA3AF',
  },

  /* Frequency selector */
  freqWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  freqLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 10,
  },
  freqChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  freqChipActive: {
    backgroundColor: '#EEF2FF',
  },
  freqChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  freqChipLabelActive: {
    color: '#4F46E5',
  },
  freqChipSub: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 2,
    textAlign: 'center',
  },
  freqChipSubActive: {
    color: '#A5B4FC',
  },

  /* Permission denied banner */
  permBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  permBannerIcon: {
    fontSize: 22,
  },
  permBannerText: {
    flex: 1,
  },
  permBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  permBannerBody: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 18,
  },

  /* Info box */
  infoBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#6366F1',
    lineHeight: 20,
  },
});
