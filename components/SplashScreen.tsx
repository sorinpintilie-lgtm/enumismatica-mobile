import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';

type SplashScreenProps = {
  onFinish?: () => void;
};

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const videoRef = useRef<Video | null>(null);
  const finishedRef = useRef(false);

  const finishSplash = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish?.();
  }, [onFinish]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      finishSplash();
    }, 6000);

    return () => clearTimeout(timeout);
  }, [finishSplash]);

  const handlePlaybackStatus = useCallback(
    async (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        try {
          await videoRef.current?.stopAsync();
        } catch {
          // ignore
        }
        finishSplash();
      }
    },
    [finishSplash]
  );

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={require('../assets/splashvideoani.mov')}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        rate={2.67}
        onPlaybackStatusUpdate={handlePlaybackStatus}
        onError={finishSplash}
      />
      <View style={styles.overlay}>
        <Text style={styles.tagline}>Vânzare și licitații de monede rare</Text>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Încarcă aplicația...</Text>
        </View>
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
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(2, 6, 23, 0.2)',
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
