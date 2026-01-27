import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../context/AuthContext';
import { formatEUR } from '../utils/currency';
import { sharedStyles } from '../styles/sharedStyles';

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
      Alert.alert('Eroare', 'Vă rugăm introduceți numele dvs.');
      return false;
    }
    if (!shippingInfo.address.trim()) {
      Alert.alert('Eroare', 'Vă rugăm introduceți adresa');
      return false;
    }
    if (!shippingInfo.city.trim()) {
      Alert.alert('Eroare', 'Vă rugăm introduceți orașul');
      return false;
    }
    if (!shippingInfo.postalCode.trim()) {
      Alert.alert('Eroare', 'Vă rugăm introduceți codul poștal');
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
        'Comanda dvs. a fost plasată cu succes!',
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
        'A apărut o eroare la procesarea comenzii. Vă rugăm încercați din nou.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <View className="flex-1 bg-navy-900 p-4">
        <Text className="text-slate-100 text-lg font-semibold mb-4">
          Coșul de cumpărături este gol
        </Text>
			<TouchableOpacity
				className="bg-gold-500 py-3 px-6 rounded-lg"
				onPress={() => (navigation as any).navigate('MainTabs', { screen: 'ProductCatalog' })}
			>
          <Text className="text-navy-900 font-semibold">
            Continuă cumpărăturile
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-navy-900 p-4">
      <Text className="text-slate-100 text-2xl font-bold mb-6">
        Finalizare comandă
      </Text>

      {/* Shipping Information */}
      <View className="bg-navy-800 rounded-xl p-4 mb-6">
        <Text className="text-slate-100 text-lg font-semibold mb-4">
          Informații de livrare
        </Text>

        <View className="mb-4">
          <Text className="text-slate-300 mb-2">Nume complet</Text>
          <TextInput
            className="bg-navy-700 text-slate-100 rounded-lg px-3 py-2 border border-slate-600"
            value={shippingInfo.name}
            onChangeText={(text) => handleInputChange('name', text)}
            placeholder="Nume complet"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View className="mb-4">
          <Text className="text-slate-300 mb-2">Adresă</Text>
          <TextInput
            className="bg-navy-700 text-slate-100 rounded-lg px-3 py-2 border border-slate-600"
            value={shippingInfo.address}
            onChangeText={(text) => handleInputChange('address', text)}
            placeholder="Adresă"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View className="mb-4">
          <Text className="text-slate-300 mb-2">Oraș</Text>
          <TextInput
            className="bg-navy-700 text-slate-100 rounded-lg px-3 py-2 border border-slate-600"
            value={shippingInfo.city}
            onChangeText={(text) => handleInputChange('city', text)}
            placeholder="Oraș"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View className="flex-row gap-4">
          <View className="flex-1">
            <Text className="text-slate-300 mb-2">Cod poștal</Text>
            <TextInput
              className="bg-navy-700 text-slate-100 rounded-lg px-3 py-2 border border-slate-600"
              value={shippingInfo.postalCode}
              onChangeText={(text) => handleInputChange('postalCode', text)}
              placeholder="Cod poștal"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <Text className="text-slate-300 mb-2">Țară</Text>
            <TextInput
              className="bg-navy-700 text-slate-100 rounded-lg px-3 py-2 border border-slate-600"
              value={shippingInfo.country}
              onChangeText={(text) => handleInputChange('country', text)}
              placeholder="Țară"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>
      </View>

      {/* Payment Method */}
      <View className="bg-navy-800 rounded-xl p-4 mb-6">
        <Text className="text-slate-100 text-lg font-semibold mb-4">
          Metodă de plată
        </Text>

        <View className="flex-row gap-4">
          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg border ${paymentMethod === 'card' ? 'bg-gold-500 border-gold-400' : 'bg-navy-700 border-slate-600'}`}
            onPress={() => setPaymentMethod('card')}
          >
            <Text className={`text-center font-semibold ${paymentMethod === 'card' ? 'text-navy-900' : 'text-slate-100'}`}>
              Card
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg border ${paymentMethod === 'bank' ? 'bg-gold-500 border-gold-400' : 'bg-navy-700 border-slate-600'}`}
            onPress={() => setPaymentMethod('bank')}
          >
            <Text className={`text-center font-semibold ${paymentMethod === 'bank' ? 'text-navy-900' : 'text-slate-100'}`}>
              Transfer bancar
            </Text>
          </TouchableOpacity>
        </View>

        {paymentMethod === 'card' && (
          <View className="mt-4">
            <Text className="text-slate-300 mb-2">Detalii card</Text>
            <View className="bg-navy-700 rounded-lg p-3 border border-slate-600">
              <Text className="text-slate-400">
                Plata cu cardul se va procesa în siguranță prin intermediul platformei noastre de plăți.
              </Text>
            </View>
          </View>
        )}

        {paymentMethod === 'bank' && (
          <View className="mt-4">
            <Text className="text-slate-300 mb-2">Instrucțiuni transfer bancar</Text>
            <View className="bg-navy-700 rounded-lg p-3 border border-slate-600">
              <Text className="text-slate-400">
                Veți primi instrucțiuni detaliate pentru transferul bancar după plasarea comenzii.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Order Summary */}
      <View className="bg-navy-800 rounded-xl p-4 mb-8">
        <Text className="text-slate-100 text-lg font-semibold mb-4">
          Rezumat comandă
        </Text>

					{cart.map((item: any) => (
          <View key={item.id} className="flex-row justify-between items-center py-2 border-b border-slate-700">
            <View className="flex-1">
              <Text className="text-slate-100 font-medium" numberOfLines={1}>
                {item.name}
              </Text>
				<Text className="text-slate-400 text-sm">
					{item.quantity} x {formatEUR(item.price)}
				</Text>
            </View>
				<Text className="text-slate-100 font-semibold">
					{formatEUR(item.price * item.quantity)}
				</Text>
          </View>
        ))}

        <View className="flex-row justify-between items-center py-3 mt-4 border-t border-slate-700">
          <Text className="text-slate-100 font-semibold">Total</Text>
			<Text className="text-gold-500 text-xl font-bold">
				{formatEUR(calculateTotal())}
			</Text>
        </View>
      </View>

      {/* Checkout Button */}
      <TouchableOpacity
        className={`w-full py-4 rounded-xl ${isLoading ? 'bg-gold-600' : 'bg-gold-500'} shadow-md shadow-[0_0_18px_rgba(231,183,60,0.6)]`}
        onPress={handleCheckout}
        disabled={isLoading}
      >
        <Text className="text-navy-900 text-center font-bold text-lg">
          {isLoading ? 'Procesare...' : 'Plasează comanda'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
