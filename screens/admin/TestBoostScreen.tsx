import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@shared/firebaseConfig';
import { Product } from '@shared/types';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigationTypes';
import { isAdmin } from '@shared/adminService';
import InlineBackButton from '../../components/InlineBackButton';

type TestBoostNavigationProp = StackNavigationProp<RootStackParamList>;

export default function TestBoostScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<TestBoostNavigationProp>();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [boostDays, setBoostDays] = useState(7);

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
      await loadProducts();
      setLoading(false);
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading, navigation]);

  const loadProducts = async () => {
    try {
      // Get approved products
      const q = query(
        collection(db, 'products'),
        where('status', '==', 'approved')
      );
      
      const querySnapshot = await getDocs(q);
      const productsData: Product[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        productsData.push({
          id: doc.id,
          name: data.name || 'Unknown',
          description: data.description || '',
          images: data.images || [],
          price: data.price || 0,
          ownerId: data.ownerId || '',
          status: data.status || 'pending',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });
      
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Eroare la încărcarea pieselor');
    }
  };

  const handleBoostProduct = async () => {
    if (!selectedProduct) {
      Alert.alert('Error', 'Selectează o piesă');
      return;
    }

    try {
      const productRef = doc(db, 'products', selectedProduct);
      const boostUntil = new Date();
      boostUntil.setDate(boostUntil.getDate() + boostDays);

      await updateDoc(productRef, {
        boostedAt: serverTimestamp(),
        boostExpiresAt: Timestamp.fromDate(boostUntil),
        updatedAt: serverTimestamp(),
      });

      Alert.alert('Success', `Piesă boostată cu succes pentru ${boostDays} zile!`);
      await loadProducts(); // Refresh the list
    } catch (error) {
      console.error('Error boosting product:', error);
      Alert.alert('Error', 'Eroare la boostarea piesei');
    }
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
      <View style={styles.content}>
        <View style={styles.header}>
          <InlineBackButton label="Înapoi la Admin" onPress={() => navigation.navigate('Dashboard' as never)} />
          <Text style={styles.title}>Test Boost Products</Text>
        </View>

        {/* Boost Form */}
        <View style={styles.boostForm}>
          <Text style={styles.formTitle}>Boost a Product</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Select Product</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedProduct}
                onValueChange={(itemValue: string) => setSelectedProduct(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Select a product..." value="" />
                {products.map((product) => (
                  <Picker.Item 
                    key={product.id} 
                    label={`${product.name} - ${product.price} RON`} 
                    value={product.id}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Boost Duration (days)</Text>
            <Text style={styles.input}>{boostDays}</Text>
            <View style={styles.daysSelector}>
              {[1, 7, 14, 30].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[styles.dayButton, boostDays === days && styles.dayButtonActive]}
                  onPress={() => setBoostDays(days)}
                >
                  <Text style={[styles.dayButtonText, boostDays === days && styles.dayButtonTextActive]}>{days}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.boostButton, !selectedProduct && styles.boostButtonDisabled]}
            onPress={handleBoostProduct}
            disabled={!selectedProduct}
          >
            <Text style={styles.boostButtonText}>Boost Product</Text>
          </TouchableOpacity>
        </View>

        {/* Products List */}
        <View style={styles.productsContainer}>
          <Text style={styles.sectionTitle}>All Products ({products.length})</Text>
          
          {products.length === 0 ? (
            <Text style={styles.noProducts}>No products found.</Text>
          ) : (
            <View style={styles.productsList}>
              {products.map((product) => (
                <View key={product.id} style={styles.productItem}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productDescription}>{product.description}</Text>
                    <View style={styles.productDetails}>
                      <Text style={styles.productDetail}>Price: {product.price} RON</Text>
                      <Text style={styles.productDetail}>Status: {product.status}</Text>
                      <Text style={styles.productDetail}>Created: {product.createdAt.toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setSelectedProduct(product.id)}
                  >
                    <Text style={styles.selectButtonText}>Select</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    maxWidth: '100%',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  boostForm: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  input: {
    fontSize: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    marginBottom: 8,
  },
  daysSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  dayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  dayButtonActive: {
    backgroundColor: '#3b82f6',
  },
  dayButtonText: {
    color: '#374151',
    fontWeight: '500',
  },
  dayButtonTextActive: {
    color: '#ffffff',
  },
  boostButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignItems: 'center',
  },
  boostButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  boostButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  productsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  noProducts: {
    color: '#6b7280',
    textAlign: 'center',
    marginVertical: 24,
  },
  productsList: {
    gap: 12,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  productDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  productDetails: {
    marginTop: 8,
  },
  productDetail: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  selectButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
    marginLeft: 8,
  },
  selectButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
});
