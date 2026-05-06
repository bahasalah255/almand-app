import React, { useRef, useEffect } from 'react';
import { Animated, StatusBar } from 'react-native';

export default function SplashScreen({ navigation }) {
  const scale         = useRef(new Animated.Value(0.7)).current;
  const imageOpacity  = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(imageOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1000),
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.replace('Main');
    });
  }, []);

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: '#EEEEFF',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: screenOpacity,
      }}
    >
      <StatusBar hidden />

      <Animated.Image
        source={require('../assets/alamd.jpeg')}
        style={{
          width: 180,
          height: 180,
          borderRadius: 36,
          opacity: imageOpacity,
          transform: [{ scale }],
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 12,
        }}
      />

      <Animated.Image
        source={require('../assets/tab.png')}
        style={{
          marginTop: 20,
          width: 120,
          height: 28,
          resizeMode: 'contain',
          opacity: textOpacity,
        }}
      />
    </Animated.View>
  );
}
