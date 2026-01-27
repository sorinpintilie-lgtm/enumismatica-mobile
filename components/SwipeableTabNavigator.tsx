import React, { useRef } from 'react';
import { Animated, Dimensions } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

interface SwipeableTabNavigatorProps extends BottomTabBarProps {
  children: React.ReactNode;
}

export const SwipeableTabNavigator: React.FC<SwipeableTabNavigatorProps> = ({
  state,
  navigation,
  children,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentIndex = state.index;
  const totalTabs = state.routes.length;

  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const handleStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      const { translationX: tx, velocityX } = nativeEvent;
      
      const shouldNavigate = 
        Math.abs(tx) > SWIPE_THRESHOLD || 
        Math.abs(velocityX) > SWIPE_VELOCITY_THRESHOLD;

      if (shouldNavigate) {
        // Swipe right = go to previous tab
        if (tx > 0 && currentIndex > 0) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            navigation.navigate(state.routes[currentIndex - 1].name);
          });
        } 
        // Swipe left = go to next tab
        else if (tx < 0 && currentIndex < totalTabs - 1) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            navigation.navigate(state.routes[currentIndex + 1].name);
          });
        } 
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
    <PanGestureHandler
      onGestureEvent={handleGestureEvent}
      onHandlerStateChange={handleStateChange}
      activeOffsetX={[-15, 15]}
      failOffsetY={[-10, 10]}
    >
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX }],
        }}
      >
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
};
