import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

type SplashScreenProps = {
  onFinish?: () => void;
};

const SplashScreen: React.FC<SplashScreenProps> = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/eNumismatica.ro_logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.tagline}>Vânzare și licitații de monede rare</Text>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Încarcă aplicația...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
  },
  logo: {
    width: '70%',
    height: 200,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '300',
    color: '#e7b73c',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(231, 183, 60, 0.6)',
    letterSpacing: 1,
  },
});

export default SplashScreen;
