import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../context/AuthContext';
import { colors } from '../styles/sharedStyles';
import { Ionicons } from '@expo/vector-icons';
import InlineBackButton from '../components/InlineBackButton';
import type { UserNotificationPreferences } from '@shared/types';
import {
  defaultNotificationPreferences,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '@shared/notificationPreferencesService';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [notificationPreferences, setNotificationPreferences] = useState<UserNotificationPreferences>(
    defaultNotificationPreferences,
  );
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [savingKeys, setSavingKeys] = useState<Record<keyof UserNotificationPreferences, boolean>>({
    pushEnabled: false,
    auctionOutbid: false,
    auctionWon: false,
    auctionEndedNoWin: false,
    watchlistUpdates: false,
    offerUpdates: false,
    orderUpdates: false,
    messageUpdates: false,
    systemUpdates: false,
    marketingUpdates: false,
  });

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

  const notificationSections = useMemo(
    () => [
      {
        title: 'Licitații',
        description: 'Notificări despre activitatea licitațiilor urmărite sau la care licitezi',
        items: [
          {
            key: 'auctionOutbid' as const,
            label: 'Ai fost depășit',
            subtitle: 'Când altcineva licitează peste tine',
          },
          {
            key: 'auctionWon' as const,
            label: 'Licitație câștigată',
            subtitle: 'Când câștigi o licitație',
          },
          {
            key: 'auctionEndedNoWin' as const,
            label: 'Licitație încheiată',
            subtitle: 'Când licitația se termină fără să câștigi',
          },
        ],
      },
      {
        title: 'Watchlist & Oferte',
        description: 'Actualizări despre elementele urmărite și oferte',
        items: [
          {
            key: 'watchlistUpdates' as const,
            label: 'Watchlist',
            subtitle: 'Modificări la elementele din watchlist',
          },
          {
            key: 'offerUpdates' as const,
            label: 'Oferte',
            subtitle: 'Răspunsuri la ofertele tale sau primite',
          },
        ],
      },
      {
        title: 'Comenzi & Mesaje',
        description: 'Starea comenzilor și conversațiilor',
        items: [
          {
            key: 'orderUpdates' as const,
            label: 'Comenzi',
            subtitle: 'Confirmări și actualizări de livrare',
          },
          {
            key: 'messageUpdates' as const,
            label: 'Mesaje',
            subtitle: 'Mesaje noi și activitate în conversații',
          },
        ],
      },
      {
        title: 'Platformă',
        description: 'Actualizări importante și comunicări',
        items: [
          {
            key: 'systemUpdates' as const,
            label: 'Sistem',
            subtitle: 'Actualizări critice și securitate',
          },
          {
            key: 'marketingUpdates' as const,
            label: 'Marketing',
            subtitle: 'Noutăți, promoții și recomandări',
          },
        ],
      },
    ],
    [],
  );

  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.uid) return;
      setLoadingPreferences(true);
      try {
        const prefs = await getUserNotificationPreferences(user.uid);
        setNotificationPreferences(prefs);
      } catch (error) {
        console.error('[SettingsScreen] Failed to load notification preferences', error);
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadPreferences();
  }, [user?.uid]);

  const updatePreference = async (key: keyof UserNotificationPreferences, value: boolean) => {
    if (!user?.uid) return;
    setSavingKeys((prev) => ({ ...prev, [key]: true }));
    setNotificationPreferences((prev) => ({ ...prev, [key]: value }));
    try {
      const updated = await updateUserNotificationPreferences(user.uid, { [key]: value });
      setNotificationPreferences(updated);
    } catch (error) {
      console.error('[SettingsScreen] Failed to update notification preference', error);
      setNotificationPreferences((prev) => ({ ...prev, [key]: !value }));
    } finally {
      setSavingKeys((prev) => ({ ...prev, [key]: false }));
    }
  };

  const updateAllPreferences = async (value: boolean) => {
    if (!user?.uid) return;
    const updates: Partial<UserNotificationPreferences> = {
      pushEnabled: value,
      auctionOutbid: value,
      auctionWon: value,
      auctionEndedNoWin: value,
      watchlistUpdates: value,
      offerUpdates: value,
      orderUpdates: value,
      messageUpdates: value,
      systemUpdates: value,
      marketingUpdates: value,
    };

    setSavingKeys((prev) => {
      const next = { ...prev };
      (Object.keys(updates) as Array<keyof UserNotificationPreferences>).forEach((k) => {
        next[k] = true;
      });
      return next;
    });

    setNotificationPreferences((prev) => ({ ...prev, ...updates }));
    try {
      const updated = await updateUserNotificationPreferences(user.uid, updates);
      setNotificationPreferences(updated);
    } catch (error) {
      console.error('[SettingsScreen] Failed to update notification preferences', error);
    } finally {
      setSavingKeys((prev) => {
        const next = { ...prev };
        (Object.keys(updates) as Array<keyof UserNotificationPreferences>).forEach((k) => {
          next[k] = false;
        });
        return next;
      });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={{ marginBottom: 16 }}>
        <InlineBackButton />
        <Text style={[styles.title, { marginTop: 12 }]}>Setări & Securitate</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificări</Text>
        <Text style={styles.sectionHint}>Personalizează ce alerte primești</Text>
        <View style={styles.group}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={styles.toggleTitle}>Activează notificările</Text>
              <Text style={styles.toggleSubtitle}>Controlează rapid toate notificările</Text>
            </View>
            <Switch
              value={notificationPreferences.pushEnabled}
              onValueChange={(value) => updateAllPreferences(value)}
              disabled={loadingPreferences}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(231, 183, 60, 0.4)' }}
              thumbColor={notificationPreferences.pushEnabled ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        {notificationSections.map((section) => (
          <View key={section.title} style={styles.notificationBlock}>
            <Text style={styles.notificationBlockTitle}>{section.title}</Text>
            <Text style={styles.notificationBlockHint}>{section.description}</Text>
            <View style={styles.group}>
              {section.items.map((item, index) => {
                const disabled = loadingPreferences || !notificationPreferences.pushEnabled || savingKeys[item.key];
                return (
                  <View
                    key={item.key}
                    style={[styles.toggleRow, index === section.items.length - 1 && styles.rowLast]}
                  >
                    <View style={styles.toggleContent}>
                      <Text style={styles.toggleTitle}>{item.label}</Text>
                      <Text style={styles.toggleSubtitle}>{item.subtitle}</Text>
                    </View>
                    <Switch
                      value={notificationPreferences[item.key]}
                      onValueChange={(value) => updatePreference(item.key, value)}
                      disabled={disabled}
                      trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(231, 183, 60, 0.4)' }}
                      thumbColor={notificationPreferences[item.key] ? colors.primary : colors.textSecondary}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ))}
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(231, 183, 60, 0.18)',
    gap: 12,
  },
  toggleContent: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  notificationBlock: {
    marginTop: 12,
    gap: 6,
  },
  notificationBlockTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 4,
  },
  notificationBlockHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 4,
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

