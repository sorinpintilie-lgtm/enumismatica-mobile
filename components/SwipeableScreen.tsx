import React, { useRef, useEffect, useState } from 'react';
import { View, Dimensions, Animated, StyleSheet } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

interface SwipeableScreenProps {
  children: React.ReactNode;
  currentTabIndex: number;
  totalTabs: number;
  tabNames: string[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3; // 30% of screen width
const SWIPE_VELOCITY_THRESHOLD = 0.3;

const SwipeableScreen: React.FC<SwipeableScreenProps> = ({
  children,
  currentTabIndex,
  totalTabs,
  tabNames,
}) => {
  const navigation = useNavigation<BottomTabNavigationProp<any>>();
  const route = useRoute();
  const translateX = useRef(new Animated.Value(0)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Reset translation when tab changes
  useEffect(() => {
    translateX.setValue(0);
    setIsTransitioning(false);
  }, [route.name]);

  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { 
      useNativeDriver: true,
      listener: (event: any) => {
        // Prevent swiping if already transitioning
        if (isTransitioning) {
          return;
        }
        
        const { translationX: tx } = event.nativeEvent;
        
        // Add resistance at edges
        if ((currentTabIndex === 0 && tx > 0) || 
            (currentTabIndex === totalTabs - 1 && tx < 0)) {
          // Apply resistance
          const resistance = 3;
          translateX.setValue(tx / resistance);
        }
      }
    }
  );

  const handleStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      const { translationX: tx, velocityX } = nativeEvent;
      
      // Determine if we should navigate based on distance or velocity
      const shouldNavigate = 
        Math.abs(tx) > SWIPE_THRESHOLD || 
        Math.abs(velocityX) > SWIPE_VELOCITY_THRESHOLD;

      if (shouldNavigate && !isTransitioning) {
        // Swipe right (positive translationX) = go to previous tab
        if (tx > 0 && currentTabIndex > 0) {
          setIsTransitioning(true);
          // Animate the full swipe
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            navigation.navigate(tabNames[currentTabIndex - 1]);
            setIsTransitioning(false);
          });
        } 
        // Swipe left (negative translationX) = go to next tab
        else if (tx < 0 && currentTabIndex < totalTabs - 1) {
          setIsTransitioning(true);
          // Animate the full swipe
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            navigation.navigate(tabNames[currentTabIndex + 1]);
            setIsTransitioning(false);
          });
        } 
        // Can't navigate further, bounce back
        else {
          Animated.spring(translateX, {
            toValue: 0,
            velocity: velocityX,
            tension: 65,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      } else {
        // Not enough distance/velocity, spring back
        Animated.spring(translateX, {
          toValue: 0,
          velocity: velocityX,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  return (
    <View style={styles.container}>
      <PanGestureHandler
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleStateChange}
        activeOffsetX={[-15, 15]}
        failOffsetY={[-10, 10]}
        enabled={!isTransitioning}
      >
        <Animated.View
          style={[
            styles.contentContainer,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00020d',
  },
  contentContainer: {
    flex: 1,
  },
});

export default SwipeableScreen;
