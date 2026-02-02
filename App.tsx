import React, { use } from 'react';
import { View, Text, useColorScheme, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaView
      style={isDarkMode ? styles.darkContainer : styles.lightContainer}
    >
      <View>
        <Text style={isDarkMode ? styles.darkText : styles.lightText}>
          Hello, World!
        </Text>
        <Text style={isDarkMode ? styles.darkText : styles.lightText}>
          Hello, World!
        </Text>
        <Text style={isDarkMode ? styles.darkText : styles.lightText}>
          Hello, World!
        </Text>
        <Text style={isDarkMode ? styles.darkText : styles.lightText}>
          Hello, World!
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  darkContainer: {
    backgroundColor: '#000000',
    flex: 1,
  },
  lightContainer: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  darkText: {
    color: '#FFFFFF',
  },
  lightText: {
    color: '#000000',
  },
});

export default App;
