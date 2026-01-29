import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../context/AuthContext';
import { formatEUR } from '../utils/currency';
import { colors, sharedStyles } from '../styles/sharedStyles';
import InlineBackButton from '../components/InlineBackButton';

export default function CheckoutScreen() {
	const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
	const { user } = useAuth();
	const { items, clearCart } = useCart(user?.uid);
	const cart = items as any[];
  const [shippingInfo, setShippingInfo] = useState({
    name: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'Romania',
  });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setShippingInfo(prev => ({
        ...prev,
        name: user.displayName || '',
      }));
    }
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setShippingInfo(prev => ({
      ...prev,
      [field]: value,
    }));
  };

	const calculateTotal = () => {
		return cart.reduce((total: number, item: any) => total + item.price * item.quantity, 0);
	};

  const validateForm = () => {
    if (!shippingInfo.name.trim()) {
      Alert.alert('Eroare', 'Este necesară introducerea numelui.');
      return false;
    }
    if (!shippingInfo.address.trim()) {
      Alert.alert('Eroare', 'Este necesară introducerea adresei.');
      return false;
    }
    if (!shippingInfo.city.trim()) {
      Alert.alert('Eroare', 'Este necesară introducerea orașului.');
      return false;
    }
    if (!shippingInfo.postalCode.trim()) {
      Alert.alert('Eroare', 'Este necesară introducerea codului poștal.');
      return false;
    }
    return true;
  };

  const handleCheckout = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Simulate checkout process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In a real app, you would call your backend API here
      // const response = await checkoutService.processCheckout({
      //   userId: user?.uid,
      //   items: cart,
      //   shippingInfo,
      //   paymentMethod,
      //   total: calculateTotal(),
      // });

      Alert.alert(
        'Succes',
        'Comanda a fost plasată cu succes!',
        [
          {
						text: 'OK',
						onPress: () => {
							clearCart();
							(navigation as any).navigate('MainTabs', { screen: 'OrderHistory' });
						},
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Eroare',
        'A apărut o eroare la procesarea comenzii. Se recomandă reîncercarea.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <View style={styles.cartEmptyContainer}>
        <Text style={styles.cartEmptyTitle}>Coșul de cumpărături este gol</Text>
        <TouchableOpacity
          style={styles.cartEmptyButton}
          onPress={() => (navigation as any).navigate('MainTabs', { screen: 'ProductCatalog' })}
        >
        <Text style={styles.cartEmptyButtonText}>Cumpărături</Text>
      </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <InlineBackButton />
      <Text style={styles.headerTitle}>
        Finalizare comandă
      </Text>

      {/* Shipping Information */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Informații de livrare
        </Text>

        <View style={styles.formControl}>
          <Text style={styles.label}>Nume complet</Text>
          <TextInput
            style={styles.input}
            value={shippingInfo.name}
            onChangeText={(text) => handleInputChange('name', text)}
            placeholder="Nume complet"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.formControl}>
          <Text style={styles.label}>Adresă</Text>
          <TextInput
            style={styles.input}
            value={shippingInfo.address}
            onChangeText={(text) => handleInputChange('address', text)}
            placeholder="Adresă"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.formControl}>
          <Text style={styles.label}>Oraș</Text>
          <TextInput
            style={styles.input}
            value={shippingInfo.city}
            onChangeText={(text) => handleInputChange('city', text)}
            placeholder="Oraș"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.rowGap}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Cod poștal</Text>
            <TextInput
              style={styles.input}
              value={shippingInfo.postalCode}
              onChangeText={(text) => handleInputChange('postalCode', text)}
              placeholder="Cod poștal"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Țară</Text>
            <TextInput
              style={styles.input}
              value={shippingInfo.country}
              onChangeText={(text) => handleInputChange('country', text)}
              placeholder="Țară"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>
      </View>

      {/* Payment Method */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Metodă de plată
        </Text>

        <View style={styles.rowGap}>
          <TouchableOpacity
            style={[styles.paymentButton, paymentMethod === 'card' ? styles.paymentButtonActive : styles.paymentButtonInactive]}
            onPress={() => setPaymentMethod('card')}
          >
            <Text style={[styles.paymentButtonText, paymentMethod === 'card' ? styles.paymentButtonTextActive : styles.paymentButtonTextInactive]}>
              Card
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentButton, paymentMethod === 'bank' ? styles.paymentButtonActive : styles.paymentButtonInactive]}
            onPress={() => setPaymentMethod('bank')}
          >
            <Text style={[styles.paymentButtonText, paymentMethod === 'bank' ? styles.paymentButtonTextActive : styles.paymentButtonTextInactive]}>
              Transfer bancar
            </Text>
          </TouchableOpacity>
        </View>

        {paymentMethod === 'card' && (
          <View style={styles.paymentInfoBlock}>
            <Text style={styles.label}>Detalii card</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                Plata cu cardul se va procesa în siguranță prin intermediul platformei noastre de plăți.
              </Text>
            </View>
          </View>
        )}

        {paymentMethod === 'bank' && (
          <View style={styles.paymentInfoBlock}>
            <Text style={styles.label}>Instrucțiuni transfer bancar</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                Instrucțiunile pentru transfer bancar sunt trimise după plasarea comenzii.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Order Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Rezumat comandă
        </Text>

        {cart.map((item: any) => (
          <View key={item.id} style={styles.summaryRow}>
            <View style={styles.flex1}>
              <Text style={styles.summaryItemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.summaryItemDetails}>
                {item.quantity} x {formatEUR(item.price)}
              </Text>
            </View>
            <Text style={styles.summaryItemTotal}>{formatEUR(item.price * item.quantity)}</Text>
          </View>
        ))}

        <View style={styles.summaryTotalRow}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>{formatEUR(calculateTotal())}</Text>
        </View>
      </View>

      {/* Checkout Button */}
      <TouchableOpacity
        style={[styles.checkoutButton, isLoading && styles.checkoutButtonDisabled]}
        onPress={handleCheckout}
        disabled={isLoading}
      >
        <Text style={styles.checkoutButtonText}>
          {isLoading ? 'Procesare...' : 'Plasare comandă'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cartEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cartEmptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  cartEmptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cartEmptyButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContent: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  formControl: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  rowGap: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  paymentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentButtonActive: {
    backgroundColor: colors.primary,
  },
  paymentButtonInactive: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  paymentButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  paymentButtonTextActive: {
    color: colors.primaryText,
  },
  paymentButtonTextInactive: {
    color: colors.textSecondary,
  },
  paymentInfoBlock: {
    marginTop: 16,
  },
  infoBox: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  infoBoxText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  summaryItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  summaryItemDetails: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  summaryItemTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: colors.borderColor,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  checkoutButtonDisabled: {
    backgroundColor: colors.disabledButton,
  },
  checkoutButtonText: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
