import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigationTypes';
import { isAdmin } from '@shared/adminService';
import InlineBackButton from '../../components/InlineBackButton';

type ModeratorScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function ModeratorScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<ModeratorScreenNavigationProp>();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigation.navigate('Login' as never);
        return;
      }

      const adminStatus = await isAdmin(user.uid);
      if (!adminStatus) {
        navigation.navigate('Dashboard' as never);
        return;
      }

      setIsAdminUser(true);
      setLoading(false);
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading, navigation]);

  if (authLoading || loading || !isAdminUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <InlineBackButton label="Înapoi la Admin" onPress={() => navigation.navigate('Dashboard' as never)} />
          <Text style={styles.title}>Panou Admin (Simplificat)</Text>
          <Text style={styles.description}>
            Acesta este panoul pentru administratorii obișnuiți. Poți aproba și gestiona piese și
            licitații, dar nu ai acces la gestionarea utilizatorilor, loguri complete sau analitice
            avansate.
          </Text>
        </View>

        {/* Main Actions */}
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.card}
            // Mobile admin products screen is not implemented; route to catalog as a safe fallback.
            onPress={() => navigation.navigate('ProductCatalog' as never)}
          >
            <Text style={styles.cardTitle}>Piese</Text>
            <Text style={styles.cardDescription}>
              Vezi și aprobă piesele trimise de utilizatori pentru vânzare directă.
            </Text>
            <Text style={styles.cardLink}>Mergi la gestionare piese →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('AdminAuctions' as never)}
          >
            <Text style={styles.cardTitle}>Licitații</Text>
            <Text style={styles.cardDescription}>
              Vezi, aprobă și gestionează licitațiile active și cele în așteptare.
            </Text>
            <Text style={styles.cardLink}>Mergi la gestionare licitații →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('AdminUsers' as never)}
          >
            <Text style={styles.cardTitle}>Utilizatori</Text>
            <Text style={styles.cardDescription}>
              Vezi și gestionează conturile utilizatorilor (roluri de admin / utilizator, ștergere cont).
            </Text>
            <Text style={styles.cardLink}>Mergi la gestionare utilizatori →</Text>
          </TouchableOpacity>
        </View>

        {/* Info box for permissions */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Permisiuni limitate</Text>
          <Text style={styles.infoText}>Ca admin, poți:</Text>
          <Text style={styles.infoListItem}>• Aproba / respinge piese trimise de utilizatori.</Text>
          <Text style={styles.infoListItem}>• Aproba / respinge licitații și încheia licitații dacă este necesar.</Text>
          <Text style={styles.infoListItem}>• Modifica detalii pentru piese și licitații existente.</Text>
          <Text style={styles.infoNote}>
            Gestionarea utilizatorilor, logurile detaliate de activitate și panoul complet de analitice
            sunt rezervate super-adminului.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  content: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  card: {
    width: '48%',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 12,
    lineHeight: 20,
  },
  cardLink: {
    fontSize: 14,
    color: '#d4af37',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderRadius: 16,
    padding: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  infoListItem: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 4,
    lineHeight: 20,
  },
  infoNote: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 12,
    lineHeight: 18,
  },
});
