import React, { useEffect, useRef } from 'react';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { LanguageProvider } from './utils/LanguageContext';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';

import SplashScreen from './screens/SplashScreen';
import HomeScreen from './screens/HomeScreen';
import WordsScreen from './screens/WordsScreen';
import QuizScreen from './screens/QuizScreen';
import SentencesScreen from './screens/SentencesScreen';
import ScanScreen from './screens/ScanScreen';
import SettingsScreen from './screens/SettingsScreen';
import AddWordScreen from './screens/AddWordScreen';
import AddSentenceScreen from './screens/AddSentenceScreen';
import BottomNavbar from './components/BottomNavbar';
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

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function handleNotificationData(data, navigationRef) {
  if (!data?.type) return;
  navigationRef.current?.navigate('Quiz', { focusItem: data });
}

// Tab navigator extracted so the Stack can reference it as a screen component
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNavbar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"      component={HomeScreen} />
      <Tab.Screen name="Words"     component={WordsScreen} />
      <Tab.Screen name="Quiz"      component={QuizScreen} />
      <Tab.Screen name="Sentences" component={SentencesScreen} />
      <Tab.Screen name="Scan"      component={ScanScreen} />
      <Tab.Screen name="Settings"  component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const navigationRef = useRef(null);

  useEffect(() => {
    (async () => {
      await setupNotificationChannel();

      const settings = await loadNotificationSettings();
      if (settings.enabled) {
        const status = await requestPermissions();
        if (status === 'granted') {
          await scheduleNotifications(settings.frequency);
        }
      }
    })();

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationData(data, navigationRef);
      }
    );

    return () => subscription.remove();
  }, []);

  const handleNavigationReady = async () => {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return;
    const data = response.notification.request.content.data;
    if (!data?.type) return;

    // On cold start the navigator is at 'Splash' — Main hasn't rendered yet
    // so a plain navigate('Quiz') would be silently dropped.
    // Reset the stack to 'Main' first, then navigate into the Quiz tab.
    navigationRef.current?.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] })
    );
    setTimeout(() => {
      navigationRef.current?.navigate('Quiz', { focusItem: data });
    }, 100);
  };

  return (
    <LanguageProvider>
      <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash"      component={SplashScreen} />
          <Stack.Screen name="Main"        component={MainTabs} />
          <Stack.Screen name="AddWord"     component={AddWordScreen} />
          <Stack.Screen name="AddSentence" component={AddSentenceScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </LanguageProvider>
  );
}
