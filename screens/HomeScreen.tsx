import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { useProducts } from '../hooks/useProducts';
import { useCachedProducts } from '../hooks/useCachedProducts';
import { sharedStyles, colors } from '../styles/sharedStyles';
import { Ionicons } from '@expo/vector-icons';

const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { products, loading: productsLoading } = useProducts({
    pageSize: 8,
    enabled: !!user,
    listingType: 'direct',
    live: false
  });
  const { products: boostedProducts = [], loading: boostedLoading } = useCachedProducts(undefined, 3, ['name', 'images', 'price', 'createdAt', 'updatedAt']);

  // Web-specific styling adjustments
  const isWeb = Platform.OS === 'web';

  // Home screen specific styles
  const homeStyles = StyleSheet.create({
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
    heroContainer: {
      backgroundColor: 'rgba(231, 183, 60, 0.1)',
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(231, 183, 60, 0.2)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      alignSelf: 'flex-start',
      marginBottom: 10,
    },
    heroBadgeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#e7b73c',
    },
    heroBadgeText: {
      color: '#e7b73c',
      fontSize: 12,
      fontWeight: '600',
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 8,
      lineHeight: 36,
    },
    heroDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 14,
      lineHeight: 24,
    },
    ctaButtons: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
    secondaryButton: {
      flex: 1,
      borderWidth: 2,
      borderColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: colors.primaryText,
      fontWeight: '600',
      fontSize: 14,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 14,
    },
    featuresGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 16,
    },
    featureCard: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.2)',
      alignItems: 'center',
    },
    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(231, 183, 60, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    featureTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 10,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    section: {
      marginBottom: 16,
    },
    sectionHeader: {
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    highlightsGrid: {
      gap: 16,
    },
    highlightCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.2)',
    },
    highlightHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    highlightIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    highlightTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    highlightDescription: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    boostedContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
    },
    boostedProductImage: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: 'white',
      resizeMode: 'contain',
    },
    boostedBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      zIndex: 10,
    },
    boostedBadgeText: {
      color: colors.primaryText,
      fontSize: 10,
      fontWeight: '600',
    },
    boostedInfo: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    boostedProductName: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: '600',
    },
    boostedProductPrice: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: 'bold',
    },
    boostedPreviewGrid: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    boostedPreviewItem: {
      flex: 1,
      backgroundColor: 'rgba(2, 6, 23, 0.8)',
      borderRadius: 8,
      padding: 8,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.2)',
    },
    boostedPreviewImage: {
      width: '100%',
      height: 60,
      backgroundColor: 'white',
      borderRadius: 6,
      marginBottom: 4,
      resizeMode: 'contain',
    },
    boostedPreviewName: {
      color: colors.textPrimary,
      fontSize: 10,
      fontWeight: '500',
    },
    boostedPreviewPrice: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: 'bold',
    },
    productsGrid: {
      gap: 12,
    },
    productCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.2)',
      flexDirection: 'row',
      gap: 12,
    },
    productImage: {
      width: 80,
      height: 80,
      backgroundColor: 'white',
      borderRadius: 8,
      resizeMode: 'contain',
    },
    productInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    productName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    productPrice: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: 'bold',
    },
    viewAllButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },
    viewAllButtonText: {
      color: colors.primaryText,
      fontWeight: '600',
      fontSize: 14,
    },
    stepsGrid: {
      gap: 12,
    },
    stepCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.2)',
    },
    stepLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 4,
    },
    stepText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    authPrompt: {
      backgroundColor: 'rgba(2, 6, 23, 0.8)',
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
      alignItems: 'center',
    },
    authPromptTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    authPromptDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
      textAlign: 'center',
    },
    authButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    authButton: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    authButtonText: {
      color: colors.primaryText,
      fontWeight: '600',
      fontSize: 14,
    },
    loadingContainer: {
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
  });

  // Web container wrapper
  const WebContainer = ({ children }: { children: React.ReactNode }) => {
    if (isWeb) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100%',
          backgroundColor: colors.background,
        }}>
          {children}
        </div>
      );
    }
    return <>{children}</>;
  };

  // Feature icons
  const FeatureIcon = ({ name }: { name: string }) => {
    return (
      <View style={homeStyles.featureIcon}>
        <Ionicons name={name as any} size={20} color="#e7b73c" />
      </View>
    );
  };

  // Highlight icons
  const HighlightIcon = ({ index }: { index: number }) => {
    const icons = ['shield-checkmark-outline', 'eye-outline', 'people-outline'];
    return (
      <View style={homeStyles.highlightIcon}>
        <Ionicons name={icons[index] as any} size={16} color={colors.primaryText} />
      </View>
    );
  };

  const highlights = [
    {
      title: 'Magazin curat și verificat',
      description: 'Seleție de monede autentificate, gata de livrare rapidă și prezentate cu descrieri detaliate.',
    },
    {
      title: 'Licitații transparente',
      description: 'Urmărește pas cu pas ofertele, setează alerte și câștigă piese rare în timp real.',
    },
    {
      title: 'Expertiză locală',
      description: 'Echipa noastră te ajută să evaluezi corect piesele și să construiești o colecție solidă.',
    },
  ];

  const steps = [
    {
      label: '1. Explorează',
      text: 'Caută monede după țară, metal sau perioadă și descoperă selecții curatoriate.',
    },
    {
      label: '2. Alege ruta potrivită',
      text: 'Cumpără direct din magazin sau intră în licitații active pentru piese rare.',
    },
    {
      label: '3. Primește în siguranță',
      text: 'Plăți protejate și livrare asigurată, cu verificare la primire.',
    },
  ];

  return (
    <WebContainer>
      <ScrollView
        style={homeStyles.scrollContainer}
        contentContainerStyle={homeStyles.scrollContent}
      >
        <View style={homeStyles.content}>
          {/* Hero Section */}
          <View style={homeStyles.heroContainer}>
            <View style={homeStyles.heroBadge}>
              <View style={homeStyles.heroBadgeDot} />
              <Text style={homeStyles.heroBadgeText}>Platforma românească pentru colecționari</Text>
            </View>
            
            <Text style={homeStyles.heroTitle}>Colecționează istorie cu eNumismatica</Text>
            
            <Text style={homeStyles.heroDescription}>
              Găsești monede autentice, licitații active și suport local pentru fiecare achiziție. Fie că vrei să completezi o serie sau să investești, îți oferim context, transparență și o experiență modernă.
            </Text>

            {/* CTA Buttons */}
            <View style={homeStyles.ctaButtons}>
              <TouchableOpacity
                style={homeStyles.primaryButton}
                onPress={() => navigation.navigate('ProductCatalog' as never)}
              >
                <Text style={homeStyles.buttonText}>Vezi magazinul</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={homeStyles.secondaryButton}
                onPress={() => navigation.navigate('AuctionList' as never)}
              >
                <Text style={homeStyles.secondaryButtonText}>Licitații în desfășurare</Text>
              </TouchableOpacity>
            </View>

            {/* Features Grid */}
            <View style={homeStyles.featuresGrid}>
              <View style={homeStyles.featureCard}>
                <FeatureIcon name="flash-outline" />
                <Text style={homeStyles.featureTitle}>Autentificare rapidă</Text>
                <Text style={homeStyles.featureDescription}>Acces instant la cont și licitații</Text>
              </View>

              <View style={homeStyles.featureCard}>
                <FeatureIcon name="notifications-outline" />
                <Text style={homeStyles.featureTitle}>Notificări live</Text>
                <Text style={homeStyles.featureDescription}>Alerte instant pentru oferte noi</Text>
              </View>

              <View style={homeStyles.featureCard}>
                <FeatureIcon name="people-outline" />
                <Text style={homeStyles.featureTitle}>Comunitate</Text>
                <Text style={homeStyles.featureDescription}>Conectează-te cu pasionați</Text>
              </View>
            </View>
          </View>

          {/* Boosted Products Section */}
          <View style={homeStyles.section}>
            <View style={homeStyles.sectionHeader}>
              <Text style={homeStyles.sectionTitle}>Piese Promovate</Text>
            </View>

            {boostedLoading ? (
              <View style={homeStyles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={homeStyles.loadingText}>Se încarcă piesele...</Text>
              </View>
            ) : boostedProducts.length > 0 ? (
              <View style={homeStyles.boostedContainer}>
                <View style={{ position: 'relative' }}>
                  <Image
                    source={{ uri: boostedProducts[0].images?.[0] || 'https://via.placeholder.com/400x300?text=Coin' }}
                    style={homeStyles.boostedProductImage}
                  />
                  <View style={homeStyles.boostedBadge}>
                    <Text style={homeStyles.boostedBadgeText}>Piesă Promovată</Text>
                  </View>
                </View>

                <View style={homeStyles.boostedInfo}>
                  <View>
                    <Text style={homeStyles.boostedProductName}>{boostedProducts[0].name}</Text>
                    <Text style={{ color: colors.primaryText, fontSize: 12 }}>Preț special disponibil acum</Text>
                  </View>
                  <View>
                    <Text style={homeStyles.boostedProductPrice}>{boostedProducts[0].price} EUR</Text>
                    <Text style={{ color: colors.primaryText, fontSize: 10 }}>La ofertă limitată</Text>
                  </View>
                </View>

                {/* Additional boosted products preview */}
                {boostedProducts.length > 1 && (
                  <View style={homeStyles.boostedPreviewGrid}>
                    {boostedProducts.slice(1, 3).map((product) => (
                      <View key={product.id} style={homeStyles.boostedPreviewItem}>
                        <Image
                          source={{ uri: product.images?.[0] || 'https://via.placeholder.com/100x80?text=Coin' }}
                          style={homeStyles.boostedPreviewImage}
                        />
                        <Text style={homeStyles.boostedPreviewName} numberOfLines={1}>{product.name}</Text>
                        <Text style={homeStyles.boostedPreviewPrice}>{product.price} EUR</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={homeStyles.loadingContainer}>
                <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
                <Text style={homeStyles.loadingText}>Nu sunt piese promovate</Text>
                <Text style={{ ...homeStyles.loadingText, fontSize: 12 }}>Piesele promovate vor apărea aici</Text>
              </View>
            )}
          </View>

          {/* Highlights Section */}
          <View style={homeStyles.section}>
            <View style={homeStyles.sectionHeader}>
              <Text style={homeStyles.sectionTitle}>De ce să ne alegi</Text>
            </View>

            <View style={homeStyles.highlightsGrid}>
              {highlights.map((item, index) => (
                <View key={item.title} style={homeStyles.highlightCard}>
                  <View style={homeStyles.highlightHeader}>
                    <HighlightIcon index={index} />
                    <Text style={homeStyles.highlightTitle}>{item.title}</Text>
                  </View>
                  <Text style={homeStyles.highlightDescription}>{item.description}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Latest Products Section */}
          <View style={homeStyles.section}>
            <View style={homeStyles.sectionHeader}>
              <Text style={homeStyles.sectionTitle}>Ultimele Piese</Text>
              <Text style={homeStyles.sectionSubtitle}>
                Monede recent adăugate în E-shop, verificate și gata de livrare.
              </Text>
            </View>

            {user ? (
              <>
                {productsLoading ? (
                  <View style={homeStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={homeStyles.loadingText}>Se încarcă produsele...</Text>
                  </View>
                ) : (
                  <View style={homeStyles.productsGrid}>
                    {products.slice(0, 4).map((product) => (
                      <TouchableOpacity
                        key={product.id}
                        style={homeStyles.productCard}
                        onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
                      >
                        <Image
                          source={{ uri: product.images?.[0] || 'https://via.placeholder.com/80x80?text=Coin' }}
                          style={homeStyles.productImage}
                        />
                        <View style={homeStyles.productInfo}>
                          <Text style={homeStyles.productName} numberOfLines={1}>{product.name}</Text>
                          <Text style={homeStyles.productPrice}>{product.price} EUR</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={homeStyles.viewAllButton}
                  onPress={() => navigation.navigate('ProductCatalog' as never)}
                >
                  <Text style={homeStyles.viewAllButtonText}>Vezi toate piesele</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={homeStyles.authPrompt}>
                <Text style={homeStyles.authPromptTitle}>Autentifică-te pentru a vedea E-shop-ul</Text>
                <Text style={homeStyles.authPromptDescription}>
                  Pentru a accesa piesele, licitațiile și detaliile acestora, este necesar un cont.
                </Text>

                <View style={homeStyles.authButtons}>
                  <TouchableOpacity
                    style={homeStyles.authButton}
                    onPress={() => navigation.navigate('Login' as never)}
                  >
                    <Text style={homeStyles.authButtonText}>Autentificare</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[homeStyles.authButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary }]}
                    onPress={() => navigation.navigate('Register' as never)}
                  >
                    <Text style={{ ...homeStyles.authButtonText, color: colors.primary }}>Creează cont</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* How it works Section */}
          <View style={homeStyles.section}>
            <View style={homeStyles.sectionHeader}>
              <Text style={homeStyles.sectionTitle}>Cum funcționează</Text>
              <Text style={homeStyles.sectionSubtitle}>
                De la căutare la livrare, totul în română
              </Text>
            </View>

            <View style={homeStyles.stepsGrid}>
              {steps.map((step) => (
                <View key={step.label} style={homeStyles.stepCard}>
                  <Text style={homeStyles.stepLabel}>{step.label}</Text>
                  <Text style={homeStyles.stepText}>{step.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </WebContainer>
  );
};

export default HomeScreen;
