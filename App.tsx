import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';
import SplashScreen from './components/SplashScreen';
import Header from './components/Header';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';
import ToastProvider from './context/ToastContext';
import type { RootStackParamList } from './navigationTypes';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Import all screens
import DashboardScreen from './screens/DashboardScreen';
import ProductCatalogScreen from './screens/ProductCatalogScreen';
import AuctionListScreen from './screens/AuctionListScreen';
import CartScreen from './screens/CartScreen';
import WatchlistScreen from './screens/WatchlistScreen';
import HelpCenterScreen from './screens/HelpCenterScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ProductDetailsScreen from './screens/ProductDetailsScreen';
import AuctionDetailsScreen from './screens/AuctionDetailsScreen';
import BidHistoryScreen from './screens/BidHistoryScreen';
import HelpArticleScreen from './screens/HelpArticleScreen';
import OrderHistoryScreen from './screens/OrderHistoryScreen';
import OrderDetailsScreen from './screens/OrderDetailsScreen';
import SalesHistoryScreen from './screens/SalesHistoryScreen';
import NewListingScreen from './screens/NewListingScreen';
import AboutScreen from './screens/AboutScreen';
import ContactScreen from './screens/ContactScreen';
import PronumismaticaScreen from './screens/PronumismaticaScreen';
import MonetariaStatuluiScreen from './screens/MonetariaStatuluiScreen';
import MonetariaStatuluiProductDetailsScreen from './screens/MonetariaStatuluiProductDetailsScreen';
import ContractsScreen from './screens/ContractsScreen';
import EventScreen from './screens/EventScreen';
import BookmarksScreen from './screens/BookmarksScreen';
import CheckoutScreen from './screens/CheckoutScreen';
import SellerProfileScreen from './screens/SellerProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import MessagesScreen from './screens/MessagesScreen';
// Settings & Security
import SettingsScreen from './screens/SettingsScreen';
import ChangePasswordScreen from './screens/ChangePasswordScreen';
import ChangeEmailScreen from './screens/ChangeEmailScreen';
import TwoFAScreen from './screens/TwoFAScreen';
import SessionsScreen from './screens/SessionsScreen';
import TrustedDevicesScreen from './screens/TrustedDevicesScreen';
import AccountActionsScreen from './screens/AccountActionsScreen';
import CollectionScreen from './screens/CollectionScreen';
// Admin screens
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import AdminUsersScreen from './screens/admin/UsersScreen';
import AdminUserDetailScreen from './screens/admin/UserDetailScreen';
import AdminVerificationScreen from './screens/admin/VerificationScreen';
import AdminActivityLogsScreen from './screens/admin/ActivityLogsScreen';
import AdminAnalyticsScreen from './screens/admin/AnalyticsScreen';
import AdminAuctionsScreen from './screens/admin/AuctionsScreen';
import AdminAuditTrailScreen from './screens/admin/AuditTrailScreen';
import AdminConversationsScreen from './screens/admin/ConversationsScreen';
import AdminHelpScreen from './screens/admin/HelpScreen';
import AdminModeratorScreen from './screens/admin/ModeratorScreen';
import AdminNotificationsScreen from './screens/admin/NotificationsScreen';
import AdminTestBoostScreen from './screens/admin/TestBoostScreen';
import AdminTransactionsScreen from './screens/admin/TransactionsScreen';

const Stack = createStackNavigator();
const TopTab = createMaterialTopTabNavigator();

function WebRootLayoutFix() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    const style = document.createElement('style');
    style.setAttribute('data-enumismatica', 'web-root-fix');
    style.textContent = `
      html, body { height: 100%; width: 100%; margin: 0; padding: 0; }
      #root, #app { height: 100%; width: 100%; display: flex; }
      body { overflow: hidden; }
    `;
    document.head.appendChild(style);

    return () => {
      try {
        document.head.removeChild(style);
      } catch {
        // ignore
      }
    };
  }, []);

  return null;
}

// Prevent splash screen from auto-hiding
ExpoSplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors if preventAutoHideAsync fails
});

const TAB_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ProductCatalog: { label: 'Magazin', icon: 'storefront-outline' },
  Dashboard: { label: 'Dashboard', icon: 'person-circle-outline' },
  AuctionList: { label: 'Licitații', icon: 'pricetag-outline' },
  Notifications: { label: 'Notificări', icon: 'notifications-outline' },
};

interface SellSheetModalProps {
  visible: boolean;
  onClose: () => void;
}

const SellSheetModal: React.FC<SellSheetModalProps> = ({ visible, onClose }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  
  if (!visible) return null;

  const handleDirect = () => {
    console.log('[SellSheetModal] handleDirect pressed');
    onClose();
    navigation.navigate('NewListing', { listingType: 'direct' });
  };

  const handleAuction = () => {
    console.log('[SellSheetModal] handleAuction pressed');
    onClose();
    navigation.navigate('NewListing', { listingType: 'auction' });
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Ce vrei să faci?</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Închide meniul de vânzare"
              onPress={onClose}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={styles.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetSubtitle}>
            Alege tipul de listare pentru piesa ta.
          </Text>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleDirect}
              style={[styles.sheetAction, styles.sheetActionPrimary]}
            >
              <Text style={styles.sheetActionTitle}>Listează produs (preț fix)</Text>
              <Text style={styles.sheetActionSubtitle}>
                Setezi un preț fix, produsul apare în Magazin.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleAuction}
              style={[styles.sheetAction, styles.sheetActionSecondary]}
            >
              <Text style={styles.sheetActionTitle}>Trimite la licitație</Text>
              <Text style={styles.sheetActionSubtitle}>
                Creezi o licitație cu durată și preț de pornire.
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Custom Tab Bar Component
const CustomTabBar: React.FC<MaterialTopTabBarProps & { onFabPress: () => void }> = ({ 
  state, 
  navigation, 
  onFabPress 
}) => {
  const insets = useSafeAreaInsets();

  const renderTab = (routeName: string, index: number) => {
    const config = TAB_CONFIG[routeName];
    if (!config) return null;

    const isFocused = state.index === index;

    const onPress = () => {
      if (!isFocused) {
        navigation.navigate(routeName);
      }
    };

    return (
      <TouchableOpacity
        key={routeName}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={config.label}
        onPress={onPress}
        style={[styles.tabItem, isFocused && styles.tabItemActive]}
        activeOpacity={0.9}
      >
        <Ionicons
          name={config.icon}
          size={22}
          color={isFocused ? '#020617' : '#64748b'}
          style={styles.tabIcon}
        />
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{config.label}</Text>
      </TouchableOpacity>
    );
  };

  const routes = state.routes.map(r => r.name);
  const leftRoutes = routes.slice(0, 2);
  const rightRoutes = routes.slice(2, 4);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.tabBarContainer,
        {
          paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16,
        },
      ]}
    >
      <View style={styles.tabBarBackground} pointerEvents="auto">
        <View style={styles.tabSideLeft}>
          {leftRoutes.map((name, idx) => renderTab(name, idx))}
        </View>
        <View style={styles.tabCenterSpacer} />
        <View style={styles.tabSideRight}>
          {rightRoutes.map((name, idx) => renderTab(name, idx + 2))}
        </View>
      </View>

      {/* Center floating action button */}
      <View style={styles.fabWrapper} pointerEvents="box-none">
        <View style={styles.fabInnerWrapper} pointerEvents="auto">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Deschide meniul de vânzare"
            activeOpacity={0.9}
            onPress={onFabPress}
            style={styles.fabButton}
          >
            <Ionicons name="add" size={26} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.fabLabel}>Vinde</Text>
        </View>
      </View>
    </View>
  );
};

// Main Tab Navigator with swipeable screens
function MainTabs() {
  const [sellSheetVisible, setSellSheetVisible] = useState(false);

  return (
    <>
      <TopTab.Navigator
        screenOptions={{
          swipeEnabled: true,
          animationEnabled: true,
        }}
        tabBar={(props: MaterialTopTabBarProps) => (
          <CustomTabBar
            {...props}
            onFabPress={() => setSellSheetVisible(true)}
          />
        )}
      >
        <TopTab.Screen name="ProductCatalog" component={ProductCatalogScreen} />
        <TopTab.Screen name="Dashboard" component={DashboardScreen} />
        <TopTab.Screen name="AuctionList" component={AuctionListScreen} />
        <TopTab.Screen name="Notifications" component={NotificationsScreen} />
      </TopTab.Navigator>

      <SellSheetModal
        visible={sellSheetVisible}
        onClose={() => setSellSheetVisible(false)}
      />
    </>
  );
}

// Auth Stack for unauthenticated users
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#00020d' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// Main App Component
function AppContent() {
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading) {
      ExpoSplashScreen.hideAsync().catch(() => {
        // Ignore errors if hideAsync fails
      });
    }
  }, [loading]);

  if (loading) {
    return <SplashScreen />; // Show static splash screen while loading
  }

  return (
    <View style={styles.rootAppContainer}>
      <WebRootLayoutFix />
      {user && <Header />}
      <NavigationContainer>
        {user ? (
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: '#F9FAFB' },
            }}
          >
            <Stack.Screen 
              name="MainTabs" 
              component={MainTabs} 
            />
            {/* Settings & Security */}
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
            <Stack.Screen name="TwoFA" component={TwoFAScreen} />
            <Stack.Screen name="Sessions" component={SessionsScreen} />
            <Stack.Screen name="TrustedDevices" component={TrustedDevicesScreen} />
            <Stack.Screen name="AccountActions" component={AccountActionsScreen} />
            <Stack.Screen name="NewListing" component={NewListingScreen} />
            <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
            <Stack.Screen name="AuctionDetails" component={AuctionDetailsScreen} />
            <Stack.Screen name="BidHistory" component={BidHistoryScreen} />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
            <Stack.Screen name="HelpArticle" component={HelpArticleScreen} />
            <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
            <Stack.Screen name="SalesHistory" component={SalesHistoryScreen} />
            <Stack.Screen name="Collection" component={CollectionScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen name="Contact" component={ContactScreen} />
            <Stack.Screen name="Pronumismatica" component={PronumismaticaScreen} />
            <Stack.Screen name="MonetariaStatului" component={MonetariaStatuluiScreen} />
            <Stack.Screen name="MonetariaStatuluiProductDetails" component={MonetariaStatuluiProductDetailsScreen} />
            <Stack.Screen name="Contracts" component={ContractsScreen} />
            <Stack.Screen name="Event" component={EventScreen} />
            <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="SellerProfile" component={SellerProfileScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Messages" component={MessagesScreen} />
            {/* Admin screens */}
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
            <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
            <Stack.Screen name="AdminVerification" component={AdminVerificationScreen} />
            <Stack.Screen name="AdminActivityLogs" component={AdminActivityLogsScreen} />
            <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
            <Stack.Screen name="AdminAuctions" component={AdminAuctionsScreen} />
            <Stack.Screen name="AdminAuditTrail" component={AdminAuditTrailScreen} />
            <Stack.Screen name="AdminConversations" component={AdminConversationsScreen} />
            <Stack.Screen name="AdminHelp" component={AdminHelpScreen} />
            <Stack.Screen name="AdminModerator" component={AdminModeratorScreen} />
            <Stack.Screen name="AdminNotifications" component={AdminNotificationsScreen} />
            <Stack.Screen name="AdminTestBoost" component={AdminTestBoostScreen} />
            <Stack.Screen name="AdminTransactions" component={AdminTransactionsScreen} />
            {/* Auth screens */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </Stack.Navigator>
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  rootAppContainer: {
    flex: 1,
    backgroundColor: '#00020d',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  appContainer: {
    flex: 1,
  },
  // Bottom tab bar styles
  tabBarContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    zIndex: 1000,
  },
  tabBarBackground: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(2, 6, 23, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.85,
    shadowRadius: 20,
    elevation: 16,
  },
  tabSide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabSideLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabSideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tabCenterSpacer: {
    width: 72,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tabItemActive: {
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
  },
  tabIcon: {
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabLabelActive: {
    color: '#020617',
  },
  fabWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabInnerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButton: {
    height: 50,
    width: 50,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7b73c',
    shadowColor: '#e7b73c',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  fabLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#e5e7eb',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    flex: 1,
  },
  // Sell sheet styles
  sheetContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#020617',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    height: '80%',
    width: '100%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.9)',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e5e7eb',
  },
  sheetClose: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9ca3af',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  sheetAction: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  sheetActionPrimary: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.7)',
  },
  sheetActionSecondary: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.7)',
  },
  sheetActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 2,
  },
  sheetActionSubtitle: {
    fontSize: 11,
    color: '#cbd5f5',
  },
});
