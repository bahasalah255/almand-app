import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import * as Notifications from 'expo-notifications';

import HomeScreen from './screens/HomeScreen';
import WordsScreen from './screens/WordsScreen';
import SentencesScreen from './screens/SentencesScreen';
import QuizScreen from './screens/QuizScreen';
import SettingsScreen from './screens/SettingsScreen';
import {
  loadNotificationSettings,
  scheduleNotifications,
  requestPermissions,
  setupNotificationChannel,
} from './utils/notifications';

// Must be at module level — registered before any notification can fire
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();

const ACTIVE_COLOR = '#4F46E5';
const INACTIVE_COLOR = '#9CA3AF';

const TAB_ICONS = {
  Home:      { active: '🏠', inactive: '🏠' },
  Words:     { active: '📖', inactive: '📖' },
  Sentences: { active: '💬', inactive: '💬' },
  Quiz:      { active: '✏️', inactive: '✏️' },
  Settings:  { active: '⚙️', inactive: '⚙️' },
};

function TabIcon({ name, focused }) {
  const icon = TAB_ICONS[name];
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {focused ? icon.active : icon.inactive}
    </Text>
  );
}

// Navigate to Quiz with the item data that arrived in the notification.
// Works for both word and sentence notifications — both carry a `type` field.
function handleNotificationData(data, navigationRef) {
  if (!data?.type) return;
  navigationRef.current?.navigate('Quiz', { focusItem: data });
}

export default function App() {
  const navigationRef = useRef(null);

  useEffect(() => {
    (async () => {
      // Android: create the channel first so the sound setting is registered
      // before any notification is scheduled. Safe to call on every launch —
      // the OS ignores duplicate channel registrations with the same ID.
      await setupNotificationChannel();

      // Reschedule on every launch so content (word/sentence) is fresh
      const settings = await loadNotificationSettings();
      if (settings.enabled) {
        const status = await requestPermissions();
        if (status === 'granted') {
          await scheduleNotifications(settings.frequency);
        }
      }
    })();

    // Foreground / background tap — app was already running
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationData(data, navigationRef);
      }
    );

    return () => subscription.remove();
  }, []);

  // Cold-start tap — app was killed; handle after navigation is ready
  const handleNavigationReady = async () => {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const data = response.notification.request.content.data;
      handleNotificationData(data, navigationRef);
    }
  };

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={route.name} focused={focused} />
          ),
          tabBarActiveTintColor: ACTIVE_COLOR,
          tabBarInactiveTintColor: INACTIVE_COLOR,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#F3F4F6',
            borderTopWidth: 1,
            height: 64,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Words" component={WordsScreen} />
        <Tab.Screen name="Sentences" component={SentencesScreen} />
        <Tab.Screen name="Quiz" component={QuizScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
