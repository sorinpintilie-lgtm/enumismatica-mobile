import React, { useState, useEffect, ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from '@shared/firebaseConfig';
import { db } from '@shared/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigationTypes';
import { useCoinAutocomplete } from '../hooks/useCoinAutocomplete';
import {
  pickImagesFromGallery,
  takePhoto,
  uploadMultipleImagesFromUris,
  type ImageAsset
} from '../utils/imageUpload';

// Constants copied from web /products/new page for parity
const COUNTRIES = [
  'România', 'Germania', 'Franța', 'Italia', 'Spania', 'Regatul Unit', 'Austria', 'Elveția',
  'Rusia', 'Polonia', 'Ungaria', 'Cehia', 'Slovacia', 'Bulgaria', 'Serbia', 'Croația',
  'Grecia', 'Turcia', 'SUA', 'Canada', 'Australia', 'China', 'Japonia', 'India',
  'Brazilia', 'Argentina', 'Mexic', 'Africa de Sud', 'Egipt', 'Israel', 'Arabia Saudită',
];

const RARITIES = [
  { value: 'common', label: 'Comun' },
  { value: 'uncommon', label: 'Necomun' },
  { value: 'rare', label: 'Rar' },
  { value: 'very-rare', label: 'Foarte Rar' },
  { value: 'extremely-rare', label: 'Extrem de Rar' },
];

const GRADES = [
  'VF (Very Fine)', 'XF (Extremely Fine)', 'AU (Almost Uncirculated)', 'MS (Mint State)',
  'MS-60', 'MS-61', 'MS-62', 'MS-63', 'MS-64', 'MS-65', 'MS-66', 'MS-67', 'MS-68', 'MS-69', 'MS-70',
  'F (Fine)', 'VG (Very Good)', 'G (Good)', 'AG (About Good)', 'FA (Fair)', 'PR (Poor)',
  'UNC (Uncirculated)', 'BU (Brilliant Uncirculated)', 'Proof', 'Proof-like',
];

const CERTIFICATION_COMPANIES = [
  { value: 'NGC', label: 'NGC (Numismatic Guaranty Corporation)' },
  { value: 'PCGS', label: 'PCGS (Professional Coin Grading Service)' },
] as const;

type CertificationCompany = (typeof CERTIFICATION_COMPANIES)[number]['value'];

const NGC_GRADES = [
  'NGCX',
  '70', '69', '68', '67', '65', '66', '64', '63', '62', '61', '60', '58', '55', '53', '50', '45', '40', '35', '30', '25', '20', '15', '10', '8', '6', '4', '3', '2', '1',
  'NGC Ancients',
  'NGC Details',
  'Other',
];

const PCGS_GRADES = [
  '70', '69', '68', '67', '65', '66', '64', '63', '62', '61', '60', '58', '55', '53', '50', '45', '40', '35', '30', '25', '20', '15', '10', '8', '6', '4', '3', '2', '1',
  'PCGS Ancients',
  'PCGS Details',
  'Other',
];

const CATEGORIES = ['Monede', 'Bancnote'] as const;

// Helper to avoid React Native Web wheel issues with nested horizontal ScrollViews.
// On web we render a simple wrapping row; on native we keep a horizontal ScrollView.
const HorizontalPillScroll: React.FC<{ children: ReactNode }> = ({ children }) => {
  if (Platform.OS === 'web') {
    return <View style={styles.pillWrap}>{children}</View>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
};

type NewListingRouteProp = RouteProp<RootStackParamList, 'NewListing'>;
type Nav = StackNavigationProp<RootStackParamList>;

type ListingType = 'direct' | 'auction';

const NewListingScreen: React.FC = () => {
  const route = useRoute<NewListingRouteProp>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const mode: ListingType = route.params.listingType;
  const { productId } = route.params;
  const [isEditing, setIsEditing] = useState(!!productId);

  // Debug log to verify screen mount and listing type
  console.log('[NewListingScreen] render, mode =', mode);

  // Core fields (mirroring web)
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Monede');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [country, setCountry] = useState('România');
  const [year, setYear] = useState('');
  const [era, setEra] = useState('');
  const [metal, setMetal] = useState('');
  const [denomination, setDenomination] = useState('');
  const [diameter, setDiameter] = useState('');
  const [weight, setWeight] = useState('');
  const [mintLocation, setMintLocation] = useState('');
  const [rarity, setRarity] = useState('');
  const [grade, setGrade] = useState('');

  // Certification
  const [hasCertification, setHasCertification] = useState(false);
  const [certificationCompany, setCertificationCompany] = useState<CertificationCompany>('NGC');
  const [certificationCode, setCertificationCode] = useState('');
  const [certificationGrade, setCertificationGrade] = useState('');

  // Offers
  const [acceptsOffers, setAcceptsOffers] = useState(true);

  // Auction specific
  const [reservePrice, setReservePrice] = useState('');
  const [minAcceptPrice, setMinAcceptPrice] = useState('');
  const [buyNowPrice, setBuyNowPrice] = useState('');
  const [auctionDuration, setAuctionDuration] = useState<3 | 5>(3);

  // Romanian coin autocomplete
  const [useAutocomplete, setUseAutocomplete] = useState(true);
  const {
    selectedDenomination,
    setSelectedDenomination,
    selectedYear,
    setSelectedYear,
    selectedMint,
    setSelectedMint,
    matchedCoin,
    availableDenominations,
    availableYears,
    availableMints,
    reset: resetAutocomplete,
  } = useCoinAutocomplete();

  const [isNameAutoGenerated, setIsNameAutoGenerated] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);

  // Load product data if editing
  useEffect(() => {
    const loadProductData = async () => {
      if (!productId) return;

      setLoadingProduct(true);
      try {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
          const productData = productSnap.data() as any;
          
          // Load product data into form fields
          setCategory(productData.category || 'Monede');
          setName(productData.name || '');
          setDescription(productData.description || '');
          setPrice(productData.price ? String(productData.price) : '');
          setCountry(productData.country || 'România');
          setYear(productData.year ? String(productData.year) : '');
          setEra(productData.era || '');
          setMetal(productData.metal || '');
          setDenomination(productData.denomination || '');
          setDiameter(productData.diameter ? String(productData.diameter) : '');
          setWeight(productData.weight ? String(productData.weight) : '');
          setMintLocation(productData.mintLocation || '');
          setRarity(productData.rarity || '');
          setGrade(productData.grade || '');
          setHasCertification(!!productData.hasCertification);
          setCertificationCompany(productData.certificationCompany || 'NGC');
          setCertificationCode(productData.certificationCode || '');
          setCertificationGrade(productData.certificationGrade || '');
          setAcceptsOffers(!!productData.acceptsOffers);

          // Load existing images
          if (productData.images && productData.images.length > 0) {
            const existingImages: ImageAsset[] = productData.images.map((url: string) => ({
              uri: url,
              type: 'image/jpeg',
              name: `existing_${Date.now()}.jpg`
            }));
            setImages(existingImages);
          }
        }
      } catch (error) {
        console.error('Failed to load product data:', error);
        Alert.alert('Eroare', 'Nu s-a putut încărca datele produsului pentru editare');
      } finally {
        setLoadingProduct(false);
      }
    };

    loadProductData();
  }, [productId]);

  // Auto-fill fields from matched coin (same logic as web)
  useEffect(() => {
    if (matchedCoin && useAutocomplete) {
      setYear(String(matchedCoin.issue_year) || '');
      setEra(matchedCoin.era || '');
      setDenomination(matchedCoin.face_value || '');
      setMetal(matchedCoin.metal || '');
      setDiameter(matchedCoin.diameter || '');
      setWeight(matchedCoin.weight || '');
      setMintLocation(matchedCoin.mint_or_theme || '');

      if (isNameAutoGenerated || !name.trim()) {
        setName(
          `${matchedCoin.face_value} ${matchedCoin.issue_year} - ${matchedCoin.mint_or_theme}`,
        );
        setIsNameAutoGenerated(true);
      }
    }
  }, [matchedCoin, useAutocomplete, isNameAutoGenerated, name]);

  const validateCertification = (): boolean => {
    if (!hasCertification) return true;

    if (!certificationCode.trim()) {
      setError('Codul de certificare este obligatoriu.');
      return false;
    }

    let isValidCode = false;
    if (certificationCompany === 'NGC') {
      const ngcRegex = /^\d{7}-\d{3}$/; // 1234567-999
      isValidCode = ngcRegex.test(certificationCode.trim());
    } else if (certificationCompany === 'PCGS') {
      const pcgsRegex = /^\d{6}\.\d{2}\/\d{8}$/; // 123456.78/12345678
      isValidCode = pcgsRegex.test(certificationCode.trim());
    }

    if (!isValidCode) {
      const formatExample =
        certificationCompany === 'NGC' ? '1234567-999' : '123456.78/12345678';
      setError(
        `Codul de certificare pentru ${certificationCompany} trebuie să fie în formatul ${formatExample}.`,
      );
      return false;
    }

    if (!certificationGrade) {
      setError(`Selectează gradul pentru certificarea ${certificationCompany}.`);
      return false;
    }

    return true;
  };

  const handlePickImages = async () => {
    try {
      const selectedImages = await pickImagesFromGallery(10);
      if (selectedImages.length > 0) {
        setImages(prev => [...prev, ...selectedImages]);
      }
    } catch (error: any) {
      Alert.alert('Eroare', error.message || 'Nu s-au putut selecta imaginile');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const photo = await takePhoto();
      if (photo) {
        setImages(prev => [...prev, photo]);
      }
    } catch (error: any) {
      Alert.alert('Eroare', error.message || 'Nu s-a putut face fotografia');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('Trebuie să fii autentificat pentru a adăuga o piesă.');
      navigation.navigate('Login');
      return;
    }

    setError(null);

    if (!name.trim()) {
      setError('Numele piesei este obligatoriu.');
      return;
    }

    // Direct listing price
    let numericPrice = 0;
    if (mode === 'direct') {
      numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        setError('Introdu un preț valid mai mare decât 0.');
        return;
      }
    }

    // Auction validation (same as web)
    let numericReserve = 0;
    let numericMinAccept = 0;
    let numericBuyNow: number | null = null;

    if (mode === 'auction') {
      numericReserve = Number(reservePrice || price);
      if (!Number.isFinite(numericReserve) || numericReserve <= 0) {
        setError('Introdu un preț de start valid mai mare decât 0.');
        return;
      }

      numericMinAccept = Number(minAcceptPrice || numericReserve);
      if (!Number.isFinite(numericMinAccept) || numericMinAccept <= 0) {
        setError('Introdu un preț minim acceptat valid mai mare decât 0.');
        return;
      }
      if (numericMinAccept < numericReserve) {
        setError('Prețul minim acceptat trebuie să fie cel puțin egal cu prețul de start.');
        return;
      }

      if (buyNowPrice) {
        const v = Number(buyNowPrice);
        if (!Number.isFinite(v) || v <= 0) {
          setError('Introdu un preț "Cumpără acum" valid mai mare decât 0.');
          return;
        }
        if (v < numericMinAccept) {
          setError('Prețul "Cumpără acum" trebuie să fie cel puțin egal cu prețul minim acceptat.');
          return;
        }
        numericBuyNow = v;
      }

      if (!auctionDuration) {
        setError('Selectează durata licitației (3 sau 5 zile).');
        return;
      }
    }

    if (!validateCertification()) {
      return;
    }

    try {
      setSubmitting(true);

      // Determine final product price
      let productPrice = numericPrice;
      if (mode === 'auction') {
        productPrice = numericReserve;
      }

      let productRef;

      if (isEditing && productId) {
        // Update existing product
        productRef = doc(db, 'products', productId);
        await updateDoc(productRef, {
          name: name.trim(),
          description: description.trim(),
          price: productPrice,
          category: category || null,
          listingType: mode,
          country: country || null,
          year: year ? Number(year) : null,
          era: era || null,
          metal: metal || null,
          denomination: denomination || null,
          diameter: diameter ? Number(diameter) : null,
          weight: weight ? Number(weight) : null,
          mintLocation: mintLocation || null,
          rarity: rarity || null,
          grade: grade || null,
          hasCertification: hasCertification || false,
          certificationCompany: hasCertification ? certificationCompany : null,
          certificationCode: hasCertification ? certificationCode.trim() : null,
          certificationGrade: hasCertification ? certificationGrade : null,
          acceptsOffers,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new product
        productRef = await addDoc(collection(db, 'products'), {
          name: name.trim(),
          description: description.trim(),
          images: [],
          video: null,
          price: productPrice,
          category: category || null,
          listingType: mode,
          ownerId: user.uid,
          status: 'pending',
          country: country || null,
          year: year ? Number(year) : null,
          era: era || null,
          metal: metal || null,
          denomination: denomination || null,
          diameter: diameter ? Number(diameter) : null,
          weight: weight ? Number(weight) : null,
          mintLocation: mintLocation || null,
          rarity: rarity || null,
          grade: grade || null,
          hasCertification: hasCertification || false,
          certificationCompany: hasCertification ? certificationCompany : null,
          certificationCode: hasCertification ? certificationCode.trim() : null,
          certificationGrade: hasCertification ? certificationGrade : null,
          acceptsOffers,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Upload images if any
      if (images.length > 0) {
        setUploadingImages(true);
        try {
          const imageUrls = await uploadMultipleImagesFromUris(
            images,
            `products/${user.uid}`
          );
          
          await updateDoc(doc(db, 'products', productRef.id), {
            images: imageUrls,
            imageProcessingStatus: 'done',
            imageProcessingTotal: imageUrls.length,
            imageProcessingDone: imageUrls.length,
            updatedAt: serverTimestamp(),
          });
        } catch (imageError) {
          console.error('Failed to upload images:', imageError);
          Alert.alert(
            'Avertisment',
            'Produsul a fost creat dar imaginile nu au putut fi încărcate. Poți adăuga imagini mai târziu.'
          );
        } finally {
          setUploadingImages(false);
        }
      }

      // Create auction doc if needed (same fields as web)
      if (mode === 'auction') {
        const end = new Date(Date.now() + auctionDuration * 24 * 60 * 60 * 1000);

        await addDoc(collection(db, 'auctions'), {
          productId: productRef.id,
          ownerId: user.uid,
          startTime: new Date(),
          endTime: end,
          reservePrice: numericReserve,
          minAcceptPrice: numericMinAccept,
          buyNowPrice: numericBuyNow,
          buyNowUsed: false,
          currentBid: null,
          currentBidderId: null,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      navigation.goBack();
    } catch (e: any) {
      console.error('Failed to create listing', e);
      setError(e?.message || 'A apărut o eroare la salvarea piesei.');
    } finally {
      setSubmitting(false);
    }
  };

  const certificationGrades =
    certificationCompany === 'NGC' ? NGC_GRADES : PCGS_GRADES;

  return (
    <View style={{ flex: 1, backgroundColor: '#00020d' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingBottom: 100 }]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>
          {isEditing 
            ? 'Editează produs' 
            : (mode === 'direct' ? 'Listează produs (preț fix)' : 'Trimite la licitație')}
        </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Romanian coins assistant toggle */}
      <View style={styles.sectionBox}>
        <TouchableOpacity
          style={styles.toggleRow}
          activeOpacity={0.8}
          onPress={() => {
            const next = !useAutocomplete;
            setUseAutocomplete(next);
            if (next) {
              setCountry('România');
            } else {
              resetAutocomplete();
            }
          }}
        >
          <View style={[styles.checkbox, useAutocomplete && styles.checkboxChecked]}>
            {useAutocomplete && <Text style={styles.checkboxCheck}>✓</Text>}
          </View>
          <View>
            <Text style={styles.toggleTitle}>Folosește asistentul pentru monede românești</Text>
            <Text style={styles.toggleSubtitle}>
              Auto-completează datele piesei folosind baza de date de monede românești.
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Autocomplete controls */}
      {useAutocomplete && country === 'România' && (
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Asistent Monede Românești</Text>

          <Text style={styles.label}>Valoare nominală *</Text>
          <View style={styles.pillRow}>
            <HorizontalPillScroll>
              {availableDenominations.map((den) => (
                <TouchableOpacity
                  key={den}
                  style={[
                    styles.pill,
                    selectedDenomination === den && styles.pillActive,
                  ]}
                  onPress={() => setSelectedDenomination(den)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedDenomination === den && styles.pillTextActive,
                    ]}
                  >
                    {den}
                  </Text>
                </TouchableOpacity>
              ))}
            </HorizontalPillScroll>
          </View>

          <Text style={styles.label}>An *</Text>
          <View style={styles.pillRow}>
            <HorizontalPillScroll>
              {availableYears.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[
                    styles.pill,
                    selectedYear === y && styles.pillActive,
                  ]}
                  onPress={() => setSelectedYear(y)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedYear === y && styles.pillTextActive,
                    ]}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </HorizontalPillScroll>
          </View>

          <Text style={styles.label}>Monetărie / Temă *</Text>
          <View style={styles.pillRow}>
            <HorizontalPillScroll>
              {availableMints.map((mint) => (
                <TouchableOpacity
                  key={mint}
                  style={[
                    styles.pill,
                    selectedMint === mint && styles.pillActive,
                  ]}
                  onPress={() => setSelectedMint(mint)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedMint === mint && styles.pillTextActive,
                    ]}
                  >
                    {mint}
                  </Text>
                </TouchableOpacity>
              ))}
            </HorizontalPillScroll>
          </View>

          {matchedCoin && (
            <View style={styles.coinInfoBox}>
              <Text style={styles.coinInfoTitle}>Monedă găsită în baza de date</Text>
              <Text style={styles.coinInfoText}>Diametru: {matchedCoin.diameter}</Text>
              <Text style={styles.coinInfoText}>Greutate: {matchedCoin.weight}</Text>
              <Text style={styles.coinInfoText}>Metal: {matchedCoin.metal}</Text>
              <Text style={styles.coinInfoText}>Monetărie: {matchedCoin.mint_or_theme}</Text>
            </View>
          )}
        </View>
      )}

      {/* Listing type is driven by Vinde button (mode), no toggle needed here */}

      {/* Category */}
      <Text style={styles.label}>Categorie *</Text>
      <View style={styles.pillRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              styles.pill,
              category === c && styles.pillActive,
            ]}
            onPress={() => setCategory(c)}
          >
            <Text
              style={[
                styles.pillText,
                category === c && styles.pillTextActive,
              ]}
            >
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Name */}
      <Text style={styles.label}>Nume piesă *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 10 Lei 2020"
        placeholderTextColor="#6b7280"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setIsNameAutoGenerated(false);
        }}
      />

      {/* Price / auction fields */}
      {mode === 'direct' ? (
        <>
          <Text style={styles.label}>Preț fix (EUR) *</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Ex: 100.00"
            placeholderTextColor="#6b7280"
            value={price}
            onChangeText={setPrice}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Preț de start licitație (EUR) *</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Ex: 100.00"
            placeholderTextColor="#6b7280"
            value={reservePrice}
            onChangeText={setReservePrice}
          />

          <Text style={styles.label}>Preț minim acceptat (EUR)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="implicit = preț start"
            placeholderTextColor="#6b7280"
            value={minAcceptPrice}
            onChangeText={setMinAcceptPrice}
          />

          <Text style={styles.label}>Preț "Cumpără acum" (EUR, opțional)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Ex: 200.00"
            placeholderTextColor="#6b7280"
            value={buyNowPrice}
            onChangeText={setBuyNowPrice}
          />

          <Text style={styles.label}>Durată licitație *</Text>
          <View style={styles.durationRow}>
            <TouchableOpacity
              style={[
                styles.durationButton,
                auctionDuration === 3 && styles.durationButtonActive,
              ]}
              onPress={() => setAuctionDuration(3)}
            >
              <Text
                style={[
                  styles.durationText,
                  auctionDuration === 3 && styles.durationTextActive,
                ]}
              >
                3 zile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.durationButton,
                auctionDuration === 5 && styles.durationButtonActive,
              ]}
              onPress={() => setAuctionDuration(5)}
            >
              <Text
                style={[
                  styles.durationText,
                  auctionDuration === 5 && styles.durationTextActive,
                ]}
              >
                5 zile
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Country */}
      <Text style={styles.label}>Țara *</Text>
      <TextInput
        style={styles.input}
        value={country}
        onChangeText={(value) => {
          setCountry(value);
          if (value !== 'România') {
            setUseAutocomplete(false);
            resetAutocomplete();
          }
        }}
        placeholder="Ex: România"
        placeholderTextColor="#6b7280"
      />

      {/* Year */}
      <Text style={styles.label}>An</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={year}
        onChangeText={setYear}
        placeholder="Ex: 2024"
        placeholderTextColor="#6b7280"
      />

      {/* Era */}
      {category === 'Monede' && (
        <>
          <Text style={styles.label}>Epocă</Text>
          <TextInput
            style={styles.input}
            value={era}
            onChangeText={setEra}
            placeholderTextColor="#6b7280"
          />
        </>
      )}

      {/* Metal / denom / diameter / weight / mint for coins */}
      {category === 'Monede' && (
        <>
          <Text style={styles.label}>Metal</Text>
          <TextInput
            style={styles.input}
            value={metal}
            onChangeText={setMetal}
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Denominație</Text>
          <TextInput
            style={styles.input}
            value={denomination}
            onChangeText={setDenomination}
            placeholder="Ex: 1 Leu"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Diametru</Text>
          <TextInput
            style={styles.input}
            value={diameter}
            onChangeText={setDiameter}
            placeholder="Ex: 23 mm"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Greutate</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="Ex: 5 g"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Monetărie / Temă</Text>
          <TextInput
            style={styles.input}
            value={mintLocation}
            onChangeText={setMintLocation}
            placeholderTextColor="#6b7280"
          />
        </>
      )}

      {/* Rarity */}
      <Text style={styles.label}>Raritate</Text>
      <View style={styles.pillRow}>
        {RARITIES.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[
              styles.pill,
              rarity === r.value && styles.pillActive,
            ]}
            onPress={() => setRarity(r.value)}
          >
            <Text
              style={[
                styles.pillText,
                rarity === r.value && styles.pillTextActive,
              ]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Grade */}
      {category === 'Monede' && (
        <>
          <Text style={styles.label}>Grad / stare</Text>
          <TextInput
            style={styles.input}
            value={grade}
            onChangeText={setGrade}
            placeholderTextColor="#6b7280"
          />
        </>
      )}

      {/* Description */}
      <Text style={styles.label}>Alte informații (opțional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
        placeholder="Detalii suplimentare despre piesă..."
        placeholderTextColor="#6b7280"
      />

      {/* Certification */}
      <View style={styles.sectionBox}>
        <TouchableOpacity
          style={styles.toggleRow}
          activeOpacity={0.8}
          onPress={() => {
            const next = !hasCertification;
            setHasCertification(next);
            if (!next) {
              setCertificationCode('');
              setCertificationGrade('');
            }
          }}
        >
          <View
            style={[
              styles.checkbox,
              hasCertification && styles.checkboxChecked,
            ]}
          >
            {hasCertification && <Text style={styles.checkboxCheck}>✓</Text>}
          </View>
          <View>
            <Text style={styles.toggleTitle}>Am certificare profesională</Text>
            <Text style={styles.toggleSubtitle}>
              Bifează dacă piesa este certificată de NGC sau PCGS.
            </Text>
          </View>
        </TouchableOpacity>

        {hasCertification && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Companie certificare *</Text>
            <View style={styles.pillRow}>
              {CERTIFICATION_COMPANIES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.pill,
                    certificationCompany === c.value && styles.pillActive,
                  ]}
                  onPress={() => {
                    setCertificationCompany(c.value);
                    setCertificationGrade('');
                  }}
                >
                  <Text
                    style={[
                      styles.pillText,
                      certificationCompany === c.value && styles.pillTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Cod certificare *</Text>
            <TextInput
              style={styles.input}
              value={certificationCode}
              onChangeText={setCertificationCode}
              placeholder={
                certificationCompany === 'NGC'
                  ? 'Ex: 1234567-999'
                  : 'Ex: 123456.78/12345678'
              }
              placeholderTextColor="#6b7280"
            />

            <Text style={styles.label}>Grad certificare *</Text>
            <HorizontalPillScroll>
              {certificationGrades.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.pill,
                    certificationGrade === g && styles.pillActive,
                  ]}
                  onPress={() => setCertificationGrade(g)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      certificationGrade === g && styles.pillTextActive,
                    ]}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </HorizontalPillScroll>
          </View>
        )}
      </View>

      {/* Accepts offers */}
      <View style={styles.sectionBox}>
        <TouchableOpacity
          style={styles.toggleRow}
          activeOpacity={0.8}
          onPress={() => setAcceptsOffers((v) => !v)}
        >
          <View
            style={[
              styles.checkbox,
              acceptsOffers && styles.checkboxChecked,
            ]}
          >
            {acceptsOffers && <Text style={styles.checkboxCheck}>✓</Text>}
          </View>
          <View>
            <Text style={styles.toggleTitle}>Accept ofertă de la cumpărători</Text>
            <Text style={styles.toggleSubtitle}>
              Permite cumpărătorilor să trimită oferte pentru piesă.
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Image Upload Section */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>Imagini</Text>
        <Text style={styles.toggleSubtitle}>
          Adaugă imagini pentru a crește șansele de vânzare
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity
            style={[styles.imageButton, { flex: 1 }]}
            onPress={handlePickImages}
          >
            <Text style={styles.imageButtonText}>Galerie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.imageButton, { flex: 1 }]}
            onPress={handleTakePhoto}
          >
            <Text style={styles.imageButtonText}>Cameră</Text>
          </TouchableOpacity>
        </View>

        {images.length > 0 && (
          <View style={styles.imageGrid}>
            {images.map((image, index) => (
              <View key={index} style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: image.uri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.imageRemoveButton}
                  onPress={() => handleRemoveImage(index)}
                >
                  <Text style={styles.imageRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {images.length > 0 && (
          <Text style={[styles.toggleSubtitle, { marginTop: 8 }]}>
            {images.length} imagine{images.length > 1 ? 'i' : ''} selectate
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.submitButton, (submitting || uploadingImages) && styles.submitButtonDisabled]}
        activeOpacity={0.9}
        onPress={handleSubmit}
        disabled={submitting || uploadingImages}
      >
        {submitting || uploadingImages ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color="#000940" />
            <Text style={styles.submitText}>
              {uploadingImages ? 'Se încarcă imaginile...' : 'Se salvează...'}
            </Text>
          </View>
        ) : (
          <Text style={styles.submitText}>
            {isEditing ? 'Salvează modificările' : 'Trimite spre aprobare'}
          </Text>
        )}
      </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 24,
    paddingBottom: 80, // Reduced from 150 to prevent excessive empty space
    backgroundColor: '#00020d',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f9fafb',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    fontSize: 14,
  },
  multiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#e7b73c',
    borderColor: '#e7b73c',
  },
  checkboxCheck: {
    color: '#000940',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  toggleSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    marginVertical: 4,
    gap: 8,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  pillActive: {
    borderColor: '#e7b73c',
    backgroundColor: 'rgba(231, 183, 60, 0.2)',
  },
  pillText: {
    fontSize: 12,
    color: '#e5e7eb',
  },
  pillTextActive: {
    color: '#facc6b',
    fontWeight: '600',
  },
  coinInfoBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.6)',
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  coinInfoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#bbf7d0',
    marginBottom: 4,
  },
  coinInfoText: {
    fontSize: 11,
    color: '#dcfce7',
  },
  durationRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  durationButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.6)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  durationButtonActive: {
    borderColor: 'rgba(231, 183, 60, 0.9)',
    backgroundColor: 'rgba(231, 183, 60, 0.16)',
  },
  durationText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#e5e7eb',
  },
  durationTextActive: {
    color: '#facc6b',
  },
  submitButton: {
    marginTop: 24,
    borderRadius: 999,
    backgroundColor: '#e7b73c',
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#e7b73c',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000940',
  },
  error: {
    marginTop: 4,
    marginBottom: 4,
    color: '#f97373',
    fontSize: 12,
  },
  imageButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.6)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  imageButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  imagePreviewContainer: {
    width: '30%',
    aspectRatio: 1,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  imageRemoveText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
});

export default NewListingScreen;
