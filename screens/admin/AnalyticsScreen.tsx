import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigationTypes';
import { isAdmin, isSuperAdmin } from '@shared/adminService';
import InlineBackButton from '../../components/InlineBackButton';

type AnalyticsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const BehavioralAnalysisPanel: React.FC = () => (
  <View style={{ padding: 16 }}>
    <Text style={{ color: '#94a3b8', fontSize: 12 }}>
      Panoul de analiză comportamentală va fi disponibil în curând în aplicația mobilă.
    </Text>
  </View>
);

const SessionAnalyticsView: React.FC = () => (
  <View style={{ padding: 16 }}>
    <Text style={{ color: '#94a3b8', fontSize: 12 }}>
      Vizualizarea analitică a sesiunilor va fi disponibilă în curând în aplicația mobilă.
    </Text>
  </View>
);

export default function AnalyticsScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<AnalyticsScreenNavigationProp>();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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

      // Analytics dashboard is restricted to super-admins.
      const superAdminStatus = await isSuperAdmin(user.uid);
      if (!superAdminStatus) {
        navigation.navigate('AdminModerator' as never);
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
        <ActivityIndicator size="large" color="#e7b73c" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <InlineBackButton label="Înapoi la Admin" onPress={() => navigation.navigate('AdminDashboard' as never)} />
          <Text style={styles.title}>Panou Analitic Admin</Text>
          <Text style={styles.subtitle}>Analiză avansată a activității platformei și comportamentului utilizatorilor</Text>
        </View>

        {/* Navigation */}
        <View style={styles.navigation}>
          <Text style={styles.navText}>Admin</Text>
          <Text style={styles.navSeparator}>{'>'}</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Analitice</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'overview' ? styles.tabActive : styles.tabInactive]}
              onPress={() => setActiveTab('overview')}
            >
              <Text style={[styles.tabText, activeTab === 'overview' ? styles.tabTextActive : styles.tabTextInactive]}>
                Prezentare Generală
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'behavioral' ? styles.tabActive : styles.tabInactive]}
              onPress={() => setActiveTab('behavioral')}
            >
              <Text style={[styles.tabText, activeTab === 'behavioral' ? styles.tabTextActive : styles.tabTextInactive]}>
                Analiză Comportamentală
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'sessions' ? styles.tabActive : styles.tabInactive]}
              onPress={() => setActiveTab('sessions')}
            >
              <Text style={[styles.tabText, activeTab === 'sessions' ? styles.tabTextActive : styles.tabTextInactive]}>
                Analiză Sesiuni
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <View style={styles.overviewGrid}>
              {/* User Activity Analytics Link */}
              <View style={styles.analyticsCard}>
                <Text style={styles.analyticsCardTitle}>Analiză Activitate Utilizatori</Text>
                <Text style={styles.analyticsCardSubtitle}>Analiză detaliată a activității individuale a utilizatorilor</Text>
                <TouchableOpacity
                  style={styles.analyticsCardButton}
                  onPress={() => navigation.navigate('AdminAnalytics' as never)}
                 >
                  <Text style={styles.analyticsCardButtonText}>Deschide Analiză Utilizatori</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Stats */}
              <View style={styles.quickStats}>
                <Text style={styles.quickStatsTitle}>Statistici Rapide</Text>
                <View style={styles.quickStatsGrid}>
                  <View style={styles.quickStatItem}>
                    <Text style={[styles.quickStatValue, styles.quickStatValueBlue]}>1,248</Text>
                    <Text style={styles.quickStatLabel}>Utilizatori Activi</Text>
                  </View>
                  <View style={styles.quickStatItem}>
                    <Text style={[styles.quickStatValue, styles.quickStatValueGreen]}>87%</Text>
                    <Text style={styles.quickStatLabel}>Scor Mediu Angajament</Text>
                  </View>
                  <View style={styles.quickStatItem}>
                    <Text style={[styles.quickStatValue, styles.quickStatValuePurple]}>42</Text>
                    <Text style={styles.quickStatLabel}>Sesiuni Active</Text>
                  </View>
                  <View style={styles.quickStatItem}>
                    <Text style={[styles.quickStatValue, styles.quickStatValueRed]}>3</Text>
                    <Text style={styles.quickStatLabel}>Alerte de Securitate</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'behavioral' && (
            <View style={styles.behavioralContainer}>
              <BehavioralAnalysisPanel />
            </View>
          )}

          {activeTab === 'sessions' && (
            <View style={styles.sessionsContainer}>
              <SessionAnalyticsView />
            </View>
          )}
        </View>

         {/* Additional Links */}
         <View style={styles.additionalLinks}>
           <TouchableOpacity style={styles.additionalLink} onPress={() => navigation.navigate('AdminActivityLogs' as never)}>
            <Text style={[styles.additionalLinkText, styles.additionalLinkTextGold]}>Loguri Activitate Complete</Text>
            <Text style={styles.additionalLinkArrow}>{'>'}</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.additionalLink} onPress={() => navigation.navigate('AdminUsers' as never)}>
            <Text style={[styles.additionalLinkText, styles.additionalLinkTextBlue]}>Gestionare Utilizatori</Text>
            <Text style={styles.additionalLinkArrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000940',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  navText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  navTextActive: {
    color: '#e7b73c',
    fontWeight: 'bold',
  },
  navSeparator: {
    color: '#94a3b8',
  },
  tabs: {
    marginBottom: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(231, 183, 60, 0.2)',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#e7b73c',
  },
  tabInactive: {
    borderBottomWidth: 0,
  },
  tabText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: '#e7b73c',
  },
  tabTextInactive: {
    color: '#94a3b8',
  },
  tabContent: {
    gap: 16,
  },
  overviewGrid: {
    gap: 16,
  },
  analyticsCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
    padding: 16,
  },
  analyticsCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  analyticsCardSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
  },
  analyticsCardButton: {
    padding: 12,
    backgroundColor: '#e7b73c',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsCardButtonText: {
    color: '#000940',
    fontWeight: 'bold',
  },
  quickStats: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
    padding: 16,
  },
  quickStatsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  quickStatItem: {
    flex: 1,
    minWidth: '48%',
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  quickStatValueBlue: {
    color: '#60a5fa',
  },
  quickStatValueGreen: {
    color: '#4ade80',
  },
  quickStatValuePurple: {
    color: '#a855f7',
  },
  quickStatValueRed: {
    color: '#f87171',
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  behavioralContainer: {
    flex: 1,
  },
  sessionsContainer: {
    flex: 1,
  },
  additionalLinks: {
    marginTop: 24,
    gap: 8,
  },
  additionalLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
    padding: 16,
  },
  additionalLinkText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  additionalLinkTextGold: {
    color: '#e7b73c',
  },
  additionalLinkTextBlue: {
    color: '#60a5fa',
  },
  additionalLinkArrow: {
    color: '#94a3b8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000940',
  },
});
