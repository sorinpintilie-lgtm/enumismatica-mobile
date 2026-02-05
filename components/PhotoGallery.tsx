import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoGalleryProps {
  images: string[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ images }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const insets = useSafeAreaInsets();

  const handleImagePress = (index: number) => {
    setCurrentIndex(index);
    setModalVisible(true);
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const renderThumbnails = () => {
    if (images.length <= 1) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.thumbnailsContainer}
        contentContainerStyle={styles.thumbnailsContent}
      >
        {images.map((image, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.thumbnail,
              currentIndex === index && styles.thumbnailActive,
            ]}
            onPress={() => setCurrentIndex(index)}
            activeOpacity={0.7}
          >
            <ExpoImage
              source={{ uri: image }}
              style={styles.thumbnailImage}
              contentFit="cover"
              transition={150}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Main Image */}
      <TouchableOpacity
        style={styles.mainImageContainer}
        onPress={() => handleImagePress(0)}
        activeOpacity={0.9}
      >
        <ExpoImage
          source={{ uri: images[0] }}
          style={styles.mainImage}
          contentFit="cover"
          transition={200}
        />
        {images.length > 1 && (
          <View style={styles.overlayIndicator}>
            <Ionicons name="images-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
            <Text style={styles.overlayText}>{images.length} imagini</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Thumbnails (only if multiple images) */}
      {images.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbnailsContainer}
          contentContainerStyle={styles.thumbnailsContent}
        >
          {images.map((image, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.thumbnail,
                index === 0 && styles.thumbnailActive,
              ]}
              onPress={() => handleImagePress(index)}
              activeOpacity={0.7}
            >
              <ExpoImage
                source={{ uri: image }}
                style={styles.thumbnailImage}
                contentFit="cover"
                transition={150}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Full Screen Image Viewer */}
      <Modal
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        animationType="fade"
        transparent={true}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[styles.modalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={[styles.modalHeader, { top: insets.top }]}>
              <View style={styles.modalHeaderSpacer} />
              <Text style={styles.modalTitle}>
                {`${currentIndex + 1} / ${images.length}`}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalImageContainer}>
              <ZoomableImage uri={images[currentIndex]} />
            </View>

            {images.length > 1 && (
              <>
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={handlePrev}
                  disabled={currentIndex === 0}
                >
                  <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.navButton, styles.navButtonRight]}
                  onPress={handleNext}
                  disabled={currentIndex === images.length - 1}
                >
                  <Ionicons name="chevron-forward" size={24} color="white" />
                </TouchableOpacity>
              </>
            )}

            <View style={[styles.modalThumbnailsContainer, { bottom: insets.bottom + 20 }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalThumbnailsContent}
              >
                {images.map((image, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.modalThumbnail,
                      currentIndex === index && styles.modalThumbnailActive,
                    ]}
                    onPress={() => setCurrentIndex(index)}
                  >
                    <ExpoImage
                      source={{ uri: image }}
                      style={styles.modalThumbnailImage}
                      contentFit="cover"
                      transition={150}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
};

function ZoomableImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(4, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value === 1) {
        translateX.value = 0;
        translateY.value = 0;
      }
    })
    .enabled(scale.value > 1);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const combined = Gesture.Simultaneous(pinch, pan);

  return (
    <GestureDetector gesture={combined}>
      <Animated.View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, style]}>
        <ExpoImage
          source={{ uri }}
          style={{ 
            width: SCREEN_WIDTH - 40,
            height: SCREEN_HEIGHT - 200
          }}
          contentFit="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 24,
  },
  mainImageContainer: {
    width: '100%',
    height: 256,
    backgroundColor: '#000a1e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  overlayIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  overlayText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  thumbnailsContainer: {
    marginTop: 12,
    marginLeft: 4,
  },
  thumbnailsContent: {
    paddingRight: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 8,
    overflow: 'hidden',
    backgroundColor: '#000a1e',
  },
  thumbnailActive: {
    borderColor: '#e7b73c',
    shadowColor: '#e7b73c',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalHeaderSpacer: {
    width: 40,
    height: 40,
  },
  modalImageContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  zoomView: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT - 200,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  navButton: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonRight: {
    left: undefined,
    right: 20,
  },
  modalThumbnailsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
  },
  modalThumbnailsContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  modalThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    marginHorizontal: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalThumbnailActive: {
    borderColor: '#e7b73c',
    shadowColor: '#e7b73c',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  modalThumbnailImage: {
    width: '100%',
    height: '100%',
  },
});

export default PhotoGallery;
