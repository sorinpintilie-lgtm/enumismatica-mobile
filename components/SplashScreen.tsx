import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

type SplashScreenProps = {
  onFinish?: () => void;
};

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const videoRef = useRef<Video>(null);
  const [videoError, setVideoError] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const handleVideoError = () => {
    console.log('[SplashScreen] Video error, falling back to static image');
    setVideoError(true);
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish && !hasPlayed) {
      console.log('[SplashScreen] Video finished');
      setHasPlayed(true);
      // Notify parent that splash screen is finished
      if (onFinish) {
        onFinish();
      }
    }
  };

  // Stop video after it plays once
  useEffect(() => {
    if (hasPlayed && videoRef.current) {
      videoRef.current?.stopAsync();
    }
  }, [hasPlayed]);

  if (videoError) {
    // Fallback to static image if video fails
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
  }

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={require('../assets/splashvideoani.mov')}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        isMuted
        useNativeControls={false}
        progressUpdateIntervalMillis={1000}
        onError={handleVideoError}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />
      <View style={styles.footer}>
        <Text style={styles.footerText}>Încarcă aplicația...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    backgroundColor: '#000000',
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
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(231, 183, 60, 0.6)',
    letterSpacing: 1,
  },
});

export default SplashScreen;
