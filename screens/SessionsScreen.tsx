import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../styles/sharedStyles';
import { useToast } from '../context/ToastContext';
import { apiGet, apiPost } from '../services/apiClient';
import InlineBackButton from '../components/InlineBackButton';

type Session = {
  id: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
  revokedAt: string | null;
};

const SessionsScreen: React.FC = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ sessions: Session[] }>('/api/auth/sessions/list');
      setSessions(Array.isArray(res.sessions) ? res.sessions : []);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Eroare', message: err.message || 'Nu s-au putut încărca sesiunile.' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const revokeOthers = async () => {
    setLoading(true);
    try {
      const currentSessionId = await AsyncStorage.getItem('enumismatica_current_session_id');
      const body = currentSessionId ? { currentSessionId } : {};
      const res = await apiPost<{ revokedCount: number }>('/api/auth/sessions/revoke-others', body);
      showToast({
        type: 'success',
        title: 'Succes',
        message: `Sesiuni revocate: ${res?.revokedCount ?? 0}`,
      });
      await load();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Eroare', message: err.message || 'Nu s-au putut revoca sesiunile.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={{ marginBottom: 16 }}>
        <InlineBackButton />
        <Text style={[styles.title, { marginTop: 12 }]}>Sesiuni</Text>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.smallButton, loading && styles.buttonDisabled]} onPress={load} disabled={loading}>
          <Text style={styles.smallButtonText}>{loading ? '...' : 'Reîncarcă'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dangerButton, loading && styles.buttonDisabled]} onPress={revokeOthers} disabled={loading}>
          <Text style={styles.dangerButtonText}>Revocă alte sesiuni</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.helpText}>
          Lista include până la 50 de sesiuni. Revocarea poate forța reautentificarea pe alte dispozitive.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {sessions.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.helpText}>Nu există sesiuni de afișat.</Text>
          </View>
        ) : (
          sessions.map((s) => (
            <View key={s.id} style={styles.card}>
              <Text style={styles.sessionTitle}>{s.deviceLabel || 'Sesiune'}</Text>
              <Text style={styles.rowText}>ID: {s.id}</Text>
              {s.ipAddress ? <Text style={styles.rowText}>IP: {s.ipAddress}</Text> : null}
              {s.createdAt ? <Text style={styles.rowText}>Creat: {new Date(s.createdAt).toLocaleString()}</Text> : null}
              {s.lastSeenAt ? <Text style={styles.rowText}>Ultima activitate: {new Date(s.lastSeenAt).toLocaleString()}</Text> : null}
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
    fontSize: 18,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
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
  sessionTitle: {
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
    flex: 1,
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
    flex: 2,
    borderRadius: 12,
    backgroundColor: colors.error,
    paddingVertical: 12,
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

export default SessionsScreen;

