import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';

type Props = {
  label?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

const InlineBackButton: React.FC<Props> = ({ label = 'Înapoi', style, onPress }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const handlePress = onPress ?? (() => navigation.goBack());

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      style={[styles.button, style]}
    >
      <Text style={styles.buttonText}>← {label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});

export default InlineBackButton;
