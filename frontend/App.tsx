// App.tsx — SplitAI Entry Point
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store';
import { initSocket, disconnectSocket } from './src/services/socket';
import { Colors } from './src/theme';

const navigationTheme = {
  dark: true,
  colors: {
    primary: Colors.white,
    background: Colors.black,
    card: Colors.gray100,
    text: Colors.white,
    border: Colors.gray300,
    notification: Colors.white,
  },
};

export default function App() {
  const { loadStoredAuth, isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      initSocket().catch(console.error);
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, token]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.black },
});
