import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { logout } from '@shared/auth';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, TabParamList } from '../navigationTypes';
import { useProducts } from '../hooks/useProducts';
import { useAuctions } from '../hooks/useAuctions';
import { sharedStyles, colors } from '../styles/sharedStyles';
import { formatEUR } from '../utils/currency';
import { useConversations } from '../hooks/useChat';
import { useCollection } from '../hooks/useCollection';
import AuthPromptModal from '../components/AuthPromptModal';
import crashlyticsService from '../shared/crashlyticsService';


const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'MainTabs'>>();
  const { products, loading: productsLoading } = useProducts({ ownerId: user?.uid });
  const { auctions, loading: auctionsLoading } = useAuctions();
  const { conversations, totalUnreadCount } = useConversations(user?.uid || null);
  const { items: collectionItems, stats: collectionStats } = useCollection(user?.uid || null);
  const [authPromptVisible, setAuthPromptVisible] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigation.navigate('Login');
  };

  // Web-specific styling adjustments
  const isWeb = Platform.OS === 'web';

  // Dashboard-specific styles
  const dashboardStyles = StyleSheet.create({
    scrollContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 96, // ensure content can scroll fully above bottom tab bar
    },
    content: {
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 32,
    },
    headerTitle: {
      fontSize: 30,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    headerSubtitle: {
      color: colors.textSecondary,
      marginTop: 8,
      fontSize: 14,
    },
    logoutButton: {
      backgroundColor: colors.error,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginTop: 24,
      marginBottom: 16,
      alignItems: 'center',
    },
    logoutButtonText: {
      color: 'white',
      fontWeight: '600',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    statsCard: {
      width: '48%',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderColor,
      backgroundColor: colors.cardBackground,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 5,
      position: 'relative',
    },
    statsCardTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    statsCardValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 8,
    },
    statsCardSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    actionButton: {
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginBottom: 8,
    },
    actionButtonText: {
      color: colors.primaryText,
      textAlign: 'center',
      fontSize: 12,
    },
    actionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 12,
    },
    actionGridButton: {
      width: '48%',
      aspectRatio: 1.3,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    actionGridText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 8,
    },
    badge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: '#ef4444',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    actionBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: '#ef4444',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '700',
    },
    section: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderColor,
      backgroundColor: colors.cardBackground,
      padding: 20,
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    viewAllButton: {
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    viewAllButtonText: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: '600',
    },
    productItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 8,
      marginBottom: 8,
    },
    productName: {
      fontWeight: '500',
      color: colors.textPrimary,
    },
    productPrice: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    viewButton: {
      backgroundColor: '#475569',
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 6,
    },
    viewButtonText: {
      color: 'white',
      fontSize: 12,
    },
    loadingText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
    partnerLogo: {
      width: 60,
      height: 60,
      marginBottom: 8,
    },
  });

  if (!user) {
      return (
        <ScrollView
          style={dashboardStyles.scrollContainer}
          contentContainerStyle={dashboardStyles.scrollContent}
        >
          <View style={dashboardStyles.content}>
            {/* Header */}
            <View style={dashboardStyles.header}>
              <View>
                <Text style={dashboardStyles.headerTitle}>Bun venit!</Text>
                <Text style={dashboardStyles.headerSubtitle}>Descoperirea lumii numismatice începe aici</Text>
              </View>
            </View>

            {/* Welcome Section */}
            <View style={dashboardStyles.section}>
              <Text style={dashboardStyles.sectionTitle}>Despre eNumismatica</Text>
              <Text style={[dashboardStyles.loadingText, { textAlign: 'left', marginBottom: 16 }]}>
                eNumismatica este platforma pentru vânzarea și licitarea monedelor rare.
                Comunitatea reunește numismați și colecționari interesați de piese unice.
              </Text>

              {/* Login/Register Buttons */}
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  style={[dashboardStyles.actionButton, { paddingVertical: 14 }]}
                  onPress={() => setAuthPromptVisible(true)}
                >
                  <Text style={[dashboardStyles.actionButtonText, { fontSize: 16 }]}>Mod vizitator</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[dashboardStyles.actionButton, { backgroundColor: '#3B82F6', paddingVertical: 14 }]}
                  onPress={() => setAuthPromptVisible(true)}
                >
                  <Text style={[dashboardStyles.actionButtonText, { fontSize: 16 }]}>Autentificare / Înregistrare</Text>
                </TouchableOpacity>
              </View>
            </View>

            <AuthPromptModal
              visible={authPromptVisible}
              title="Acces extins"
              message="Autentificarea sau crearea unui cont oferă acces la colecții, mesaje, istoricul comenzilor și funcții avansate."
              benefits={[
                'Mesaje și notificări în timp real',
                'Colecție personală și watchlist',
                'Comenzi și licitații salvate',
              ]}
              onClose={() => setAuthPromptVisible(false)}
              onLogin={() => {
                setAuthPromptVisible(false);
                navigation.navigate('Login');
              }}
              onRegister={() => {
                setAuthPromptVisible(false);
                navigation.navigate('Register');
              }}
            />

            {/* Features Section */}
            <View style={dashboardStyles.section}>
              <Text style={dashboardStyles.sectionTitle}>Funcționalități</Text>
              <View style={dashboardStyles.actionGrid}>
                <TouchableOpacity
                  style={dashboardStyles.actionGridButton}
                  onPress={() => setAuthPromptVisible(true)}
                >
                  <Ionicons name="storefront-outline" size={28} color={colors.primary} />
                  <Text style={dashboardStyles.actionGridText}>Magazin</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={dashboardStyles.actionGridButton}
                  onPress={() => setAuthPromptVisible(true)}
                >
                  <Ionicons name="pricetag-outline" size={28} color={colors.primary} />
                  <Text style={dashboardStyles.actionGridText}>Licitații</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={dashboardStyles.actionGridButton}
                  onPress={() => setAuthPromptVisible(true)}
                >
                  <Ionicons name="albums-outline" size={28} color={colors.primary} />
                  <Text style={dashboardStyles.actionGridText}>Colecție</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={dashboardStyles.actionGridButton}
                  onPress={() => setAuthPromptVisible(true)}
                >
                  <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
                  <Text style={dashboardStyles.actionGridText}>Mesaje</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Parteneri Section */}
            <View style={dashboardStyles.section}>
              <Text style={dashboardStyles.sectionTitle}>Parteneri</Text>
              <View style={dashboardStyles.actionGrid}>
                 <TouchableOpacity
                   style={dashboardStyles.actionGridButton}
                   onPress={() => setAuthPromptVisible(true)}
                 >
                   <Image
                     source={require('../assets/pronumilogo.png')}
                     style={dashboardStyles.partnerLogo}
                     resizeMode="contain"
                   />
                   <Text style={dashboardStyles.actionGridText}>Asociația Pronumismatica</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   style={dashboardStyles.actionGridButton}
                   onPress={() => setAuthPromptVisible(true)}
                 >
                   <Image
                     source={require('../assets/logomonetariastatului.png')}
                     style={dashboardStyles.partnerLogo}
                     resizeMode="contain"
                   />
                   <Text style={dashboardStyles.actionGridText}>Monetăria Statului</Text>
                 </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      );
    }

  // Filter auctions where user is the owner or current bidder and auction is active
  const userAuctions = auctions.filter(auction =>
    (auction.ownerId === user.uid || auction.currentBidderId === user.uid) &&
    auction.status === 'active'
  );

  return (
      <ScrollView
        style={dashboardStyles.scrollContainer}
        contentContainerStyle={dashboardStyles.scrollContent}
      >
        <View style={dashboardStyles.content}>
          {/* Header */}
          <View style={dashboardStyles.header}>
            <View>
              <Text style={dashboardStyles.headerTitle}>Cont</Text>
              <Text style={dashboardStyles.headerSubtitle}>Cont activ: {user.email}</Text>
            </View>
          </View>

        {/* Stats Cards - 2x2 Grid (Now Clickable) */}
        <View style={dashboardStyles.statsGrid}>
          <TouchableOpacity
            style={dashboardStyles.statsCard}
            onPress={() => navigation.navigate('UserProducts')}
          >
            <Ionicons name="cube-outline" size={32} color={colors.primary} />
            <Text style={dashboardStyles.statsCardValue}>{products.length}</Text>
            <Text style={dashboardStyles.statsCardTitle}>Produse</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={dashboardStyles.statsCard}
            onPress={() => navigation.navigate('UserAuctions')}
          >
            <Ionicons name="pricetag-outline" size={32} color={colors.primary} />
            <Text style={dashboardStyles.statsCardValue}>{userAuctions.length}</Text>
            <Text style={dashboardStyles.statsCardTitle}>Licitații</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={dashboardStyles.statsCard}
            onPress={() => navigation.navigate('Collection')}
          >
            <Ionicons name="albums-outline" size={32} color={colors.primary} />
            <Text style={dashboardStyles.statsCardValue}>{collectionItems?.length || 0}</Text>
            <Text style={dashboardStyles.statsCardTitle}>Colecție</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={dashboardStyles.statsCard}
            onPress={() => navigation.navigate('Messages', {})}
          >
            <Ionicons name="chatbubbles-outline" size={32} color={colors.primary} />
            <Text style={dashboardStyles.statsCardValue}>{conversations?.length || 0}</Text>
            <Text style={dashboardStyles.statsCardTitle}>Mesaje</Text>
            {totalUnreadCount > 0 && (
              <View style={dashboardStyles.badge}>
                <Text style={dashboardStyles.badgeText}>{totalUnreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Actions - 2x2 Grid (4 items, removed Mesaje and Colecția Mea) */}
        <View style={dashboardStyles.section}>
          <Text style={dashboardStyles.sectionTitle}>Acțiuni rapide</Text>
          <View style={dashboardStyles.actionGrid}>
            <TouchableOpacity
              style={dashboardStyles.actionGridButton}
              onPress={() => navigation.navigate('Cart')}
            >
              <Ionicons name="cart" size={28} color={colors.primary} />
              <Text style={dashboardStyles.actionGridText}>Coș</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dashboardStyles.actionGridButton}
              onPress={() => navigation.navigate('OrderHistory')}
            >
              <Ionicons name="receipt" size={28} color={colors.primary} />
              <Text style={dashboardStyles.actionGridText}>Cumpărări</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dashboardStyles.actionGridButton}
              onPress={() => navigation.navigate('SalesHistory')}
            >
              <Ionicons name="cash" size={28} color={colors.primary} />
              <Text style={dashboardStyles.actionGridText}>Vânzări</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dashboardStyles.actionGridButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="settings" size={28} color={colors.primary} />
              <Text style={dashboardStyles.actionGridText}>Setări</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dashboardStyles.actionGridButton}
              onPress={() => navigation.navigate('Watchlist')}
            >
              <Ionicons name="bookmark" size={28} color={colors.primary} />
              <Text style={dashboardStyles.actionGridText}>Listă de urmărire</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dashboardStyles.actionGridButton}
              onPress={() => navigation.navigate('HelpCenter')}
            >
              <Ionicons name="help-circle" size={28} color={colors.primary} />
              <Text style={dashboardStyles.actionGridText}>Centru de ajutor</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Products Section */}
        <View style={[dashboardStyles.section, { marginBottom: 24 }]}>
          <View style={dashboardStyles.sectionHeader}>
            <Text style={dashboardStyles.sectionTitle}>Produse listate</Text>
            <TouchableOpacity style={[dashboardStyles.actionButton, { backgroundColor: '#3B82F6' }]}>
              <Text style={dashboardStyles.actionButtonText}>Adăugare produs</Text>
            </TouchableOpacity>
          </View>

          {productsLoading ? (
                      <View style={{ alignItems: 'center', padding: 16 }}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[dashboardStyles.loadingText, { marginTop: 8 }]}>Se încarcă produsele...</Text>
                      </View>
                    ) : products.length === 0 ? (
                      <Text style={dashboardStyles.loadingText}>Nu există produse listate încă.</Text>
                    ) : (
            <View style={{ gap: 12 }}>
              {products.slice(0, 5).map((product) => (
                <View key={product.id} style={dashboardStyles.productItem}>
                  <View>
                    <Text style={dashboardStyles.productName}>{product.name}</Text>
                    <Text style={dashboardStyles.productPrice}>{formatEUR(product.price)}</Text>
                  </View>
                  <TouchableOpacity
                    style={dashboardStyles.viewButton}
                    onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
                  >
                    <Text style={dashboardStyles.viewButtonText}>Detalii</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {products.length > 5 && (
                <Text style={[dashboardStyles.loadingText, { fontSize: 12 }]}>
                  Încă {products.length - 5} produse disponibile.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* My Auction Activity Section */}
        <View style={dashboardStyles.section}>
          <View style={dashboardStyles.sectionHeader}>
            <Text style={dashboardStyles.sectionTitle}>Activitate la licitații</Text>
            <TouchableOpacity
              style={[dashboardStyles.viewAllButton]}
              onPress={() => navigation.navigate('AuctionList', {})}
            >
              <Text style={dashboardStyles.viewAllButtonText}>Listă completă</Text>
            </TouchableOpacity>
          </View>

          {auctionsLoading ? (
                      <View style={{ alignItems: 'center', padding: 16 }}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[dashboardStyles.loadingText, { marginTop: 8 }]}>Se încarcă licitațiile...</Text>
                      </View>
                    ) : userAuctions.length === 0 ? (
                      <Text style={dashboardStyles.loadingText}>Nu există licitații active.</Text>
                    ) : (
            <View style={{ gap: 12 }}>
              {userAuctions.slice(0, 5).map((auction) => (
                <View key={auction.id} style={dashboardStyles.productItem}>
                  <View>
                    <Text style={dashboardStyles.productName}>Licitație #{auction.id.slice(-6)}</Text>
                    <Text style={dashboardStyles.productPrice}>
                      Ofertă curentă: {formatEUR(auction.currentBid || auction.reservePrice)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[dashboardStyles.viewButton, { backgroundColor: '#3B82F6' }]}
                    onPress={() => navigation.navigate('AuctionDetails', { auctionId: auction.id })}
                  >
                    <Text style={dashboardStyles.viewButtonText}>Detalii</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Parteneri Section */}
        <View style={dashboardStyles.section}>
          <Text style={dashboardStyles.sectionTitle}>Parteneri</Text>
          <View style={dashboardStyles.actionGrid}>
            <TouchableOpacity
              style={dashboardStyles.actionGridButton}
              onPress={() => navigation.navigate('Pronumismatica')}
            >
              <Image
                source={require('../assets/pronumilogo.png')}
                style={dashboardStyles.partnerLogo}
                resizeMode="contain"
              />
              <Text style={dashboardStyles.actionGridText}>Asociația Pronumismatica</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dashboardStyles.actionGridButton}
              onPress={() => navigation.navigate('MonetariaStatului')}
            >
              <Image
                source={require('../assets/logomonetariastatului.png')}
                style={dashboardStyles.partnerLogo}
                resizeMode="contain"
              />
              <Text style={dashboardStyles.actionGridText}>Monetăria Statului</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Test Crashlytics Button */}
        <TouchableOpacity
          style={[dashboardStyles.logoutButton, { backgroundColor: '#1f2937' }]}
          onPress={() => {
            console.log('Testing Crashlytics...');
            crashlyticsService.log('Testing Crashlytics from DashboardScreen');
            
            // Test log error
            try {
              throw new Error('Crashlytics test error');
            } catch (error) {
              crashlyticsService.logError(error);
              console.log('Crashlytics test error logged');
            }
            
            // Test user properties
            crashlyticsService.setUserProperties({
              test: 'true',
              screen: 'Dashboard',
              timestamp: new Date().toISOString()
            });
          }}
        >
          <Text style={dashboardStyles.logoutButtonText}>Test Crashlytics</Text>
        </TouchableOpacity>

        {/* Logout Button at Bottom */}
        <TouchableOpacity
          style={dashboardStyles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={dashboardStyles.logoutButtonText}>Deconectare</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
);
};

export default DashboardScreen;
