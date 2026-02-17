import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../hooks/useProducts';
import { createDirectOrderForProduct } from '@shared/orderService';
import { formatEUR, formatRON } from '../utils/currency';
import { colors, sharedStyles } from '../styles/sharedStyles';
import InlineBackButton from '../components/InlineBackButton';
import { Ionicons } from '@expo/vector-icons';

type CheckoutRouteProp = RouteProp<RootStackParamList, 'Checkout'>;
type CheckoutNavigationProp = StackNavigationProp<RootStackParamList>;

// Checkout steps
type CheckoutStep = 'shipping' | 'payment' | 'review' | 'confirmation';

interface ShippingInfo {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
}

interface CheckoutProduct {
  id: string;
  name: string;
  price: number;
  images: string[];
  isMintProduct?: boolean;
  mintProductData?: any;
}

export default function CheckoutScreen() {
  const navigation = useNavigation<CheckoutNavigationProp>();
  const route = useRoute<CheckoutRouteProp>();
  const { user } = useAuth();
  const { items, clearCart } = useCart(user?.uid);
  const cartItems = items as any[];

  // Get products from route params or cart
  const routeProductId = route.params?.productId;
  const routeProductIds = route.params?.productIds;
  const routeCartItems = route.params?.cartItems;

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping');
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    name: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'Romania',
    phone: '',
    email: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');
  const [isLoading, setIsLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingInfo, string>>>({});

  // Fetch products
  const { products } = useProducts({
    pageSize: 200,
    fields: ['name', 'images', 'price', 'createdAt', 'updatedAt'],
  });

  const parseMintPrice = (price: unknown): number => {
    if (typeof price === 'number') return price;
    if (typeof price !== 'string') return 0;
    const cleaned = price.replace(/[\s\u00A0]/g, '').replace(/\./g, '').replace(',', '.');
    const numeric = Number(cleaned.replace(/[^\d.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  };

  // Determine which products to checkout
  const checkoutProducts = useMemo(() => {
    const result: CheckoutProduct[] = [];
    
    // If single product from route
    if (routeProductId) {
      const product = products.find(p => p.id === routeProductId);
      if (product) {
        result.push({
          id: product.id,
          name: product.name,
          price: product.price,
          images: product.images || [],
        });
      }
    }
    // If multiple products from route
    else if (routeProductIds && routeProductIds.length > 0) {
      routeProductIds.forEach(id => {
        const product = products.find(p => p.id === id);
        if (product) {
          result.push({
            id: product.id,
            name: product.name,
            price: product.price,
            images: product.images || [],
          });
        }
      });
    }
    // If cart items from route (for Monetaria Statului products)
    else if (routeCartItems && routeCartItems.length > 0) {
      routeCartItems.forEach(item => {
        if (item.isMintProduct) {
          result.push({
            id: item.productId,
            name: item.mintProductData?.title || 'Produs Monetaria Statului',
            price: parseMintPrice(item.mintProductData?.price) || 0,
            images: [],
            isMintProduct: true,
            mintProductData: item.mintProductData,
          });
        } else {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            result.push({
              id: product.id,
              name: product.name,
              price: product.price,
              images: product.images || [],
            });
          }
        }
      });
    }
    // Otherwise use cart items
    else {
      cartItems.forEach(item => {
        if (item.isMintProduct) {
          result.push({
            id: item.productId,
            name: item.mintProductData?.title || 'Produs Monetaria Statului',
            price: parseMintPrice(item.mintProductData?.price) || 0,
            images: [],
            isMintProduct: true,
            mintProductData: item.mintProductData,
          });
        } else {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            result.push({
              id: product.id,
              name: product.name,
              price: product.price,
              images: product.images || [],
            });
          }
        }
      });
    }

    return result;
  }, [routeProductId, routeProductIds, routeCartItems, cartItems, products]);

  const totalAmount = useMemo(() => {
    return checkoutProducts.reduce((sum, p) => sum + p.price, 0);
  }, [checkoutProducts]);

  // Initialize shipping info from user data
  useEffect(() => {
    if (user) {
      setShippingInfo(prev => ({
        ...prev,
        name: user.displayName || '',
        email: user.email || '',
      }));
    }
  }, [user]);

  const handleInputChange = (field: keyof ShippingInfo, value: string) => {
    setShippingInfo(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateShipping = (): boolean => {
    const newErrors: Partial<Record<keyof ShippingInfo, string>> = {};

    if (!shippingInfo.name.trim()) {
      newErrors.name = 'Este necesară introducerea numelui.';
    }
    if (!shippingInfo.address.trim()) {
      newErrors.address = 'Este necesară introducerea adresei.';
    }
    if (!shippingInfo.city.trim()) {
      newErrors.city = 'Este necesară introducerea orașului.';
    }
    if (!shippingInfo.postalCode.trim()) {
      newErrors.postalCode = 'Este necesară introducerea codului poștal.';
    }
    if (!shippingInfo.phone.trim()) {
      newErrors.phone = 'Este necesară introducerea numărului de telefon.';
    }
    if (!shippingInfo.email.trim()) {
      newErrors.email = 'Este necesară introducerea adresei de email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingInfo.email)) {
      newErrors.email = 'Adresa de email nu este validă.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 'shipping') {
      if (validateShipping()) {
        setCurrentStep('payment');
      }
    } else if (currentStep === 'payment') {
      setCurrentStep('review');
    } else if (currentStep === 'review') {
      handlePlaceOrder();
    }
  };

  const handleBack = () => {
    if (currentStep === 'payment') {
      setCurrentStep('shipping');
    } else if (currentStep === 'review') {
      setCurrentStep('payment');
    } else if (currentStep === 'confirmation') {
      navigation.navigate('OrderHistory');
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      Alert.alert('Autentificare necesară', 'Este necesară autentificarea pentru a plasa comanda.');
      return;
    }

    setIsLoading(true);

    try {
      // Create orders for each product
      const orderIds: string[] = [];

      for (const product of checkoutProducts) {
        const orderId = await createDirectOrderForProduct(
          product.id,
          user.uid,
          product.isMintProduct,
          product.mintProductData,
        );
        orderIds.push(orderId);
      }

      // Clear cart if we used cart items
      if (!routeProductId && !routeProductIds) {
        await clearCart();
      }

      setOrderId(orderIds[0]);
      setCurrentStep('confirmation');
    } catch (error: any) {
      console.error('Failed to place order:', error);
      Alert.alert(
        'Eroare',
        error?.message || 'A apărut o eroare la procesarea comenzii. Se recomandă reîncercarea.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewOrderHistory = () => {
    navigation.navigate('OrderHistory');
  };

  const steps = [
    { key: 'shipping', label: 'Livrare' },
    { key: 'payment', label: 'Plată' },
    { key: 'review', label: 'Revizuire' },
    { key: 'confirmation', label: 'Confirmare' },
  ];

  const getStepIndex = (step: CheckoutStep): number => {
    return steps.findIndex(s => s.key === step);
  };

  const currentStepIndex = getStepIndex(currentStep);

  // Empty state
  if (checkoutProducts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={64} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>Coșul de cumpărături este gol</Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation.navigate('MainTabs', { screen: 'ProductCatalog' })}
        >
          <Text style={styles.emptyButtonText}>Cumpărături</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <InlineBackButton />
          <Text style={styles.headerTitle}>Finalizare comandă</Text>
        </View>

        {/* Stepper */}
        <View style={styles.stepperContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepperScroll}>
            <View style={styles.stepper}>
              {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isPending = index > currentStepIndex;

                return (
                  <View key={step.key} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        isCompleted && styles.stepCircleCompleted,
                        isCurrent && styles.stepCircleCurrent,
                        isPending && styles.stepCirclePending,
                      ]}
                    >
                      {isCompleted ? (
                        <Ionicons name="checkmark" size={16} color={colors.primaryText} />
                      ) : (
                        <Text
                          style={[
                            styles.stepNumber,
                            isCurrent && styles.stepNumberCurrent,
                            isPending && styles.stepNumberPending,
                          ]}
                        >
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        isCurrent && styles.stepLabelCurrent,
                        isPending && styles.stepLabelPending,
                      ]}
                    >
                      {step.label}
                    </Text>
                    {index < steps.length - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          isCompleted && styles.stepLineCompleted,
                          isPending && styles.stepLinePending,
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {currentStep === 'shipping' && (
            <ShippingStep
              shippingInfo={shippingInfo}
              errors={errors}
              onInputChange={handleInputChange}
            />
          )}

          {currentStep === 'payment' && (
            <PaymentStep
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
            />
          )}

          {currentStep === 'review' && (
            <ReviewStep
              products={checkoutProducts}
              shippingInfo={shippingInfo}
              paymentMethod={paymentMethod}
              totalAmount={totalAmount}
            />
          )}

          {currentStep === 'confirmation' && (
            <ConfirmationStep orderId={orderId} />
          )}
        </ScrollView>

        {/* Footer */}
        {currentStep !== 'confirmation' && (
          <View style={styles.footer}>
            {currentStep !== 'shipping' && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                disabled={isLoading}
              >
                <Text style={styles.backButtonText}>Înapoi</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.nextButton, isLoading && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primaryText} />
              ) : (
                <Text style={styles.nextButtonText}>
                  {currentStep === 'review' ? 'Plasează comanda' : 'Continuă'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

// Shipping Step Component
function ShippingStep({
  shippingInfo,
  errors,
  onInputChange,
}: {
  shippingInfo: ShippingInfo;
  errors: Partial<Record<keyof ShippingInfo, string>>;
  onInputChange: (field: keyof ShippingInfo, value: string) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Informații de livrare</Text>
      <Text style={styles.stepDescription}>
        Completați adresa de livrare pentru a primi produsele comandate.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Nume complet *</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          value={shippingInfo.name}
          onChangeText={(text) => onInputChange('name', text)}
          placeholder="Nume complet"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="next"
          blurOnSubmit={false}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Adresă *</Text>
        <TextInput
          style={[styles.input, errors.address && styles.inputError]}
          value={shippingInfo.address}
          onChangeText={(text) => onInputChange('address', text)}
          placeholder="Stradă, număr, apartament"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="next"
          blurOnSubmit={false}
        />
        {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, styles.formGroupHalf]}>
          <Text style={styles.label}>Oraș *</Text>
          <TextInput
            style={[styles.input, errors.city && styles.inputError]}
            value={shippingInfo.city}
            onChangeText={(text) => onInputChange('city', text)}
            placeholder="Oraș"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="next"
            blurOnSubmit={false}
          />
          {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
        </View>

        <View style={[styles.formGroup, styles.formGroupHalf]}>
          <Text style={styles.label}>Cod poștal *</Text>
          <TextInput
            style={[styles.input, errors.postalCode && styles.inputError]}
            value={shippingInfo.postalCode}
            onChangeText={(text) => onInputChange('postalCode', text)}
            placeholder="Cod poștal"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            returnKeyType="next"
            blurOnSubmit={false}
          />
          {errors.postalCode && <Text style={styles.errorText}>{errors.postalCode}</Text>}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Țară</Text>
        <TextInput
          style={styles.input}
          value={shippingInfo.country}
          onChangeText={(text) => onInputChange('country', text)}
          placeholder="Țară"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="next"
          blurOnSubmit={false}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Telefon *</Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          value={shippingInfo.phone}
          onChangeText={(text) => onInputChange('phone', text)}
          placeholder="Număr de telefon"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
          returnKeyType="next"
          blurOnSubmit={false}
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          value={shippingInfo.email}
          onChangeText={(text) => onInputChange('email', text)}
          placeholder="Adresa de email"
          placeholderTextColor={colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit={true}
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>
    </View>
  );
}

// Payment Step Component
function PaymentStep({
  paymentMethod,
  onPaymentMethodChange,
}: {
  paymentMethod: 'card' | 'bank';
  onPaymentMethodChange: (method: 'card' | 'bank') => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Metodă de plată</Text>
      <Text style={styles.stepDescription}>
        Alegeți metoda de plată preferată pentru această comandă.
      </Text>

      <TouchableOpacity
        style={[
          styles.paymentOption,
          paymentMethod === 'card' && styles.paymentOptionSelected,
        ]}
        onPress={() => onPaymentMethodChange('card')}
      >
        <View style={styles.paymentOptionLeft}>
          <View style={styles.paymentIcon}>
            <Ionicons name="card-outline" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.paymentOptionTitle}>Card bancar</Text>
            <Text style={styles.paymentOptionDescription}>
              Plată securizată prin card
            </Text>
          </View>
        </View>
        <View style={styles.paymentRadio}>
          {paymentMethod === 'card' && (
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.paymentOption,
          paymentMethod === 'bank' && styles.paymentOptionSelected,
        ]}
        onPress={() => onPaymentMethodChange('bank')}
      >
        <View style={styles.paymentOptionLeft}>
          <View style={styles.paymentIcon}>
            <Ionicons name="business-outline" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.paymentOptionTitle}>Transfer bancar</Text>
            <Text style={styles.paymentOptionDescription}>
              Instrucțiuni de transfer după plasarea comenzii
            </Text>
          </View>
        </View>
        <View style={styles.paymentRadio}>
          {paymentMethod === 'bank' && (
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          )}
        </View>
      </TouchableOpacity>

      {paymentMethod === 'card' && (
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentInfoTitle}>Informații despre plată</Text>
          <Text style={styles.paymentInfoText}>
            Plata cu cardul se va procesa în siguranță prin intermediul platformei noastre de plăți.
            Nu stocăm informațiile cardului dvs.
          </Text>
        </View>
      )}

      {paymentMethod === 'bank' && (
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentInfoTitle}>Instrucțiuni transfer bancar</Text>
          <Text style={styles.paymentInfoText}>
            După plasarea comenzii, veți primi instrucțiunile complete pentru transferul bancar,
            inclusiv contul IBAN și detaliile necesare.
          </Text>
        </View>
      )}
    </View>
  );
}

// Review Step Component
function ReviewStep({
  products,
  shippingInfo,
  paymentMethod,
  totalAmount,
}: {
  products: CheckoutProduct[];
  shippingInfo: ShippingInfo;
  paymentMethod: 'card' | 'bank';
  totalAmount: number;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Revizuirea comenzii</Text>
      <Text style={styles.stepDescription}>
        Verificați detaliile comenzii înainte de a o plasa.
      </Text>

      {/* Products */}
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Produse ({products.length})</Text>
        {products.map((product) => (
          <View key={product.id} style={styles.reviewProduct}>
            {product.images.length > 0 ? (
              <Image source={{ uri: product.images[0] }} style={styles.reviewProductImage} />
            ) : (
              <View style={styles.reviewProductImagePlaceholder}>
                <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.reviewProductInfo}>
              <Text style={styles.reviewProductName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.reviewProductPrice}>
                {product.isMintProduct ? formatRON(product.price) : formatEUR(product.price)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Shipping Info */}
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Adresa de livrare</Text>
        <View style={styles.reviewInfo}>
          <Text style={styles.reviewInfoText}>{shippingInfo.name}</Text>
          <Text style={styles.reviewInfoText}>{shippingInfo.address}</Text>
          <Text style={styles.reviewInfoText}>
            {shippingInfo.city}, {shippingInfo.postalCode}
          </Text>
          <Text style={styles.reviewInfoText}>{shippingInfo.country}</Text>
          <Text style={styles.reviewInfoText}>{shippingInfo.phone}</Text>
          <Text style={styles.reviewInfoText}>{shippingInfo.email}</Text>
        </View>
      </View>

      {/* Payment Method */}
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Metodă de plată</Text>
        <View style={styles.reviewInfo}>
          <Text style={styles.reviewInfoText}>
            {paymentMethod === 'card' ? 'Card bancar' : 'Transfer bancar'}
          </Text>
        </View>
      </View>

      {/* Total */}
      <View style={styles.reviewTotal}>
        <Text style={styles.reviewTotalLabel}>Total de plată</Text>
        <Text style={styles.reviewTotalValue}>
          {products.some(p => p.isMintProduct) ? formatRON(totalAmount) : formatEUR(totalAmount)}
        </Text>
      </View>
    </View>
  );
}

// Confirmation Step Component
function ConfirmationStep({ orderId }: { orderId: string | null }) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={80} color={colors.primary} />
      </View>
      <Text style={styles.successTitle}>Comandă plasată cu succes!</Text>
      <Text style={styles.successDescription}>
        Comanda a fost înregistrată în sistem. Veți primi un email de confirmare cu detaliile
        comenzii.
      </Text>

      {orderId && (
        <View style={styles.orderIdContainer}>
          <Text style={styles.orderIdLabel}>Număr comandă:</Text>
          <Text style={styles.orderIdValue}>{orderId}</Text>
        </View>
      )}

      <View style={styles.nextSteps}>
        <Text style={styles.nextStepsTitle}>Ce urmează?</Text>
        <View style={styles.nextStepItem}>
          <Ionicons name="mail-outline" size={20} color={colors.primary} />
          <Text style={styles.nextStepText}>
            Veți primi un email de confirmare cu detaliile comenzii
          </Text>
        </View>
        <View style={styles.nextStepItem}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
          <Text style={styles.nextStepText}>
            Vânzătorul vă va contacta pentru a stabili detaliile livrării
          </Text>
        </View>
        <View style={styles.nextStepItem}>
          <Ionicons name="cube-outline" size={20} color={colors.primary} />
          <Text style={styles.nextStepText}>
            Produsele vor fi expediate în cel mai scurt timp
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(231, 183, 60, 0.4)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 8,
  },
  stepperContainer: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(231, 183, 60, 0.3)',
    paddingVertical: 12,
  },
  stepperScroll: {
    paddingHorizontal: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepCircleCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepCirclePending: {
    backgroundColor: 'transparent',
    borderColor: colors.borderColor,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepNumberCurrent: {
    color: colors.primaryText,
  },
  stepNumberPending: {
    color: colors.textSecondary,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
  stepLabelCurrent: {
    color: colors.primary,
  },
  stepLabelPending: {
    color: colors.textSecondary,
  },
  stepLine: {
    width: 24,
    height: 2,
    marginLeft: 8,
  },
  stepLineCompleted: {
    backgroundColor: colors.primary,
  },
  stepLinePending: {
    backgroundColor: colors.borderColor,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  stepContent: {
    paddingBottom: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formGroupHalf: {
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
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
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(231, 183, 60, 0.1)',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(231, 183, 60, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  paymentOptionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  paymentRadio: {
    marginLeft: 12,
  },
  paymentInfo: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  paymentInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  paymentInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  reviewSection: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  reviewProduct: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  reviewProductImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  reviewProductImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.navy800,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reviewProductInfo: {
    flex: 1,
  },
  reviewProductName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  reviewProductPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  reviewInfo: {
    gap: 4,
  },
  reviewInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  reviewTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  reviewTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  reviewTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  successDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  orderIdContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  orderIdLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  orderIdValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  nextSteps: {
    gap: 12,
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextStepText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(231, 183, 60, 0.3)',
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  nextButton: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});
