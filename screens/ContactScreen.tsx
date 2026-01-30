import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { sharedStyles, colors } from '../styles/sharedStyles';
import { Ionicons } from '@expo/vector-icons';
import InlineBackButton from '../components/InlineBackButton';

const ContactScreen: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    // Here you would typically send the form data to your backend
    console.log('Form submitted:', formData);
    setSubmitted(true);
    
    // Show success message
    Alert.alert('Succes', 'Mesajul tău a fost trimis cu succes!');
    
    // Reset form after 3 seconds
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  const handleChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleEmailPress = () => {
    Linking.openURL('mailto:contact@enumismatica.ro');
  };

  const handlePhonePress = () => {
    Linking.openURL('tel:+40212345678');
  };

  // Web-specific styling adjustments
  const isWeb = Platform.OS === 'web';

  // Contact screen specific styles
  const contactStyles = StyleSheet.create({
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
      marginBottom: 24,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 12,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    contactInfoContainer: {
      marginBottom: 24,
    },
    contactInfoCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
    },
    contactInfoTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 16,
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    contactIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(231, 183, 60, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactItemContent: {
      flex: 1,
    },
    contactItemLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    contactItemValue: {
      fontSize: 14,
      color: colors.primary,
    },
    formContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
    },
    formTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 16,
      textAlign: 'center',
    },
    successMessage: {
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    successText: {
      color: '#10b981',
      fontSize: 14,
      fontWeight: '600',
    },
    input: {
      width: '100%',
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      color: colors.textPrimary,
      fontSize: 14,
    },
    textarea: {
      width: '100%',
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      color: colors.textPrimary,
      fontSize: 14,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    submitButton: {
      width: '100%',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
    submitButtonText: {
      color: colors.primaryText,
      fontWeight: '600',
      fontSize: 16,
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

  return (
    <WebContainer>
      <ScrollView
        style={contactStyles.scrollContainer}
        contentContainerStyle={contactStyles.scrollContent}
      >
        <View style={contactStyles.content}>
          <View style={{ marginBottom: 12 }}>
            <InlineBackButton />
          </View>
          {/* Header */}
          <View style={contactStyles.header}>
            <Text style={contactStyles.headerTitle}>Contactează-ne</Text>
            <Text style={contactStyles.headerSubtitle}>
              Aveți întrebări despre colecția noastră numismatică? Ne-ar plăcea să auzim de la voi. Trimite-ne un mesaj și vom răspunde cât mai curând posibil.
            </Text>
          </View>

          {/* Contact Information */}
          <View style={contactStyles.contactInfoContainer}>
            <View style={contactStyles.contactInfoCard}>
              <Text style={contactStyles.contactInfoTitle}>Contactează-ne</Text>

              <View style={contactStyles.contactItem}>
                <View style={contactStyles.contactIcon}>
                  <Ionicons name="location-outline" size={20} color="#e7b73c" />
                </View>
                <View style={contactStyles.contactItemContent}>
                  <Text style={contactStyles.contactItemLabel}>Adresă</Text>
                  <Text style={{ ...contactStyles.contactItemValue, color: colors.textPrimary }}>București, România</Text>
                </View>
              </View>

              <View style={contactStyles.contactItem}>
                <View style={contactStyles.contactIcon}>
                  <Ionicons name="mail-outline" size={20} color="#e7b73c" />
                </View>
                <View style={contactStyles.contactItemContent}>
                  <Text style={contactStyles.contactItemLabel}>Email</Text>
                  <TouchableOpacity onPress={handleEmailPress}>
                    <Text style={contactStyles.contactItemValue}>contact@enumismatica.ro</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={contactStyles.contactItem}>
                <View style={contactStyles.contactIcon}>
                  <Ionicons name="call-outline" size={20} color="#e7b73c" />
                </View>
                <View style={contactStyles.contactItemContent}>
                  <Text style={contactStyles.contactItemLabel}>Telefon</Text>
                  <TouchableOpacity onPress={handlePhonePress}>
                    <Text style={contactStyles.contactItemValue}>+40 (21) 234-5678</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={contactStyles.contactItem}>
                <View style={contactStyles.contactIcon}>
                  <Ionicons name="time-outline" size={20} color="#e7b73c" />
                </View>
                <View style={contactStyles.contactItemContent}>
                  <Text style={contactStyles.contactItemLabel}>Program</Text>
                  <Text style={{ ...contactStyles.contactItemValue, color: colors.textPrimary, fontSize: 12 }}>
                    Luni - Vineri: 9:00 - 18:00
                    {'\n'}Sâmbătă: 10:00 - 16:00
                    {'\n'}Duminică: Închis
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contact Form */}
          <View style={contactStyles.formContainer}>
            <Text style={contactStyles.formTitle}>Trimite-ne un mesaj</Text>

            {submitted && (
              <View style={contactStyles.successMessage}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
                <Text style={contactStyles.successText}>Mulțumim! Mesajul tău a fost trimis cu succes.</Text>
              </View>
            )}

            <View>
              <Text style={contactStyles.inputLabel}>Numele tău *</Text>
              <TextInput
                style={contactStyles.input}
                placeholder="Ion Popescu"
                placeholderTextColor="#94a3b8"
                value={formData.name}
                onChangeText={(text) => handleChange('name', text)}
              />
            </View>

            <View>
              <Text style={contactStyles.inputLabel}>Adresă de email *</Text>
              <TextInput
                style={contactStyles.input}
                placeholder="ion@exemplu.com"
                placeholderTextColor="#94a3b8"
                value={formData.email}
                onChangeText={(text) => handleChange('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text style={contactStyles.inputLabel}>Subiect *</Text>
              <TextInput
                style={contactStyles.input}
                placeholder="Cum te putem ajuta?"
                placeholderTextColor="#94a3b8"
                value={formData.subject}
                onChangeText={(text) => handleChange('subject', text)}
              />
            </View>

            <View>
              <Text style={contactStyles.inputLabel}>Mesaj *</Text>
              <TextInput
                style={contactStyles.textarea}
                placeholder="Spune-ne mai multe despre întrebarea ta..."
                placeholderTextColor="#94a3b8"
                value={formData.message}
                onChangeText={(text) => handleChange('message', text)}
                multiline
              />
            </View>

            <TouchableOpacity
              style={contactStyles.submitButton}
              onPress={handleSubmit}
              disabled={submitted}
            >
              <Text style={contactStyles.submitButtonText}>Trimite mesaj</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </WebContainer>
  );
};

export default ContactScreen;