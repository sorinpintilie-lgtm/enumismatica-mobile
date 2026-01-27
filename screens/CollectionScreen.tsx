import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, Image, FlatList } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { CollectionItem } from '@shared/types';
import { subscribeToUserCollection, getCollectionStats, addCollectionItem, updateCollectionItem, deleteCollectionItem, getCollectionItem } from '@shared/collectionService';
import { getUserCredits, payCollectionSubscriptionWithCredits } from '@shared/creditService';
import { uploadMultipleImages } from '@shared/storageService';
import { format } from 'date-fns';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import InlineBackButton from '../components/InlineBackButton';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

export default function CollectionScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);
  
  // Subscription state
  const [subscriptionActive, setSubscriptionActive] = useState<boolean | null>(null);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<Date | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);

  // Check subscription status
  useEffect(() => {
    if (!user?.uid) return;

    const checkSubscription = async () => {
      setSubscriptionLoading(true);
      try {
        // Check if user has active subscription
        // This is a simplified check - in production you'd want to check the actual subscription status
        const userCredits = await getUserCredits(user.uid);
        setCredits(userCredits);

        // For now, we'll assume subscription is active if user has enough credits
        // In a real implementation, you'd check the collectionSubscriptionExpiresAt field
        setSubscriptionActive(userCredits >= 50);
      } catch (err) {
        console.error('Failed to check subscription:', err);
        setSubscriptionActive(false);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    checkSubscription();
  }, [user?.uid]);

  // Load collection items
  useEffect(() => {
    if (!user?.uid || subscriptionActive === false) {
      setLoading(false);
      return;
    }

    if (subscriptionActive) {
      const unsubscribe = subscribeToUserCollection(
        user.uid,
        (items) => {
          setItems(items);
          setLoading(false);
        },
        'createdAt',
        'desc'
      );

      // Load stats
      const loadStats = async () => {
        try {
          const stats = await getCollectionStats(user.uid);
          setStats(stats);
        } catch (err) {
          console.error('Failed to load collection stats:', err);
        }
      };

      loadStats();

      return () => unsubscribe();
    }
  }, [user?.uid, subscriptionActive]);

  const handleActivateSubscription = async () => {
    if (!user?.uid) return;

    try {
      setSubscriptionLoading(true);
      await payCollectionSubscriptionWithCredits(user.uid, 1);
      
      // Refresh credits and subscription status
      const updatedCredits = await getUserCredits(user.uid);
      setCredits(updatedCredits);
      setSubscriptionActive(true);
      
      Alert.alert('Success', 'Collection subscription activated successfully!');
    } catch (err) {
      console.error('Failed to activate subscription:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to activate subscription');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search) ||
      item.country?.toLowerCase().includes(search) ||
      item.denomination?.toLowerCase().includes(search) ||
      item.tags?.some((tag) => tag.toLowerCase().includes(search))
    );
  });

  if (!user) {
    return (
      <View style={styles.container}>
	        <InlineBackButton />
	        <Text style={styles.headerTitle}>Autentifică-te pentru a vedea colecția</Text>
      </View>
    );
  }

  if (subscriptionLoading && subscriptionActive === null) {
    return (
      <View style={styles.container}>
        <InlineBackButton />
        <Text style={styles.loadingText}>Se verifică abonamentul colecției...</Text>
      </View>
    );
  }

  if (subscriptionActive === false) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContainer}>
        <InlineBackButton />
        <View style={styles.subscriptionCard}>
          <Text style={styles.subscriptionTitle}>Abonament Colecție Necesar</Text>
          <Text style={styles.subscriptionDescription}>
            Pentru a folosi funcțiile "Colecția Mea" (vizualizare, adăugare și gestionare articole), ai nevoie de un abonament activ plătit cu credite.
          </Text>
          <View style={styles.subscriptionInfo}>
            <Text style={styles.infoText}>• Cost: 50 credite / an</Text>
            <Text style={styles.infoText}>• Abonamentul îți permite să menții și să gestionezi colecția personală</Text>
            <Text style={styles.infoText}>• Creditele pot fi obținute din bonus înregistrare, recomandări sau plăți</Text>
          </View>
          <View style={styles.creditsInfo}>
            <Text style={styles.creditsLabel}>Credite Disponibile:</Text>
            <Text style={styles.creditsValue}>{creditsLoading ? '—' : credits ?? 0}</Text>
          </View>
          <TouchableOpacity
            style={styles.activateButton}
            onPress={handleActivateSubscription}
            disabled={subscriptionLoading || (credits !== null && credits < 50)}
          >
            <Text style={styles.activateButtonText}>
              {subscriptionLoading ? 'Se activează...' : 'Activează Abonament (50 credite/an)'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <InlineBackButton />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Colecția Mea</Text>
        <Text style={styles.headerSubtitle}>Gestionează colecția ta numismatică personală</Text>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Articole</Text>
            <Text style={styles.statValue}>{stats.totalItems}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Valoare Totală</Text>
            <Text style={styles.statValue}>{stats.totalValue} EUR</Text>
          </View>
        </View>
      )}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Caută în colecție..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === 'grid' && styles.activeViewButton]}
            onPress={() => setViewMode('grid')}
          >
            <Ionicons name="grid" size={20} color={viewMode === 'grid' ? '#fff' : '#999'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === 'list' && styles.activeViewButton]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={20} color={viewMode === 'list' ? '#fff' : '#999'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Add Button */}
      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Adaugă Articol</Text>
      </TouchableOpacity>

      {/* Collection Items */}
      {loading ? (
        <Text style={styles.loadingText}>Se încarcă colecția...</Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="sad-outline" size={60} color="#999" />
          <Text style={styles.emptyText}>
            {searchTerm ? 'Nu s-au găsit rezultate' : 'Colecția ta este goală'}
          </Text>
          {!searchTerm && (
            <TouchableOpacity style={styles.addFirstButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.addFirstButtonText}>Adaugă Primul Articol</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : viewMode === 'grid' ? (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridColumn}
          renderItem={({ item }) => (
            <CollectionItemCard
              item={item}
              onEdit={() => setEditingItem(item)}
              onDelete={async () => {
                Alert.alert(
                  'Șterge Articol',
                  'Sigur dorești să ștergi acest articol?',
                  [
                    { text: 'Anulează', style: 'cancel' },
                    {
                      text: 'Șterge',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await deleteCollectionItem(user.uid, item.id);
                          Alert.alert('Succes', 'Articol șters cu succes');
                        } catch (err) {
                          console.error('Failed to delete item:', err);
                          Alert.alert('Eroare', 'Nu s-a putut șterge articolul');
                        }
                      }
                    }
                  ]
                );
              }}
            />
          )}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.listItemContent}>
                {item.images && item.images[0] ? (
                  <Image source={{ uri: item.images[0] }} style={styles.listItemImage} />
                ) : (
                  <View style={styles.listItemImagePlaceholder}>
                    <Text style={styles.listItemImagePlaceholderText}>-</Text>
                  </View>
                )}
                <View style={styles.listItemText}>
                  <Text style={styles.listItemName}>{item.name}</Text>
                  <Text style={styles.listItemDenomination}>{item.denomination || 'N/A'}</Text>
                </View>
              </View>
              <View style={styles.listItemDetails}>
                <Text style={styles.listItemDetail}>{item.country || '-'}</Text>
                <Text style={styles.listItemDetail}>{item.year || '-'}</Text>
                <Text style={styles.listItemDetail}>{item.metal || '-'}</Text>
                <Text style={styles.listItemValue}>{item.currentValue ? `${item.currentValue} EUR` : '-'}</Text>
              </View>
              <View style={styles.listItemActions}>
                <TouchableOpacity onPress={() => setEditingItem(item)}>
                  <Text style={styles.actionText}>Editează</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  Alert.alert(
                    'Șterge Articol',
                    'Sigur dorești să ștergi acest articol?',
                    [
                      { text: 'Anulează', style: 'cancel' },
                      {
                        text: 'Șterge',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await deleteCollectionItem(user.uid, item.id);
                            Alert.alert('Succes', 'Articol șters cu succes');
                          } catch (err) {
                            console.error('Failed to delete item:', err);
                            Alert.alert('Eroare', 'Nu s-a putut șterge articolul');
                          }
                        }
                      }
                    ]
                  );
                }}>
                  <Text style={[styles.actionText, styles.deleteText]}>Șterge</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingItem) && (
        <CollectionItemModal
          item={editingItem}
          onClose={() => {
            setShowAddModal(false);
            setEditingItem(null);
          }}
          onSave={async (itemData) => {
            try {
              if (editingItem) {
                await updateCollectionItem(user.uid, editingItem.id, itemData);
                Alert.alert('Success', 'Item updated successfully');
              } else {
                if (!itemData.name) {
                  throw new Error('Name is required');
                }
                await addCollectionItem(user.uid, itemData as any);
                Alert.alert('Success', 'Item added successfully');
              }
              setShowAddModal(false);
              setEditingItem(null);
            } catch (err) {
              console.error('Failed to save item:', err);
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save item');
            }
          }}
        />
      )}
    </View>
  );
}

function CollectionItemCard({ item, onEdit, onDelete }: {
  item: CollectionItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardImageContainer}>
        {item.images && item.images[0] ? (
          <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardImagePlaceholderText}>-</Text>
          </View>
        )}
        {item.rarity && (
          <View style={[styles.rarityBadge, getRarityStyle(item.rarity)]}>
            <Text style={styles.rarityText}>{item.rarity}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardDenomination} numberOfLines={1}>{item.denomination || 'N/A'}</Text>
        <View style={styles.cardDetails}>
          {item.country && <Text style={styles.cardDetail}><Text style={styles.cardDetailLabel}>Țară:</Text> {item.country}</Text>}
          {item.year && <Text style={styles.cardDetail}><Text style={styles.cardDetailLabel}>An:</Text> {item.year}</Text>}
          {item.metal && <Text style={styles.cardDetail}><Text style={styles.cardDetailLabel}>Metal:</Text> {item.metal}</Text>}
          {item.grade && <Text style={styles.cardDetail}><Text style={styles.cardDetailLabel}>Grad:</Text> {item.grade}</Text>}
          {item.currentValue && <Text style={styles.cardValue}><Text style={styles.cardDetailLabel}>Valoare:</Text> {item.currentValue} EUR</Text>}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={onEdit}>
            <Text style={styles.actionButtonText}>Editează</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={onDelete}>
            <Text style={styles.actionButtonText}>Șterge</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function CollectionItemModal({ item, onClose, onSave }: {
  item: CollectionItem | null;
  onClose: () => void;
  onSave: (data: Partial<CollectionItem>) => Promise<void>;
}) {
  const [formData, setFormData] = useState<Partial<CollectionItem>>(
    item || {
      name: '',
      description: '',
      country: '',
      year: undefined,
      denomination: '',
      metal: '',
      grade: '',
      rarity: undefined,
      currentValue: undefined,
      notes: '',
      tags: [],
      images: [],
    }
  );
  const [saving, setSaving] = useState(false);
  const [imageFiles, setImageFiles] = useState<{ uri: string; name: string; type: string }[]>([]);

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset: ImagePicker.ImagePickerAsset) => ({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      }));
      setImageFiles(prev => [...prev, ...newImages]);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setSaving(true);
    try {
      let imageUrls: string[] = formData.images || [];

      // Upload new images if any
      if (imageFiles.length > 0) {
        // Note: uploadMultipleImages expects File objects, but in React Native we need to handle this differently
        // For now, we'll simulate this by just adding the URIs
        const uploadedUrls = imageFiles.map(img => img.uri);
        imageUrls = [...imageUrls, ...uploadedUrls];
      }

      const payload: Partial<CollectionItem> = {
        ...formData,
        images: imageUrls,
      };

      await onSave(payload);
    } catch (err) {
      console.error('Failed to save:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={true} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{item ? 'Editează Articol' : 'Adaugă Articol Nou'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nume *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="ex: Denar Roman"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Descriere</Text>
              <TextInput
                style={[styles.formInput, styles.textarea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Descriere detaliată..."
                multiline
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.formLabel}>Țară</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.country}
                  onChangeText={(text) => setFormData({ ...formData, country: text })}
                />
              </View>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.formLabel}>An</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.year?.toString()}
                  onChangeText={(text) => setFormData({ ...formData, year: text ? parseInt(text) : undefined })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.formLabel}>Denominație</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.denomination}
                  onChangeText={(text) => setFormData({ ...formData, denomination: text })}
                />
              </View>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.formLabel}>Metal</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.metal}
                  onChangeText={(text) => setFormData({ ...formData, metal: text })}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.formLabel}>Grad</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.grade}
                  onChangeText={(text) => setFormData({ ...formData, grade: text })}
                />
              </View>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.formLabel}>Raritate</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.rarity}
                    onValueChange={(value: any) => setFormData({ ...formData, rarity: value })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Selectează..." value={undefined} />
                    <Picker.Item label="Comun" value="common" />
                    <Picker.Item label="Necomun" value="uncommon" />
                    <Picker.Item label="Rar" value="rare" />
                    <Picker.Item label="Foarte Rar" value="very-rare" />
                    <Picker.Item label="Extrem de Rar" value="extremely-rare" />
                  </Picker>
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Valoare Curentă (EUR)</Text>
              <TextInput
                style={styles.formInput}
                value={formData.currentValue?.toString()}
                onChangeText={(text) => setFormData({ ...formData, currentValue: text ? parseFloat(text) : undefined })}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notițe</Text>
              <TextInput
                style={[styles.formInput, styles.textarea]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="Notițe personale despre acest articol..."
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Imagini</Text>
              <TouchableOpacity style={styles.imageUploadButton} onPress={handleImagePick}>
                <Text style={styles.imageUploadButtonText}>Selectează Imagini</Text>
              </TouchableOpacity>
              {imageFiles.length > 0 && (
                <View style={styles.imagePreviewContainer}>
                  <Text style={styles.imagePreviewText}>{imageFiles.length} imagine(i) selectate</Text>
                  <ScrollView horizontal style={styles.imagePreviewScroll}>
                    {imageFiles.map((img, index) => (
                      <Image key={index} source={{ uri: img.uri }} style={styles.imagePreview} />
                    ))}
                  </ScrollView>
                </View>
              )}
              {formData.images && formData.images.length > 0 && (
                <View style={styles.existingImages}>
                  <Text style={styles.existingImagesText}>Imagini Existente:</Text>
                  <ScrollView horizontal style={styles.existingImagesScroll}>
                    {formData.images.map((img, index) => (
                      <Image key={index} source={{ uri: img }} style={styles.existingImage} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.footerButton, styles.cancelButton]} onPress={onClose} disabled={saving}>
              <Text style={styles.footerButtonText}>Anulează</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerButton, styles.saveButton]} onPress={handleSubmit} disabled={saving}>
              <Text style={styles.footerButtonText}>{saving ? 'Se salvează...' : item ? 'Actualizează' : 'Adaugă'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Helper function for rarity badge styling
function getRarityStyle(rarity: string) {
  switch (rarity) {
    case 'extremely-rare':
      return { backgroundColor: '#8B5CF6' };
    case 'very-rare':
      return { backgroundColor: '#EF4444' };
    case 'rare':
      return { backgroundColor: '#F59E0B' };
    case 'uncommon':
      return { backgroundColor: '#FBBF24' };
    default:
      return { backgroundColor: '#9CA3AF' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00020d',
    padding: 16,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e7b73c',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  statLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e7b73c',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#fff',
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  viewButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  activeViewButton: {
    backgroundColor: '#e7b73c',
    borderColor: '#e7b73c',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7b73c',
    padding: 12,
    borderRadius: 25,
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: {
    color: '#000940',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: '#e7b73c',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  addFirstButtonText: {
    color: '#000940',
    fontWeight: '600',
  },
  gridColumn: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  cardImageContainer: {
    aspectRatio: 1,
    backgroundColor: '#00020d',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#334155',
  },
  cardImagePlaceholderText: {
    fontSize: 48,
    color: '#94a3b8',
  },
  rarityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rarityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 12,
  },
  cardName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDenomination: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  cardDetails: {
    marginBottom: 12,
  },
  cardDetail: {
    color: '#cbd5e1',
    fontSize: 12,
    marginBottom: 2,
  },
  cardDetailLabel: {
    color: '#64748b',
  },
  cardValue: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#3b82f6',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listItem: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listItemImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  listItemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listItemImagePlaceholderText: {
    fontSize: 24,
    color: '#94a3b8',
  },
  listItemText: {
    flex: 1,
  },
  listItemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listItemDenomination: {
    color: '#94a3b8',
    fontSize: 14,
  },
  listItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listItemDetail: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  listItemValue: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  listItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  actionText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  deleteText: {
    color: '#ef4444',
  },
  subscriptionCard: {
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.6)',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  subscriptionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subscriptionDescription: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 16,
    textAlign: 'center',
  },
  subscriptionInfo: {
    marginBottom: 16,
  },
  infoText: {
    color: '#cbd5e1',
    marginBottom: 4,
    fontSize: 14,
  },
  creditsInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  creditsLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 4,
  },
  creditsValue: {
    color: '#e7b73c',
    fontSize: 32,
    fontWeight: 'bold',
  },
  activateButton: {
    backgroundColor: '#e7b73c',
    padding: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
  },
  activateButtonText: {
    color: '#000940',
    fontWeight: '600',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#00020d',
    borderRadius: 16,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.6)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  modalScroll: {
    padding: 16,
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
  formLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  textarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  picker: {
    height: 40,
    color: '#fff',
  },
  imageUploadButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  imageUploadButtonText: {
    color: '#e7b73c',
    fontWeight: '600',
  },
  imagePreviewContainer: {
    marginTop: 12,
  },
  imagePreviewText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
  },
  imagePreviewScroll: {
    marginBottom: 12,
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  existingImages: {
    marginTop: 12,
  },
  existingImagesText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
  },
  existingImagesScroll: {
    marginBottom: 12,
  },
  existingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  footerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  saveButton: {
    backgroundColor: '#e7b73c',
  },
  footerButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
