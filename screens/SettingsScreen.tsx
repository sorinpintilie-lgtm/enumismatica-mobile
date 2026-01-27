import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../context/AuthContext';
import { colors } from '../styles/sharedStyles';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  type SettingsRoute =
    | 'ChangePassword'
    | 'ChangeEmail'
    | 'TwoFA'
    | 'Sessions'
    | 'TrustedDevices'
    | 'AccountActions'
    | 'Pronumismatica'
    | 'MonetariaStatului'
    | 'Contracts';

  const securityRows: Array<{
    title: string;
    subtitle?: string;
    route: SettingsRoute;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { title: 'Schimbă parola', subtitle: 'Actualizează parola contului', route: 'ChangePassword', icon: 'key-outline' },
    { title: 'Schimbă emailul', subtitle: 'Actualizează adresa de email', route: 'ChangeEmail', icon: 'mail-outline' },
    { title: 'Autentificare în doi pași (2FA)', subtitle: 'Configurează / dezactivează 2FA', route: 'TwoFA', icon: 'shield-checkmark-outline' },
    { title: 'Sesiuni', subtitle: 'Vezi și revocă sesiuni active', route: 'Sessions', icon: 'time-outline' },
    { title: 'Dispozitive de încredere', subtitle: 'Gestionează dispozitivele memorate', route: 'TrustedDevices', icon: 'phone-portrait-outline' },
    { title: 'Acțiuni cont', subtitle: 'Dezactivează sau șterge contul', route: 'AccountActions', icon: 'warning-outline' },
  ];

  const infoRows: Array<{
    title: string;
    subtitle?: string;
    route: SettingsRoute;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { title: 'Contractele mele', subtitle: 'Descarcă contracte semnate (via web)', route: 'Contracts', icon: 'document-text-outline' },
    { title: 'Asociația Pronumismatica', subtitle: 'Formular & informații (via web)', route: 'Pronumismatica', icon: 'people-outline' },
    { title: 'Monetăria Statului', subtitle: 'Catalog (via web)', route: 'MonetariaStatului', icon: 'business-outline' },
  ];

  const Row = ({
    title,
    subtitle,
    icon,
    onPress,
    isLast,
  }: {
    title: string;
    subtitle?: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    isLast?: boolean;
  }) => {
    return (
      <TouchableOpacity style={[styles.row, isLast && styles.rowLast]} activeOpacity={0.9} onPress={onPress}>
        <View style={styles.rowIconWrap}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Setări & Securitate</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.accountCard}>
        <View style={styles.accountAvatar}>
          <Text style={styles.accountAvatarText}>{(user?.email?.[0] || 'U').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.accountTitle}>Cont</Text>
          <Text style={styles.accountSubtitle} numberOfLines={1}>
            {user?.email || '—'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Securitate</Text>
        <View style={styles.group}>
          {securityRows.map((row, idx) => (
            <Row
              key={row.route}
              title={row.title}
              subtitle={row.subtitle}
              icon={row.icon}
              onPress={() => navigation.navigate(row.route)}
              isLast={idx === securityRows.length - 1}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informații & Legal</Text>
        <Text style={styles.sectionHint}>Acces rapid la secțiuni disponibile pe web</Text>
        <View style={styles.group}>
          {infoRows.map((row, idx) => (
            <Row
              key={row.route}
              title={row.title}
              subtitle={row.subtitle}
              icon={row.icon}
              onPress={() => navigation.navigate(row.route)}
              isLast={idx === infoRows.length - 1}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 18,
    fontWeight: '800',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.25)',
    backgroundColor: 'rgba(0, 2, 13, 0.8)',
    padding: 16,
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 16,
  },
  accountTitle: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  accountSubtitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  sectionHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 4,
    marginTop: -4,
  },
  group: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(231, 183, 60, 0.18)',
    gap: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  rowSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 12,
  },
});

export default SettingsScreen;

