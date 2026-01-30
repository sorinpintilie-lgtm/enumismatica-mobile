import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { preloadAppData, AppDataLoadProgress } from '../shared/appDataLoader';

type SplashScreenProps = {
  onFinish?: () => void;
};

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const videoRef = useRef<Video>(null);
  const [videoError, setVideoError] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState<AppDataLoadProgress | null>(null);
  const { user } = useAuth();

  const handleVideoError = () => {
    console.log('[SplashScreen] Video error, falling back to static image');
    setVideoError(true);
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && !videoReady) {
      setVideoReady(true);
    }
    if (status.isLoaded && status.didJustFinish && !hasPlayed) {
      console.log('[SplashScreen] Video finished');
      setHasPlayed(true);
      // Start loading app data after video finishes
      loadAppData();
    }
  };

  const loadAppData = async () => {
    console.log('[SplashScreen] Starting app data preload');
    await preloadAppData(
      user?.uid || null,
      (progress) => {
        setLoadProgress(progress);
        console.log(`[SplashScreen] Loading progress: ${progress.progress}% - ${progress.step}`);
      }
    );
    console.log('[SplashScreen] App data preload complete');
    if (onFinish) {
      onFinish();
    }
  };

  useEffect(() => {
    if (hasPlayed && videoRef.current) {
      videoRef.current?.stopAsync();
    }
  }, [hasPlayed]);

  // Load app data immediately when splash screen mounts
  useEffect(() => {
    console.log('[SplashScreen] Starting app data preload on mount');
    loadAppData();
  }, []);

  useEffect(() => {
    if (videoError) {
      // If video error, load data immediately after short delay
      const timer = setTimeout(() => {
        loadAppData();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [videoError]);

  if (videoError) {
    return (
      <View style={styles.container}>
        <Image
          source={require('../assets/eNumismatica_trapezoid_no_black_margins.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>Vânzarea și licitațiile de monede rare</Text>
        <View style={styles.footer}>
          <ActivityIndicator size="large" color="#e7b73c" />
          <Text style={styles.footerText}>
            {loadProgress ? loadProgress.step : 'Se încarcă aplicația...'}
          </Text>
          {loadProgress && (
            <Text style={styles.progressText}>{loadProgress.progress}%</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={require('../assets/videosplash.mp4')}
        style={[styles.video, !videoReady && { opacity: 0 }]}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
        isMuted
        useNativeControls={false}
        progressUpdateIntervalMillis={250}
        onError={handleVideoError}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />

      {!videoReady && (
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color="#e7b73c" />
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.topTagline}>Magazin • Licitații • Colecții</Text>
        <ActivityIndicator size="large" color="#e7b73c" />
        <Text style={styles.footerText}>
          {loadProgress ? loadProgress.step : 'Se încarcă experiența numismatică...'}
        </Text>
        {loadProgress && (
          <Text style={styles.progressText}>{loadProgress.progress}%</Text>
        )}
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
  topContent: {
    position: 'absolute',
    top: 60,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  topTagline: {
    fontSize: 12,
    color: 'rgba(231, 183, 60, 0.75)',
    letterSpacing: 2,
    textTransform: 'uppercase',
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
    gap: 10,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(231, 183, 60, 0.7)',
    letterSpacing: 0.5,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(231, 183, 60, 0.9)',
    marginTop: 4,
    fontWeight: '600',
  },
});

export default SplashScreen;
