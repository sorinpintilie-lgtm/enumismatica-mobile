import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigationTypes';
import { useAuth } from '../../context/AuthContext';
import { User } from '@shared/types';
import { isAdmin, isSuperAdmin, getAllUsers, setUserAsAdmin, removeAdminRole, deleteUser } from '@shared/adminService';

export default function UsersScreen() {
	const { user, loading: authLoading } = useAuth();
	const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isSuperAdminUser, setIsSuperAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

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
      const superStatus = await isSuperAdmin(user.uid);
      setIsSuperAdminUser(superStatus);
      await loadUsers();
      setLoading(false);
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading]);

  const loadUsers = async () => {
    const allUsers = await getAllUsers();
    setUsers(allUsers);
  };

  const handleMakeAdmin = async (userId: string) => {
    if (!isSuperAdminUser) {
      Alert.alert('Doar super-adminul poate crea alți admini.');
      return;
    }

    Alert.alert(
      'Confirmare',
      'Ești sigur că vrei să faci acest utilizator admin?',
      [
        { text: 'Anulează', style: 'cancel' },
        { text: 'Confirmă', onPress: async () => {
          const result = await setUserAsAdmin(userId, true);
          if (result.success) {
            await loadUsers();
          } else {
            Alert.alert('Eroare', result.error || 'A apărut o eroare');
          }
        }}
      ]
    );
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!isSuperAdminUser) {
      Alert.alert('Doar super-adminul poate elimina privilegiile de admin.');
      return;
    }

    Alert.alert(
      'Confirmare',
      'Ești sigur că vrei să elimini privilegiile de admin ale acestui utilizator?',
      [
        { text: 'Anulează', style: 'cancel' },
        { text: 'Confirmă', onPress: async () => {
          const result = await removeAdminRole(userId, true);
          if (result.success) {
            await loadUsers();
          } else {
            Alert.alert('Eroare', result.error || 'A apărut o eroare');
          }
        }}
      ]
    );
  };

  const handleDelete = async (userId: string) => {
    if (!isSuperAdminUser) {
      Alert.alert('Doar super-adminul poate șterge utilizatori.');
      return;
    }

    Alert.alert(
      'Confirmare',
      'Ești sigur că vrei să ștergi acest utilizator? Acest lucru NU va șterge contul lor Firebase Auth.',
      [
        { text: 'Anulează', style: 'cancel' },
        { text: 'Confirmă', onPress: async () => {
          const result = await deleteUser(userId);
          if (result.success) {
            await loadUsers();
          } else {
            Alert.alert('Eroare', result.error || 'A apărut o eroare');
          }
        }}
      ]
    );
  };

  if (authLoading || loading || !isAdminUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>Gestionează utilizatori</Text>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => (navigation as any).navigate('Dashboard')}
				>
					<Text style={styles.backButtonText}>Înapoi la Admin</Text>
				</TouchableOpacity>
      </View>

      {users.length === 0 ? (
        <Text style={styles.noUsersText}>Niciun utilizator găsit.</Text>
      ) : (
				<View style={styles.usersContainer}>
					{users.map((u) => (
						<View key={u.id} style={styles.userCard}>
							<View style={styles.userInfo}>
								<View style={styles.userHeader}>
									<TouchableOpacity
										onPress={() => (navigation as any).navigate('AdminUserDetail', { userId: u.id })}
									>
										<Text style={styles.userName}>{u.displayName}</Text>
									</TouchableOpacity>
                  <View style={styles.badges}>
                    {u.role === 'admin' && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>Admin</Text>
                      </View>
                    )}
                    {u.id === 'QEm0DSIzylNQIHpQAZlgtWQkYYE3' && (
                      <View style={styles.superAdminBadge}>
                        <Text style={styles.superAdminBadgeText}>Super Admin</Text>
                      </View>
                    )}
                    {u.idVerificationStatus === 'verified' && (
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedBadgeText}>Verificat</Text>
                      </View>
                    )}
                  </View>
                </View>
								<View style={styles.userDetails}>
									<Text style={styles.detailText}>Email: {u.email}</Text>
									<Text style={styles.detailText}>ID Utilizator: {u.id}</Text>
									<Text style={styles.detailText}>Creat: {u.createdAt.toLocaleDateString()}</Text>
								</View>
								<TouchableOpacity
									onPress={() => (navigation as any).navigate('AdminUserDetail', { userId: u.id })}
								>
                  <Text style={styles.seeDetails}>Vezi detalii complete →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.actions}>
                {u.id !== 'QEm0DSIzylNQIHpQAZlgtWQkYYE3' && (
                  <>
                    {u.role === 'admin' ? (
                      <TouchableOpacity 
                        style={styles.removeAdminButton}
                        onPress={() => handleRemoveAdmin(u.id)}
                      >
                        <Text style={styles.buttonText}>Elimină Admin</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={styles.makeAdminButton}
                        onPress={() => handleMakeAdmin(u.id)}
                      >
                        <Text style={styles.buttonText}>Fă Admin</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => handleDelete(u.id)}
                    >
                      <Text style={styles.buttonText}>Șterge</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  backButton: {
    backgroundColor: '#4b5563',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  noUsersText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 24,
  },
  usersContainer: {
    gap: 12,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3b82f6',
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  adminBadge: {
    backgroundColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    color: '#9a3412',
    fontSize: 12,
  },
  superAdminBadge: {
    backgroundColor: '#e9d5ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  superAdminBadgeText: {
    color: '#701a75',
    fontSize: 12,
  },
  verifiedBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedBadgeText: {
    color: '#065f46',
    fontSize: 12,
  },
  userDetails: {
    marginTop: 8,
    gap: 4,
  },
  detailText: {
    color: '#6b7280',
    fontSize: 14,
  },
  seeDetails: {
    color: '#3b82f6',
    fontSize: 14,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 12,
  },
  makeAdminButton: {
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  removeAdminButton: {
    backgroundColor: '#ca8a04',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14,
  },
});
