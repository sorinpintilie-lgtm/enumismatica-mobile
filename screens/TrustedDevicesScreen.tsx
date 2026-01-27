import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';
import { useToast } from '../context/ToastContext';
import { apiGet, apiPost } from '../services/apiClient';
import InlineBackButton from '../components/InlineBackButton';

type TrustedDevice = {
  id: string;
  label: string | null;
  createdAt: string | null;
  expiresAt: string | null;
};

const TrustedDevicesScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<TrustedDevice[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ devices: TrustedDevice[] }>('/api/auth/2fa/trusted-devices/list');
      setDevices(Array.isArray(res.devices) ? res.devices : []);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Eroare', message: err.message || 'Nu s-au putut încărca dispozitivele.' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (deviceId: string) => {
    setLoading(true);
    try {
      await apiPost('/api/auth/2fa/trusted-devices/remove', { deviceId });
      showToast({ type: 'success', title: 'Succes', message: 'Dispozitiv eliminat.' });
      await load();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Eroare', message: err.message || 'Nu s-a putut elimina dispozitivul.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={{ marginBottom: 16 }}>
        <InlineBackButton />
        <Text style={[styles.title, { marginTop: 12 }]}>Dispozitive de încredere</Text>
      </View>

      <TouchableOpacity style={[styles.smallButton, loading && styles.buttonDisabled]} onPress={load} disabled={loading}>
        <Text style={styles.smallButtonText}>{loading ? 'Se încarcă...' : 'Reîncarcă'}</Text>
      </TouchableOpacity>

      <View style={{ gap: 10 }}>
        {devices.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.helpText}>Nu există dispozitive memorate.</Text>
          </View>
        ) : (
          devices.map((d) => (
            <View key={d.id} style={styles.card}>
              <Text style={styles.deviceTitle}>{d.label || 'Dispozitiv'}</Text>
              <Text style={styles.rowText}>ID: {d.id}</Text>
              {d.createdAt ? <Text style={styles.rowText}>Creat: {new Date(d.createdAt).toLocaleString()}</Text> : null}
              {d.expiresAt ? <Text style={styles.rowText}>Expiră: {new Date(d.expiresAt).toLocaleString()}</Text> : null}
              <TouchableOpacity
                style={[styles.dangerButton, loading && styles.buttonDisabled]}
                onPress={() => remove(d.id)}
                disabled={loading}
              >
                <Text style={styles.dangerButtonText}>Elimină</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
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
    gap: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 16,
  },
  helpText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  deviceTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    marginBottom: 6,
  },
  rowText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  smallButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  smallButtonText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  dangerButton: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: colors.error,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: 'white',
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default TrustedDevicesScreen;

