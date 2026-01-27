import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../styles/sharedStyles';

type Props = {
  isPulledBack?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function PullbackStatusIndicator({ isPulledBack, style }: Props) {
  if (!isPulledBack) return null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.dot} />
      <Text style={styles.text}>Returnat în colecție</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  text: {
    color: '#d1fae5',
    fontSize: 12,
    fontWeight: '600',
  },
});

