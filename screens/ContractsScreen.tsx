import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';

const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL as string | undefined) || 'https://enumismatica.ro';

export default function ContractsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [transactionId, setTransactionId] = useState('');

  const openWeb = async () => {
    await Linking.openURL(`${SITE_URL}/contracts`);
  };

  const openWebWithHint = async () => {
    // Keep minimal parity: the actual contract download flow is implemented on web.
    await Linking.openURL(`${SITE_URL}/contracts`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Contractele mele</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Descărcare contract</Text>
        <Text style={styles.cardText}>
          Descărcarea contractelor semnate este disponibilă în versiunea web.
        </Text>

        <Text style={styles.label}>ID tranzacție (opțional)</Text>
        <TextInput
          value={transactionId}
          onChangeText={setTransactionId}
          placeholder="ex: abc123..."
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={openWebWithHint}>
          <Text style={styles.primaryBtnText}>Continuă pe web</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.9} onPress={openWeb}>
          <Text style={styles.secondaryBtnText}>Deschide /contracts</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>{`${SITE_URL}/contracts`}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtnText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 16,
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  cardText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: colors.primaryText,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  hint: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 11,
  },
});

