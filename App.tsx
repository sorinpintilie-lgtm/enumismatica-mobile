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
import SplashScreen from './components/SplashScreen';
import Header from './components/Header';
import AuthGuard from './components/AuthGuard';
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
import { setupNotificationListeners, ensureNotificationChannelCreated } from './services/notificationService';
import crashlyticsService from './shared/crashlyticsService';

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
import BuyCreditsScreen from './screens/BuyCreditsScreen';
import SellerProfileScreen from './screens/SellerProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import MessagesScreen from './screens/MessagesScreen';
import UserProductsScreen from './screens/UserProductsScreen';
import UserAuctionsScreen from './screens/UserAuctionsScreen';
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

const TAB_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ProductCatalog: { label: 'Magazin', icon: 'storefront-outline' },
  Dashboard: { label: 'Cont', icon: 'person-circle-outline' },
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
                Se setează un preț fix, iar produsul este publicat în Magazin.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleAuction}
              style={[styles.sheetAction, styles.sheetActionSecondary]}
            >
              <Text style={styles.sheetActionTitle}>Trimite la licitație</Text>
              <Text style={styles.sheetActionSubtitle}>
                Se pornește o licitație, cu preț de pornire și termen de încheiere.
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
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]} numberOfLines={1} ellipsizeMode="tail">{config.label}</Text>
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
  const [splashFinished, setSplashFinished] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Ensure notification channel is created (Android only)
    ensureNotificationChannelCreated().catch((error) => {
      console.error('[App] Failed to ensure notification channel:', error);
      crashlyticsService.logError(error);
    });

    // Setup notification listeners for push notifications
    const cleanup = setupNotificationListeners();

    // Setup global error handler
    const originalError = console.error;
    console.error = (error, ...args) => {
      originalError(error, ...args);
      // Prevent recursion by checking if we're already handling this error
      if (error && typeof error === 'object' && error.crashlyticsHandled) {
        return;
      }
      try {
        crashlyticsService.logError(error);
      } catch (e) {
        console.warn('Failed to log error to Crashlytics:', e);
      }
    };

    // Setup unhandled promise rejection handler
    const handleUnhandledRejection = (error: any) => {
      console.error('[App] Unhandled promise rejection:', error);
      crashlyticsService.logError(error);
    };

    // Setup global error listener
    const handleGlobalError = (error: any, stackTrace: any) => {
      console.error('[App] Global error:', error);
      crashlyticsService.logError(error);
    };

    // Register handlers
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // For React Native error handling
      const originalOnError = global.onerror;
      global.onerror = (message, source, lineno, colno, error) => {
        crashlyticsService.logError(error || message);
        if (originalOnError) {
          originalOnError(message, source, lineno, colno, error);
        }
      };
    }

    return () => {
      cleanup();
      console.error = originalError;
    };
  }, []);

  if (loading || !splashFinished) {
    return (
      <SplashScreen
        onFinish={() => {
          setSplashFinished(true);
          console.log('[App] Splash screen finished');
        }}
      />
    );
  }

  return (
    <View style={styles.rootAppContainer}>
      <WebRootLayoutFix />
      <Header />
      <NavigationContainer
        linking={{
          prefixes: ['enumismatica://'],
          config: {
            screens: {
              ProductDetails: {
                path: 'product/:productId',
              },
              AuctionDetails: {
                path: 'auction/:auctionId',
              },
            },
          },
        }}
      >
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
          <Stack.Screen name="Settings">
            {() => (
              <AuthGuard>
                <SettingsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="ChangePassword">
            {() => (
              <AuthGuard>
                <ChangePasswordScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="ChangeEmail">
            {() => (
              <AuthGuard>
                <ChangeEmailScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="TwoFA">
            {() => (
              <AuthGuard>
                <TwoFAScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Sessions">
            {() => (
              <AuthGuard>
                <SessionsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="TrustedDevices">
            {() => (
              <AuthGuard>
                <TrustedDevicesScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AccountActions">
            {() => (
              <AuthGuard>
                <AccountActionsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="NewListing">
            {() => (
              <AuthGuard>
                <NewListingScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="ProductDetails">
            {() => (
              <AuthGuard>
                <ProductDetailsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AuctionDetails">
            {() => (
              <AuthGuard>
                <AuctionDetailsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="BidHistory">
            {() => (
              <AuthGuard>
                <BidHistoryScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="HelpCenter">
            {() => (
              <AuthGuard>
                <HelpCenterScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="HelpArticle">
            {() => (
              <AuthGuard>
                <HelpArticleScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="OrderHistory">
            {() => (
              <AuthGuard>
                <OrderHistoryScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="OrderDetails">
            {() => (
              <AuthGuard>
                <OrderDetailsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="SalesHistory">
            {() => (
              <AuthGuard>
                <SalesHistoryScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Collection">
            {() => (
              <AuthGuard>
                <CollectionScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="About">
            {() => (
              <AuthGuard>
                <AboutScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Contact">
            {() => (
              <AuthGuard>
                <ContactScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Pronumismatica">
            {() => (
              <AuthGuard>
                <PronumismaticaScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="MonetariaStatului">
            {() => (
              <AuthGuard>
                <MonetariaStatuluiScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="MonetariaStatuluiProductDetails">
            {() => (
              <AuthGuard>
                <MonetariaStatuluiProductDetailsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Contracts">
            {() => (
              <AuthGuard>
                <ContractsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Event">
            {() => (
              <AuthGuard>
                <EventScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Bookmarks">
            {() => (
              <AuthGuard>
                <BookmarksScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Watchlist">
            {() => (
              <AuthGuard>
                <WatchlistScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Cart">
            {() => (
              <AuthGuard>
                <CartScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Checkout">
            {() => (
              <AuthGuard>
                <CheckoutScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="BuyCredits">
            {() => (
              <AuthGuard>
                <BuyCreditsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="SellerProfile">
            {() => (
              <AuthGuard>
                <SellerProfileScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Notifications">
            {() => (
              <AuthGuard>
                <NotificationsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="Messages">
            {() => (
              <AuthGuard>
                <MessagesScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="UserProducts">
            {() => (
              <AuthGuard>
                <UserProductsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="UserAuctions">
            {() => (
              <AuthGuard>
                <UserAuctionsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          {/* Admin screens */}
          <Stack.Screen name="AdminDashboard">
            {() => (
              <AuthGuard>
                <AdminDashboardScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminUsers">
            {() => (
              <AuthGuard>
                <AdminUsersScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminUserDetail">
            {() => (
              <AuthGuard>
                <AdminUserDetailScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminVerification">
            {() => (
              <AuthGuard>
                <AdminVerificationScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminActivityLogs">
            {() => (
              <AuthGuard>
                <AdminActivityLogsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminAnalytics">
            {() => (
              <AuthGuard>
                <AdminAnalyticsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminAuctions">
            {() => (
              <AuthGuard>
                <AdminAuctionsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminAuditTrail">
            {() => (
              <AuthGuard>
                <AdminAuditTrailScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminConversations">
            {() => (
              <AuthGuard>
                <AdminConversationsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminHelp">
            {() => (
              <AuthGuard>
                <AdminHelpScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminModerator">
            {() => (
              <AuthGuard>
                <AdminModeratorScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminNotifications">
            {() => (
              <AuthGuard>
                <AdminNotificationsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminTestBoost">
            {() => (
              <AuthGuard>
                <AdminTestBoostScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          <Stack.Screen name="AdminTransactions">
            {() => (
              <AuthGuard>
                <AdminTransactionsScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          {/* Auth screens */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
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
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 999,
    minWidth: 60,
    maxWidth: 80,
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
    lineHeight: 13,
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
