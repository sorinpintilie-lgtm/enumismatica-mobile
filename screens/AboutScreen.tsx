import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { sharedStyles, colors } from '../styles/sharedStyles';
import { Ionicons } from '@expo/vector-icons';

const AboutScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // Static stats for mobile app - these would be updated periodically
  const stats = {
    totalProducts: 1582,
    totalUsers: 476,
    totalCountries: 23,
    authenticated: 100,
  };

  // Web-specific styling adjustments
  const isWeb = Platform.OS === 'web';

  // About screen specific styles
  const aboutStyles = StyleSheet.create({
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
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 12,
      lineHeight: 36,
      textAlign: 'center',
    },
    heroSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 24,
      textAlign: 'center',
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 16,
      textAlign: 'center',
    },
    sectionContent: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.2)',
    },
    sectionText: {
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 22,
      marginBottom: 12,
    },
    valuesGrid: {
      gap: 16,
    },
    valueCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.2)',
    },
    valueIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(231, 183, 60, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    valueTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    valueDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    offerCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.2)',
      flexDirection: 'row',
      gap: 12,
    },
    offerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    offerTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    offerDescription: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    statsContainer: {
      backgroundColor: 'rgba(231, 183, 60, 0.15)',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    ctaButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
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

  // Value icons
  const ValueIcon = ({ name }: { name: string }) => {
    return (
      <View style={aboutStyles.valueIcon}>
        <Ionicons name={name as any} size={20} color="#e7b73c" />
      </View>
    );
  };

  // Offer icons
  const OfferIcon = ({ index }: { index: number }) => {
    const icons = ['cart-outline', 'hammer-outline', 'shield-checkmark-outline', 'people-outline'];
    return (
      <View style={aboutStyles.offerIcon}>
        <Ionicons name={icons[index] as any} size={16} color={colors.primaryText} />
      </View>
    );
  };

  const values = [
    {
      icon: 'list-outline',
      title: 'Listare și administrare ușoară',
      description: 'Publică rapid monedele tale, completează detaliile esențiale și gestionează totul dintr-un singur loc — de la anunțuri până la licitații.',
    },
    {
      icon: 'school-outline',
      title: 'Educație',
      description: 'Credem în împuternicirea colecționarilor cu cunoștințe. Platforma noastră oferă informații detaliate, context istoric și perspective de expert pentru fiecare piesă.',
    },
    {
      icon: 'people-outline',
      title: 'Comunitate',
      description: 'Construim o comunitate vibrantă de colecționari care împărtășesc cunoștințe, fac schimb corect și celebrează împreună arta și istoria numismaticii.',
    },
  ];

  const offers = [
    {
      title: 'Magazin selectat',
      description: 'Răsfoiește colecția noastră extinsă de monede autentificate din întreaga lume, de la antichitate până în timpurile moderne.',
    },
    {
      title: 'Licitații live',
      description: 'Participă la licitații interesante pentru piese rare și valoroase, cu licitare în timp real și procese transparente.',
    },
    {
      title: 'Evaluări de experți',
      description: 'Obține evaluări profesionale și certificări pentru colecția ta de la echipa noastră de numismați experimentați.',
    },
    {
      title: 'Comunitate pentru colecționari',
      description: 'Un spațiu dedicat numismaticii, unde găsești piese verificate, licitații organizate și o experiență simplă de cumpărare și vânzare, fără complicații.',
    },
  ];

  return (
    <WebContainer>
      <ScrollView
        style={aboutStyles.scrollContainer}
        contentContainerStyle={aboutStyles.scrollContent}
      >
        <View style={aboutStyles.content}>
          {/* Hero Section */}
          <View style={aboutStyles.heroContainer}>
            <Text style={aboutStyles.heroTitle}>Despre eNumismatica</Text>
            <Text style={aboutStyles.heroSubtitle}>
              Partenerul tău de încredere în colecționarea numismatică din 2025
            </Text>
          </View>

          {/* Our Story */}
          <View style={aboutStyles.section}>
            <Text style={aboutStyles.sectionTitle}>Povestea noastră</Text>
            <View style={aboutStyles.sectionContent}>
              <Text style={aboutStyles.sectionText}>
                eNumismatica a fost fondată cu pasiunea de a păstra istoria prin monede și valută. Ceea ce a început ca o colecție mică a crescut până la a deveni platforma numismatică de top din România, conectând colecționari, entuziaști și istorici din întreaga lume.
              </Text>
              <Text style={aboutStyles.sectionText}>
                Platforma noastră combină expertiza numismatică tradițională cu tehnologia modernă, oferind atât un magazin selectat, cât și oportunități interesante de licitație. Fie că ești un colecționar experimentat sau abia începi călătoria în fascinanta lume a monedelor, suntem aici să te ajutăm să descoperi, să achiziționezi și să apreciezi aceste piese tangibile de istorie.
              </Text>
              <Text style={aboutStyles.sectionText}>
                Fiecare monedă spune o poveste - despre imperii ridicate și căzute, despre revoluții economice, despre realizări artistice și despre civilizația umană însăși. La eNumismatica, suntem dedicați să te ajutăm să descoperi aceste povești și să construiești o colecție care reflectă pasiunea și interesele tale.
              </Text>
            </View>
          </View>

          {/* Our Values */}
          <View style={aboutStyles.section}>
            <Text style={aboutStyles.sectionTitle}>Valorile noastre</Text>
            <View style={aboutStyles.valuesGrid}>
              {values.map((value) => (
                <View key={value.title} style={aboutStyles.valueCard}>
                  <ValueIcon name={value.icon} />
                  <Text style={aboutStyles.valueTitle}>{value.title}</Text>
                  <Text style={aboutStyles.valueDescription}>{value.description}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* What We Offer */}
          <View style={aboutStyles.section}>
            <Text style={aboutStyles.sectionTitle}>Ce oferim</Text>
            <View style={aboutStyles.valuesGrid}>
              {offers.map((offer, index) => (
                <View key={offer.title} style={aboutStyles.offerCard}>
                  <OfferIcon index={index} />
                  <View style={{ flex: 1 }}>
                    <Text style={aboutStyles.offerTitle}>{offer.title}</Text>
                    <Text style={aboutStyles.offerDescription}>{offer.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Statistics */}
          <View style={aboutStyles.section}>
            <Text style={aboutStyles.sectionTitle}>Statistici</Text>
            <View style={aboutStyles.statsContainer}>
              <View style={aboutStyles.statsGrid}>
                <View style={aboutStyles.statItem}>
                  <Text style={aboutStyles.statValue}>{stats.totalProducts.toLocaleString()}</Text>
                  <Text style={aboutStyles.statLabel}>Monede listate</Text>
                </View>
                <View style={aboutStyles.statItem}>
                  <Text style={aboutStyles.statValue}>{stats.totalUsers.toLocaleString()}</Text>
                  <Text style={aboutStyles.statLabel}>Colecționari</Text>
                </View>
                <View style={aboutStyles.statItem}>
                  <Text style={aboutStyles.statValue}>{stats.totalCountries.toLocaleString()}</Text>
                  <Text style={aboutStyles.statLabel}>Țări</Text>
                </View>
                <View style={aboutStyles.statItem}>
                  <Text style={aboutStyles.statValue}>{stats.authenticated}%</Text>
                  <Text style={aboutStyles.statLabel}>Autentificate</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Call to Action */}
          <View style={aboutStyles.section}>
            <Text style={aboutStyles.sectionTitle}>Gata să-ți începi colecția?</Text>
            <View style={aboutStyles.sectionContent}>
              <Text style={aboutStyles.sectionText}>
                Alătură-te comunității de colecționari care aleg eNumismatica pentru piese verificate și tranzacții sigure. Răsfoiește selecția noastră sau intră în următoarea licitație.
              </Text>
              <View style={aboutStyles.ctaButtons}>
                <TouchableOpacity
                  style={aboutStyles.primaryButton}
                  onPress={() => navigation.navigate('ProductCatalog' as never)}
                >
                  <Text style={aboutStyles.buttonText}>Răsfoiește colecția</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={aboutStyles.secondaryButton}
                  onPress={() => navigation.navigate('AuctionList' as never)}
                >
                  <Text style={aboutStyles.secondaryButtonText}>Vezi licitațiile</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </WebContainer>
  );
};

export default AboutScreen;