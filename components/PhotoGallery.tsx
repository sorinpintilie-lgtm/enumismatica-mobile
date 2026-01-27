import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
  Text,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoGalleryProps {
  images: string[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ images }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);

  const handleImagePress = (index: number) => {
    setCurrentIndex(index);
    setModalVisible(true);
    // Reset scale when opening modal
    scale.setValue(1);
    lastScale.current = 1;
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      // Reset scale when changing image
      scale.setValue(1);
      lastScale.current = 1;
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      // Reset scale when changing image
      scale.setValue(1);
      lastScale.current = 1;
    }
  };

  const onPinchGestureEvent = useCallback((event: any) => {
    const newScale = lastScale.current * event.nativeEvent.scale;
    scale.setValue(newScale);
  }, [scale]);

  const onPinchHandlerStateChange = useCallback((event: any) => {
    if (event.nativeEvent.state === State.END) {
      lastScale.current = lastScale.current * event.nativeEvent.scale;
    }
  }, []);

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
            <Image
              source={{ uri: image }}
              style={styles.thumbnailImage}
              resizeMode="cover"
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
        <Image
          source={{ uri: images[0] }}
          style={styles.mainImage}
          resizeMode="contain"
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
              <Image
                source={{ uri: image }}
                style={styles.thumbnailImage}
                resizeMode="cover"
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
            <PinchGestureHandler
              onGestureEvent={onPinchGestureEvent}
              onHandlerStateChange={onPinchHandlerStateChange}
            >
              <Animated.View style={{ transform: [{ scale }] }}>
                <ExpoImage
                  source={{ uri: images[currentIndex] }}
                  style={styles.modalImage}
                  contentFit="contain"
                  transition={200}
                />
              </Animated.View>
            </PinchGestureHandler>
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
                  <Image
                    source={{ uri: image }}
                    style={styles.modalThumbnailImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

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
  },
  zoomContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SCREEN_HEIGHT,
  },
  modalImage: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT - 200,
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