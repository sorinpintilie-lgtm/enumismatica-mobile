import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

const SplashScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/eNumismatica.ro_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>Vânzare și licitații de monede rare</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Încarcă aplicația...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // Dark blue/black gradient
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 250,
    height: 250,
    marginBottom: 30,
    shadowColor: '#e7b73c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '300',
    color: '#e7b73c', // Gold accent color
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(231, 183, 60, 0.6)', // Semi-transparent gold
    letterSpacing: 1,
  },
});

export default SplashScreen;
