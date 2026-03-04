import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions as cloudFunctions } from './firebaseConfig';
import type { Order, Product } from './types';
import { sha256Hex } from './utils/sha256';
import {
  notifyContractCreated,
  notifyContractAccepted,
  notifyContractRejected,
  notifyContractDisputed,
  notifyDisputeResolved,
} from './contractNotificationService';
import {
  sendContractAcceptedEmail,
  sendContractCreatedEmail,
  sendContractDisputedEmail,
  sendContractDisputeResolvedEmail,
  sendContractRejectedEmail,
} from './emailService';

// =====================================================
// CONTRACT CONFIGURATION
// =====================================================

export const CONTRACT_TEMPLATE_VERSION = 'RO-BS-2026.02-v3';
const CONTRACT_COMPANY_LEGAL_NAME = 'RECORD TRUST SRL';
const CONTRACT_PLATFORM_DOMAIN = 'enumismatica.ro';
const CONTRACT_PLATFORM_EMAIL = 'contact@enumismatica.ro';
const CONTRACT_PLATFORM_CITY = 'București';

export type ContractStatus = 'draft' | 'pending' | 'accepted' | 'immutable' | 'rejected' | 'cancelled';
export type ContractRole = 'buyer' | 'seller';
export type ContractLegalType = 'buyer_seller_sale';
export type ContractESignProvider = 'esemneaza';
export type ContractESignStatus = 'not_started' | 'in_progress' | 'completed' | 'canceled' | 'rejected' | 'failed';

export interface ContractESignRecipient {
  id?: string;
  role: ContractRole;
  name?: string;
  email?: string;
  sigStatus?: string;
  signUrl?: string;
}

export interface StartContractESignResponse {
  contractId: string;
  requestId: string;
  status: string;
  recipients: ContractESignRecipient[];
}

/**
 * Contract rejection reason
 */
export type ContractRejectionReason = 
  | 'buyer_refused'
  | 'seller_refused'
  | 'buyer_cancelled'
  | 'seller_cancelled'
  | 'payment_failed'
  | 'mutual_agreement'
  | 'other';

/**
 * Extended contract interface with all fields
 */
export interface AppContract {
  id: string;
  orderId: string;
  productId: string;
  
  // Product details denormalized for contract integrity
  productName: string;
  productDescription: string;
  productCategory?: string;
  productYear?: number;
  productCountry?: string;
  productCondition?: string;
  productMetal?: string;
  productGrade?: string;
  productCertification?: string;
  productImages?: string[];
  
  buyerId: string;
  sellerId: string;
  participantIds: string[];
  role: ContractRole;
  createdBy: string;
  contractNumber: string;
  templateVersion: string;
  legalType: ContractLegalType;
  title: string;
  body: string;
  bodyHash: string;
  pdfSnapshotBase64: string;
  
  // Acceptance tracking
  status: ContractStatus;
  immutableAfterBothAccepted: boolean;
  buyerAcceptedAt?: Date;
  sellerAcceptedAt?: Date;
  buyerAcceptedHash?: string;
  sellerAcceptedHash?: string;
  
  // Rejection/Cancellation tracking
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: ContractRejectionReason;
  cancellationReason?: string;
  
  // Dispute tracking
  disputedAt?: Date;
  disputedBy?: string;
  disputeReason?: string;
  disputeResolvedAt?: Date;
  disputeResolution?: string;
  
  // Expiration
  expiresAt?: Date;

  // External legal e-sign metadata (eSemaneaza)
  eSignProvider?: ContractESignProvider;
  eSignStatus?: ContractESignStatus;
  eSignRequestId?: string;
  eSignTemplateId?: string;
  eSignFileName?: string;
  eSignRecipients?: ContractESignRecipient[];
  eSignCompletedDocUrl?: string;
  eSignStartedAt?: Date;
  eSignCompletedAt?: Date;
  eSignLastSyncedAt?: Date;
  eSignError?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Product details for contract - extracted from Product entity
 */
export interface ContractProductDetails {
  name: string;
  description: string;
  category?: string;
  year?: number;
  country?: string;
  condition?: string;
  metal?: string;
  grade?: string;
  certification?: string;
  images?: string[];
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate unique contract number
 * Format: ENM-{ORDER_ID_SHORT}-{ROLE}-{TIMESTAMP}
 * Example: ENM-ABC12345-C-202602271200
 */
export const buildContractNumber = (orderId: string, role: ContractRole): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const orderShort = orderId.slice(0, 8).toUpperCase();
  const roleCode = role === 'buyer' ? 'C' : 'V'; // C = Cumpărător, V = Vânzător
  return `ENM-${orderShort}-${roleCode}-${timestamp}`;
};

/**
 * Format date for display in Romanian
 */
const formatDateTime = (value?: Date | null): string => {
  if (!value) return 'Nespecificată';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toLocaleString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return 'Nespecificată';
};

/**
 * Format date only (for contracts)
 */
const formatDate = (value?: Date | null): string => {
  if (!value) return 'Nespecificată';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
  return 'Nespecificată';
};

/**
 * Format amount with currency
 */
const formatAmount = (value: number, currency: string): string => {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: currency,
  }).format(value);
};

/**
 * Convert Date to Firestore timestamp or Date
 */
const toDate = (value: any, fallbackNow = false): Date | undefined => {
  if (!value) return fallbackNow ? new Date() : undefined;
  if (value.toDate && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value instanceof Date) return value;
  return new Date(value);
};

/**
 * Remove undefined top-level fields before writing to Firestore.
 * Firestore rejects documents containing explicit undefined values.
 */
const removeUndefinedFields = <T extends Record<string, any>>(obj: T): T => {
  Object.keys(obj).forEach((key) => {
    if (obj[key] === undefined) {
      delete obj[key];
    }
  });
  return obj;
};

// =====================================================
// PRODUCT FETCHING
// =====================================================

/**
 * Fetch product details from Firestore
 */
export async function getProductDetails(productId: string): Promise<ContractProductDetails | null> {
  if (!db) {
    console.warn('[ContractService] Firestore not initialized');
    return null;
  }
  
  try {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      console.warn('[ContractService] Product not found:', productId);
      return null;
    }
    
    const productData = productSnap.data();
    return {
      name: productData.name || 'Produs numismatic',
      description: productData.description || 'Fără descriere disponibilă',
      category: productData.category,
      year: productData.year,
      country: productData.country,
      condition: productData.grade || productData.condition,
      metal: productData.metal,
      grade: productData.grade || productData.certificationGrade,
      certification: productData.hasCertification ? productData.certificationCompany : undefined,
      images: productData.images || [],
    };
  } catch (error) {
    console.error('[ContractService] Error fetching product:', error);
    return null;
  }
}

/**
 * Fetch user display name from Firestore
 */
export async function getUserDisplayName(userId: string): Promise<string> {
  if (!db) return `Utilizator ${userId.slice(0, 6)}`;
  
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return userData.displayName || userData.name || `Utilizator ${userId.slice(0, 6)}`;
    }
  } catch (error) {
    console.warn('[ContractService] Error fetching user:', error);
  }
  
  return `Utilizator ${userId.slice(0, 6)}`;
}

// =====================================================
// CONTRACT BODY GENERATION
// =====================================================

/**
 * Build comprehensive contract body with actual product details
 */
export const buildContractBodyFromOrder = async (
  order: Order,
  role: ContractRole,
  contractNumber: string,
  productDetails?: ContractProductDetails | null,
): Promise<string> => {
  const now = new Date();
  
  // Fetch user names if not provided
  const buyerDisplay = order.buyerName || await getUserDisplayName(order.buyerId);
  const sellerDisplay = order.sellerName || await getUserDisplayName(order.sellerId);
  
  // Format payment method
  const paymentMethod = order.paymentProvider === 'manual' 
    ? 'Transfer bancar / Plată manuală' 
    : `Platforma de plăți (${order.paymentProvider})`;
  
  // Format shipping info
  const shippingInfo = order.awbNumber
    ? `Expediere prin ${order.courierName || 'curier'}, AWB: ${order.awbNumber}`
    : 'Expediere conform înțelegerii dintre părți, după confirmarea plății.';

  const productYearText = productDetails?.year ? String(productDetails.year) : 'Nespecificat';
  const productCategoryText = productDetails?.category || 'Nespecificată';
  const productCountryText = productDetails?.country || 'Nespecificată';
  const productConditionText = productDetails?.condition || 'Conform descrierii';
  const productMetalText = productDetails?.metal || 'Nespecificat';
  const productGradeText = productDetails?.grade || 'Nespecificat';
  const productCertificationText = productDetails?.certification || 'Fără certificare declarată';
  const paymentRefText = order.paymentReference || 'Nespecificată';
  const courierText = order.courierName || 'Nespecificat';
  const awbText = order.awbNumber || 'Nespecificat';
  
  // Build product description section
  const productSection = buildProductSection(productDetails);
  
  // Generate contract sections
  return [
    '═══════════════════════════════════════════════════════════════════════════════',
    '                        CONTRACT DE VÂNZARE-CUMPĂRARE',
    '                     (Persoane Fizice - Lei Românești)',
    '═══════════════════════════════════════════════════════════════════════════════',
    '',
    'GENERAT ELECTRONIC ÎN PLATFORMA eNumismatica',
    `Număr contract: ${contractNumber}`,
    `Versiune template: ${CONTRACT_TEMPLATE_VERSION}`,
    `Data generării: ${formatDateTime(now)}`,
    `Platforma: https://enumismatica.ro`,
    '',
    '───────────────────────────────────────────────────────────────────────────────',
    '                              I. PĂRȚILE CONTRACTANTE',
    '───────────────────────────────────────────────────────────────────────────────',
    '',
    `VÂNZĂTOR:`,
    `  Nume/Utilizator: ${sellerDisplay}`,
    `  ID Platformă: ${order.sellerId}`,
    '',
    `CUMPĂRĂTOR:`,
    `  Nume/Utilizator: ${buyerDisplay}`,
    `  ID Platformă: ${order.buyerId}`,
    '',
    'Declarații: Părțile declară că au capacitate legală deplină de exercițiu și dreptul',
    'de a încheia prezentul contract de vânzare-cumpărare.',
    '',
    '───────────────────────────────────────────────────────────────────────────────',
    '                         II. OBIECTUL CONTRACTULUI',
    '───────────────────────────────────────────────────────────────────────────────',
    '',
    productSection,
    '',
    'Date structurale produs:',
    `  - Categorie: ${productCategoryText}`,
    `  - An emisiune: ${productYearText}`,
    `  - Țară/emitent: ${productCountryText}`,
    `  - Material: ${productMetalText}`,
    `  - Stare declarată: ${productConditionText}`,
    `  - Grad/certificare: ${productGradeText}`,
    `  - Certificare companie: ${productCertificationText}`,
    '',
    '───────────────────────────────────────────────────────────────────────────────',
    '                         III. PREȚUL ȘI PLATA',
    '───────────────────────────────────────────────────────────────────────────────',
    '',
    `1. PREȚUL TOTAL: ${formatAmount(order.price, order.currency)}`,
    '',
    `2. MODALITATEA DE PLATĂ: ${paymentMethod}`,
    '',
    `3. REFERINȚA PLĂȚII: ${paymentRefText}`,
    '',
    `4. DATA MARCĂRII PLĂȚII DE CUMPĂRĂTOR: ${formatDateTime(order.buyerMarkedPaidAt)}`,
    '',
    `5. CONFIRMAREA PLĂȚII DE VÂNZĂTOR: ${formatDateTime(order.sellerConfirmedPaidAt)}`,
    '',
    `6. STATUS PLATĂ: ${getPaymentStatusText(order.status)}`,
    '',
    '───────────────────────────────────────────────────────────────────────────────',
    '                      IV. LIVRARE ȘI TRANSMITEREA PROPRIETĂȚII',
    '───────────────────────────────────────────────────────────────────────────────',
    '',
    `1. LIVRARE: ${shippingInfo}`,
    '',
    `2. CURIER: ${courierText}`,
    '',
    `3. NUMĂR AWB: ${awbText}`,
    '',
    `4. DATA EXPEDIERII: ${formatDate(order.shippingDate || null)}`,
    '',
    '5. Transferul proprietății asupra bunului se face după confirmarea plății complete,',
    '   la momentul predării către transportator sau direct către cumpărător.',
    '',
    '6. Riscul de deteriorare sau pierdere a bunului trece asupra cumpărătorului',
    '   din momentul predării către transportatorul agreat.',
    '',
    '7. Părțile confirmă că datele de livrare și contact sunt corecte la momentul acceptării.',
    '',
    '───────────────────────────────────────────────────────────────────────────────',
    '                         V. GARANȚII ȘI RĂSPUNDERE',
    '───────────────────────────────────────────────────────────────────────────────',
    '',
    '1. VÂNZĂTORUL garantează că:',
    '   a) Este titularul dreptului de proprietate asupra bunului;',
    '   b) Bunul nu este gajat, ipotecat sau supus altor sarcini;',
    '   c) Bunul poate fi înstrăinat legal;',
    '   d) Descrierea bunului în platformă este exactă și completă.',
    '',
    '2. CUMPĂRĂTORUL declară că:',
    '   a) A examinat descrierea, imaginile și caracteristicile bunului;',
    '   b) A verificat autenticitatea și starea bunului înainte de achiziție;',
    '   c) Acceptă bunul în starea descrisă de vânzător.',
    '',
    '3. Părțile au obligația de a comunica cu bună-credință pentru finalizarea',
    '   tranzacției, livrării și confirmării recepției.',
    '',
    '4. Fiecare parte răspunde pentru exactitatea datelor furnizate în platformă',
    '   (identitate, adrese, date de contact, informații privind bunul).',
    '',
    '5. Platforma facilitează schimbul de informații și arhivarea documentului,',
    `   fără a deveni parte contractuală în tranzacția dintre părți (${CONTRACT_COMPANY_LEGAL_NAME}).`,
    '',
    '───────────────────────────────────────────────────────────────────────────────',
    '                         VI. CLAUZE SPECIALE',
    '───────────────────────────────────────────────────────────────────────────────',
    '',
    '1. Prezentul contract este guvernat de legislația română în vigoare.',
    '',
    '2. Orice divergență se va soluționa cu prioritate pe cale amiabilă.',
    '',
    '3. În caz de neînțelegere, părțile pot solicita mediere sau pot adresa',
    '   instanțelor judecătorești competente din România.',
    '',
    '4. Prin acceptarea prezentului document, părțile confirmă că au citit și înțeles',
    '   integral conținutul contractual și acceptă efectele juridice ale acestuia.',
    '',
    '5. Părțile consimt utilizarea canalelor electronice pentru comunicările aferente',
    '   executării prezentului contract (mesaje în platformă, email, notificări).',
    '',
    '───────────────────────────────────────────────────────────────────────────────',
    '                        VII. CLAUZE FINALE',
    '───────────────────────────────────────────────────────────────────────────────',
    '',
    '1. Prezentul contract este generat electronic și arhivat în platforma',
    '   eNumismatica, fiind asociat în mod univoc tranzacției menționate.',
    '',
    '2. Documentul conține hash criptografic SHA-256 pentru verificarea integrității:',
    `   [HASH: va fi calculat după semnare]`,
    '',
    '3. După acceptarea ambelor părți, contractul devine imutabil și nu mai',
    '   poate fi modificat.',
    '',
    '4. Prezentul document are valoare de înscris sub semnătură privată, conform',
    '   Codului Civil Român, în măsura permisă de legislația în vigoare.',
    '',
    '5. Ambele părți au acces la același conținut contractual, verificabil',
    '   prin hash criptografic.',
    '',
    '6. Contractul este arhivat electronic și poate fi exportat în format PDF',
    '   împreună cu metadatele de trasabilitate (timestamp-uri, status semnare).',
    '',
    '7. Pentru semnare electronică calificată/avansată, părțile utilizează furnizorul',
    '   de semnături electronice integrat în fluxul platformei.',
    '',
    '───────────────────────────────────────────────────────────────────────────────',
    '                      VIII. ACCEPTARE ELECTRONICĂ',
    '───────────────────────────────────────────────────────────────────────────────',
    '',
    `Rolul utilizatorului curent: ${role === 'buyer' ? 'CUMPĂRĂTOR' : 'VÂNZĂTOR'}`,
    '',
    'Acceptarea se face prin:',
    '   - Click pe butonul "Accept contract" în aplicație;',
    '   - Marcaj temporal (timestamp) automat;',
    '   - Hash criptografic individual al acceptării.',
    '',
    'Contractul produce efecte juridice între părți din momentul înregistrării',
    'ambelor acceptări în sistem.',
    '',
    'Date platformă și suport:',
    `  - Operator platformă: ${CONTRACT_COMPANY_LEGAL_NAME}`,
    `  - Domeniu: ${CONTRACT_PLATFORM_DOMAIN}`,
    `  - Email suport: ${CONTRACT_PLATFORM_EMAIL}`,
    `  - Localitate: ${CONTRACT_PLATFORM_CITY}`,
    '',
    '═══════════════════════════════════════════════════════════════════════════════',
    '                              SEMNĂTURI',
    '═══════════════════════════════════════════════════════════════════════════════',
    '',
    `CUMPĂRĂTOR: _________________________  Data: _____________`,
    '',
    `VÂNZĂTOR: ___________________________  Data: _____________`,
    '',
    '═══════════════════════════════════════════════════════════════════════════════',
    `Contract generat pe ${formatDateTime(now)} | ID: ${contractNumber}`,
    '═══════════════════════════════════════════════════════════════════════════════',
  ].join('\n');
};

/**
 * Build product description section for contract
 */
function buildProductSection(productDetails?: ContractProductDetails | null): string {
  if (!productDetails) {
    return 'Produs: [Detalii indisponibile]\nID: [ID produs]';
  }
  
  const lines: string[] = [];
  
  // Main product info
  lines.push(`Denumire: ${productDetails.name}`);
  lines.push(`Descriere: ${productDetails.description}`);
  lines.push('');
  
  // Technical details
  const details: string[] = [];
  
  if (productDetails.category) {
    details.push(`Categorie: ${productDetails.category}`);
  }
  if (productDetails.year) {
    details.push(`An: ${productDetails.year}`);
  }
  if (productDetails.country) {
    details.push(`Țară de origine: ${productDetails.country}`);
  }
  if (productDetails.metal) {
    details.push(`Metal: ${productDetails.metal}`);
  }
  if (productDetails.condition) {
    details.push(`Stare/Condiție: ${productDetails.condition}`);
  }
  if (productDetails.grade) {
    details.push(`Grading: ${productDetails.grade}`);
  }
  if (productDetails.certification) {
    details.push(`Certificare: ${productDetails.certification}`);
  }
  
  if (details.length > 0) {
    lines.push('Caracteristici:');
    details.forEach(d => lines.push(`  - ${d}`));
  }
  
  return lines.join('\n');
}

/**
 * Get payment status text in Romanian
 */
function getPaymentStatusText(status: Order['status']): string {
  const statusMap: Record<string, string> = {
    'pending': 'În așteptarea plății',
    'payment_marked_by_buyer': 'Plată marcată de cumpărător',
    'paid': 'Plătită',
    'cancelled': 'Anulată',
    'failed': 'Eșuată',
    'refunded': 'Rambursată',
  };
  return statusMap[status] || status;
}

// =====================================================
// BASE64 ENCODING
// =====================================================

/**
 * Convert string to base64 (UTF-8 safe)
 */
function toBase64Utf8(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = unescape(encodeURIComponent(input));
  let output = '';
  
  for (let block = 0, charCode: number, idx = 0, map = chars;
    str.charAt(idx | 0) || ((map = '='), idx % 1);
    output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))) {
    charCode = str.charCodeAt(idx += 3 / 4);
    if (charCode > 0xFF) throw new Error('Invalid UTF-8 character for base64');
    block = (block << 8) | charCode;
  }
  
  return output;
}

/**
 * Build pseudo-PDF snapshot (placeholder for future PDF generation)
 */
function buildPseudoPdfSnapshotBase64(body: string): string {
  const payload = `PDF-SNAPSHOT\nGenerated: ${new Date().toISOString()}\n\n${body}`;
  return toBase64Utf8(payload);
}

// =====================================================
// CONTRACT OPERATIONS
// =====================================================

/**
 * Create a new contract from an order with full product details
 */
export async function createContractFromOrder(
  order: Order,
  createdByUserId: string,
  role: ContractRole,
): Promise<AppContract> {
  if (!db) throw new Error('Baza de date nu este inițializată.');

  // Fetch product details
  const productDetails = await getProductDetails(order.productId);
  
  // Build contract number and ID
  const contractNumber = buildContractNumber(order.id, role);
  const contractId = `${order.id}_${role}_${createdByUserId}`;
  
  // Build contract body with product details
  const body = await buildContractBodyFromOrder(order, role, contractNumber, productDetails);
  const bodyHash = sha256Hex(body);
  const pdfSnapshotBase64 = buildPseudoPdfSnapshotBase64(body);

  // Check if contract already exists
  const ref = doc(collection(db, 'contracts'), contractId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const existing = snap.data() as any;
    if (existing.immutableAfterBothAccepted === true) {
      throw new Error('Contractul este deja acceptat de ambele părți și nu mai poate fi modificat.');
    }
  }

  // Build contract payload
  const payload: any = {
    orderId: order.id,
    productId: order.productId,
    
    // Product details denormalized
    productName: productDetails?.name || 'Produs numismatic',
    productDescription: productDetails?.description || '',
    productCategory: productDetails?.category,
    productYear: productDetails?.year,
    productCountry: productDetails?.country,
    productCondition: productDetails?.condition,
    productMetal: productDetails?.metal,
    productGrade: productDetails?.grade,
    productCertification: productDetails?.certification,
    productImages: productDetails?.images,
    
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    participantIds: [order.buyerId, order.sellerId],
    role,
    createdBy: createdByUserId,
    contractNumber,
    templateVersion: CONTRACT_TEMPLATE_VERSION,
    legalType: 'buyer_seller_sale',
    title: `Contract ${contractNumber} - ${productDetails?.name || 'Produs numismatic'}`,
    body,
    bodyHash,
    pdfSnapshotBase64,
    status: 'draft',
    immutableAfterBothAccepted: false,
    eSignProvider: 'esemneaza',
    eSignStatus: 'not_started',
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  removeUndefinedFields(payload);

  await setDoc(ref, payload, { merge: true });

  // Send notifications to both parties (non-blocking)
  try {
    const buyerDoc = await getDoc(doc(db, 'users', order.buyerId));
    const sellerDoc = await getDoc(doc(db, 'users', order.sellerId));
    const buyerData = buyerDoc.exists() ? buyerDoc.data() : null;
    const sellerData = sellerDoc.exists() ? sellerDoc.data() : null;
    const buyerName = buyerData ? (buyerData.displayName || buyerData.name || 'Cumpărător') : 'Cumpărător';
    const sellerName = sellerData ? (sellerData.displayName || sellerData.name || 'Vânzător') : 'Vânzător';
    const buyerEmail = typeof buyerData?.email === 'string' ? buyerData.email : '';
    const sellerEmail = typeof sellerData?.email === 'string' ? sellerData.email : '';
    
    notifyContractCreated(
      order.buyerId,
      order.sellerId,
      contractId,
      contractNumber,
      productDetails?.name || 'Produs numismatic',
      buyerName,
      sellerName,
      order.price
    ).catch(err => console.warn('Failed to send contract created notifications:', err));

    if (buyerEmail) {
      sendContractCreatedEmail(
        buyerEmail,
        contractNumber,
        productDetails?.name || 'Produs numismatic',
        sellerName,
        'buyer',
        order.price,
      ).catch((err) => console.warn('Failed to send buyer contract-created email:', err));
    }

    if (sellerEmail) {
      sendContractCreatedEmail(
        sellerEmail,
        contractNumber,
        productDetails?.name || 'Produs numismatic',
        buyerName,
        'seller',
        order.price,
      ).catch((err) => console.warn('Failed to send seller contract-created email:', err));
    }
  } catch (notifyErr) {
    console.warn('Failed to send contract created notifications:', notifyErr);
  }

  // Fetch saved contract
  const saved = await getDoc(ref);
  if (!saved.exists()) {
    throw new Error('Contractul nu a putut fi salvat.');
  }

  return mapDocToContract(saved.id, saved.data());
}

/**
 * Accept a contract (buyer or seller)
 */
export async function acceptContract(
  contractId: string,
  userId: string,
): Promise<AppContract> {
  if (!db) throw new Error('Baza de date nu este inițializată.');

  const ref = doc(collection(db, 'contracts'), contractId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Contractul nu există.');

  const data = snap.data() as any;

  if (data.eSignStatus === 'in_progress' || data.eSignStatus === 'completed') {
    throw new Error('Acest contract folosește semnătură electronică externă. Semnează prin link-ul eSemnează.');
  }

  // If already immutable, return as is
  if (data.immutableAfterBothAccepted === true) {
    return mapDocToContract(snap.id, data);
  }

  // Verify user is a participant
  const participantIds = Array.isArray(data.participantIds) 
    ? data.participantIds 
    : [data.buyerId, data.sellerId];
    
  if (!participantIds.includes(userId)) {
    throw new Error('Nu ai permisiunea de a accepta acest contract.');
  }

  // Calculate acceptance hash
  const bodyHash = data.bodyHash || sha256Hex(String(data.body || ''));
  const acceptanceHash = sha256Hex(`${bodyHash}|${userId}|${new Date().toISOString()}`);
  
  // Build update payload
  const patch: any = {
    updatedAt: serverTimestamp(),
  };

  // Record buyer acceptance
  if (userId === data.buyerId && !data.buyerAcceptedAt) {
    patch.buyerAcceptedAt = serverTimestamp();
    patch.buyerAcceptedHash = acceptanceHash;
    patch.status = 'pending';
  }

  // Record seller acceptance
  if (userId === data.sellerId && !data.sellerAcceptedAt) {
    patch.sellerAcceptedAt = serverTimestamp();
    patch.sellerAcceptedHash = acceptanceHash;
    patch.status = 'pending';
  }

  // Check if both have accepted
  const buyerAccepted = !!(data.buyerAcceptedAt || patch.buyerAcceptedAt);
  const sellerAccepted = !!(data.sellerAcceptedAt || patch.sellerAcceptedAt);
  
  if (buyerAccepted && sellerAccepted) {
    patch.immutableAfterBothAccepted = true;
    patch.status = 'immutable';
  }

  await updateDoc(ref, patch);

  // Send notifications to the other party (non-blocking)
  try {
    const otherPartyId = userId === data.buyerId ? data.sellerId : data.buyerId;
    const userDoc = await getDoc(doc(db, 'users', userId));
    const otherDoc = await getDoc(doc(db, 'users', otherPartyId));
    const userData = userDoc.exists() ? userDoc.data() : null;
    const otherData = otherDoc.exists() ? otherDoc.data() : null;
    const userName = userData ? (userData.displayName || userData.name || 'Utilizator') : 'Utilizator';
    const otherName = otherData ? (otherData.displayName || otherData.name || 'Utilizator') : 'Utilizator';
    const buyerDoc = await getDoc(doc(db, 'users', data.buyerId));
    const sellerDoc = await getDoc(doc(db, 'users', data.sellerId));
    const buyerEmail = buyerDoc.exists() && typeof buyerDoc.data().email === 'string' ? buyerDoc.data().email : '';
    const sellerEmail = sellerDoc.exists() && typeof sellerDoc.data().email === 'string' ? sellerDoc.data().email : '';
    
    notifyContractAccepted(
      data.buyerId,
      data.sellerId,
      contractId,
      data.contractNumber,
      data.productName || 'Produs numismatic',
      userId,
      otherName
    ).catch(err => console.warn('Failed to send contract accepted notifications:', err));

    if (buyerEmail) {
      sendContractAcceptedEmail(
        buyerEmail,
        data.contractNumber,
        data.productName || 'Produs numismatic',
        userName,
        'buyer',
      ).catch((err) => console.warn('Failed to send buyer contract-accepted email:', err));
    }

    if (sellerEmail) {
      sendContractAcceptedEmail(
        sellerEmail,
        data.contractNumber,
        data.productName || 'Produs numismatic',
        userName,
        'seller',
      ).catch((err) => console.warn('Failed to send seller contract-accepted email:', err));
    }
  } catch (notifyErr) {
    console.warn('Failed to send contract accepted notifications:', notifyErr);
  }

  // Fetch updated contract
  const updated = await getDoc(ref);
  const next = updated.data() as any;
  return mapDocToContract(updated.id, next);
}

/**
 * Get all contracts for a user
 */
export async function getContractsForUser(userId: string): Promise<AppContract[]> {
  if (!db) throw new Error('Baza de date nu este inițializată.');

  const contractsRef = collection(db, 'contracts');
  const q = query(contractsRef, where('participantIds', 'array-contains', userId));
  const snap = await getDocs(q);

  const items: AppContract[] = snap.docs.map((d) => mapDocToContract(d.id, d.data()));
  
  // Sort by creation date (newest first)
  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get contracts filtered by status
 */
export async function getContractsByStatus(
  userId: string, 
  status: ContractStatus
): Promise<AppContract[]> {
  const allContracts = await getContractsForUser(userId);
  return allContracts.filter(c => c.status === status);
}

/**
 * Get pending contracts (contracts awaiting user's acceptance)
 */
export async function getPendingContractsForUser(userId: string): Promise<AppContract[]> {
  const allContracts = await getContractsForUser(userId);
  return allContracts.filter(c => 
    c.status === 'draft' || 
    c.status === 'pending' ||
    (c.status === 'accepted' && !c.immutableAfterBothAccepted)
  );
}

/**
 * Get a single contract by ID
 */
export async function getContractById(contractId: string): Promise<AppContract | null> {
  if (!db) return null;
  
  const ref = doc(db, 'contracts', contractId);
  const snap = await getDoc(ref);
  
  if (!snap.exists()) return null;
  
  return mapDocToContract(snap.id, snap.data());
}

/**
 * Reject or cancel a contract
 */
export async function rejectContract(
  contractId: string,
  userId: string,
  reason: ContractRejectionReason,
  additionalReason?: string,
): Promise<AppContract> {
  if (!db) throw new Error('Baza de date nu este inițializată.');

  const ref = doc(db, 'contracts', contractId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Contractul nu există.');

  const data = snap.data() as any;

  // If already immutable, cannot reject
  if (data.immutableAfterBothAccepted === true) {
    throw new Error('Contractul a fost deja acceptat și nu mai poate fi anulat.');
  }

  // Verify user is a participant
  const participantIds = Array.isArray(data.participantIds) 
    ? data.participantIds 
    : [data.buyerId, data.sellerId];
    
  if (!participantIds.includes(userId)) {
    throw new Error('Nu ai permisiunea de a rejecta acest contract.');
  }

  // Determine if buyer or seller is rejecting
  const isBuyer = userId === data.buyerId;

  if (data.eSignStatus === 'in_progress' && data.eSignRequestId) {
    try {
      await cancelContractESign(contractId);
    } catch (cancelErr) {
      console.warn('Failed to cancel e-sign request during rejection flow:', cancelErr);
    }
  }

  // Build update payload
  const patch: any = {
    status: 'cancelled',
    rejectedAt: serverTimestamp(),
    rejectedBy: userId,
    rejectionReason: reason,
    eSignStatus: data.eSignStatus === 'in_progress' ? 'canceled' : data.eSignStatus,
    cancellationReason: additionalReason || `${isBuyer ? 'Cumpărătorul' : 'Vânzătorul'} a refuzat contractul: ${reason}`,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, patch);

  // Send notifications to the other party (non-blocking)
  try {
    const otherPartyId = userId === data.buyerId ? data.sellerId : data.buyerId;
    const userDoc = await getDoc(doc(db, 'users', userId));
    const otherDoc = await getDoc(doc(db, 'users', otherPartyId));
    const userData = userDoc.exists() ? userDoc.data() : null;
    const otherData = otherDoc.exists() ? otherDoc.data() : null;
    const userName = userData ? (userData.displayName || userData.name || 'Utilizator') : 'Utilizator';
    const otherName = otherData ? (otherData.displayName || otherData.name || 'Utilizator') : 'Utilizator';
    const buyerDoc = await getDoc(doc(db, 'users', data.buyerId));
    const sellerDoc = await getDoc(doc(db, 'users', data.sellerId));
    const buyerEmail = buyerDoc.exists() && typeof buyerDoc.data().email === 'string' ? buyerDoc.data().email : '';
    const sellerEmail = sellerDoc.exists() && typeof sellerDoc.data().email === 'string' ? sellerDoc.data().email : '';
    const fullReason = additionalReason || `${isBuyer ? 'Cumpărătorul' : 'Vânzătorul'} a refuzat contractul: ${reason}`;
    
    notifyContractRejected(
      data.buyerId,
      data.sellerId,
      contractId,
      data.contractNumber,
      data.productName || 'Produs numismatic',
      userId,
      otherName,
      fullReason
    ).catch(err => console.warn('Failed to send contract rejected notifications:', err));

    if (buyerEmail) {
      sendContractRejectedEmail(
        buyerEmail,
        data.contractNumber,
        data.productName || 'Produs numismatic',
        isBuyer ? userName : otherName,
        fullReason,
      ).catch((err) => console.warn('Failed to send buyer contract-rejected email:', err));
    }

    if (sellerEmail) {
      sendContractRejectedEmail(
        sellerEmail,
        data.contractNumber,
        data.productName || 'Produs numismatic',
        isBuyer ? userName : otherName,
        fullReason,
      ).catch((err) => console.warn('Failed to send seller contract-rejected email:', err));
    }
  } catch (notifyErr) {
    console.warn('Failed to send contract rejected notifications:', notifyErr);
  }

  // Fetch updated contract
  const updated = await getDoc(ref);
  return mapDocToContract(updated.id, updated.data());
}

/**
 * Raise a dispute on a contract
 */
export async function raiseContractDispute(
  contractId: string,
  userId: string,
  disputeReason: string,
): Promise<AppContract> {
  if (!db) throw new Error('Baza de date nu este inițializată.');

  const ref = doc(db, 'contracts', contractId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Contractul nu există.');

  const data = snap.data() as any;

  // If already immutable or cancelled, cannot dispute
  if (data.immutableAfterBothAccepted === true) {
    throw new Error('Contractul a fost finalizat și nu mai poate fi contestat.');
  }
  if (data.status === 'cancelled') {
    throw new Error('Contractul a fost anulat și nu mai poate fi contestat.');
  }

  // Verify user is a participant
  const participantIds = Array.isArray(data.participantIds) 
    ? data.participantIds 
    : [data.buyerId, data.sellerId];
    
  if (!participantIds.includes(userId)) {
    throw new Error('Nu ai permisiunea de a contesta acest contract.');
  }

  // Build update payload
  const patch: any = {
    disputedAt: serverTimestamp(),
    disputedBy: userId,
    disputeReason: disputeReason,
    // Keep existing status but mark as disputed
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, patch);

  // Send notifications (non-blocking)
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? userDoc.data() : null;
    const userName = userData ? (userData.displayName || userData.name || 'Utilizator') : 'Utilizator';
    const buyerDoc = await getDoc(doc(db, 'users', data.buyerId));
    const sellerDoc = await getDoc(doc(db, 'users', data.sellerId));
    const buyerEmail = buyerDoc.exists() && typeof buyerDoc.data().email === 'string' ? buyerDoc.data().email : '';
    const sellerEmail = sellerDoc.exists() && typeof sellerDoc.data().email === 'string' ? sellerDoc.data().email : '';
    
    notifyContractDisputed(
      data.buyerId,
      data.sellerId,
      contractId,
      data.contractNumber,
      data.productName || 'Produs numismatic',
      userId,
      disputeReason
    ).catch(err => console.warn('Failed to send contract disputed notifications:', err));

    if (buyerEmail) {
      sendContractDisputedEmail(
        buyerEmail,
        data.contractNumber,
        data.productName || 'Produs numismatic',
        userName,
        disputeReason,
      ).catch((err) => console.warn('Failed to send buyer contract-disputed email:', err));
    }

    if (sellerEmail) {
      sendContractDisputedEmail(
        sellerEmail,
        data.contractNumber,
        data.productName || 'Produs numismatic',
        userName,
        disputeReason,
      ).catch((err) => console.warn('Failed to send seller contract-disputed email:', err));
    }
  } catch (notifyErr) {
    console.warn('Failed to send contract disputed notifications:', notifyErr);
  }

  // Fetch updated contract
  const updated = await getDoc(ref);
  return mapDocToContract(updated.id, updated.data());
}

/**
 * Resolve a contract dispute (admin only)
 */
export async function resolveContractDispute(
  contractId: string,
  adminUserId: string,
  resolution: string,
): Promise<AppContract> {
  if (!db) throw new Error('Baza de date nu este inițializată.');

  const ref = doc(db, 'contracts', contractId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Contractul nu există.');

  const data = snap.data() as any;

  // Build update payload
  const patch: any = {
    disputeResolvedAt: serverTimestamp(),
    disputeResolution: resolution,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, patch);

  try {
    notifyDisputeResolved(
      data.buyerId,
      data.sellerId,
      contractId,
      data.contractNumber,
      data.productName || 'Produs numismatic',
      resolution,
    ).catch((err) => console.warn('Failed to send dispute-resolved notifications:', err));

    const buyerDoc = await getDoc(doc(db, 'users', data.buyerId));
    const sellerDoc = await getDoc(doc(db, 'users', data.sellerId));
    const buyerEmail = buyerDoc.exists() && typeof buyerDoc.data().email === 'string' ? buyerDoc.data().email : '';
    const sellerEmail = sellerDoc.exists() && typeof sellerDoc.data().email === 'string' ? sellerDoc.data().email : '';

    if (buyerEmail) {
      sendContractDisputeResolvedEmail(
        buyerEmail,
        data.contractNumber,
        data.productName || 'Produs numismatic',
        resolution,
      ).catch((err) => console.warn('Failed to send buyer dispute-resolved email:', err));
    }

    if (sellerEmail) {
      sendContractDisputeResolvedEmail(
        sellerEmail,
        data.contractNumber,
        data.productName || 'Produs numismatic',
        resolution,
      ).catch((err) => console.warn('Failed to send seller dispute-resolved email:', err));
    }
  } catch (notifyErr) {
    console.warn('Failed to process dispute-resolved notifications/emails:', notifyErr);
  }

  // Fetch updated contract
  const updated = await getDoc(ref);
  return mapDocToContract(updated.id, updated.data());
}

/**
 * Start legal e-sign flow via Cloud Functions (eSemnează).
 */
export async function startContractESign(contractId: string, templateId?: string): Promise<StartContractESignResponse> {
  if (!cloudFunctions) {
    throw new Error('Funcțiile cloud nu sunt inițializate.');
  }

  const call = httpsCallable(cloudFunctions, 'startContractESignCallable');
  const payload: Record<string, string> = { contractId };
  if (templateId && templateId.trim()) {
    payload.templateId = templateId.trim();
  }
  const result = await call(payload);
  return result.data as StartContractESignResponse;
}

/**
 * Cancel an in-progress e-sign request for a contract.
 */
export async function cancelContractESign(contractId: string): Promise<{contractId: string; canceled: boolean}> {
  if (!cloudFunctions) {
    throw new Error('Funcțiile cloud nu sunt inițializate.');
  }

  const call = httpsCallable(cloudFunctions, 'cancelContractESignCallable');
  const result = await call({ contractId });
  return result.data as {contractId: string; canceled: boolean};
}

/**
 * Sync e-sign status for a contract from backend provider state.
 */
export async function syncContractESignStatus(contractId: string): Promise<AppContract | null> {
  if (!cloudFunctions) {
    throw new Error('Funcțiile cloud nu sunt inițializate.');
  }

  const call = httpsCallable(cloudFunctions, 'syncContractESignStatusCallable');
  await call({ contractId });
  return getContractById(contractId);
}

/**
 * Map Firestore document to AppContract
 */
function mapDocToContract(id: string, data: any): AppContract {
  return {
    id,
    orderId: data.orderId,
    productId: data.productId,
    
    // Product details
    productName: data.productName || 'Produs numismatic',
    productDescription: data.productDescription || '',
    productCategory: data.productCategory,
    productYear: data.productYear,
    productCountry: data.productCountry,
    productCondition: data.productCondition,
    productMetal: data.productMetal,
    productGrade: data.productGrade,
    productCertification: data.productCertification,
    productImages: data.productImages,
    
    buyerId: data.buyerId,
    sellerId: data.sellerId,
    participantIds: Array.isArray(data.participantIds) 
      ? data.participantIds 
      : [data.buyerId, data.sellerId],
    role: data.role,
    createdBy: data.createdBy,
    contractNumber: data.contractNumber,
    templateVersion: data.templateVersion || CONTRACT_TEMPLATE_VERSION,
    legalType: data.legalType || 'buyer_seller_sale',
    title: data.title,
    body: data.body,
    bodyHash: data.bodyHash || '',
    pdfSnapshotBase64: data.pdfSnapshotBase64 || '',
    
    // Status
    status: mapContractStatus(data),
    immutableAfterBothAccepted: !!data.immutableAfterBothAccepted,
    buyerAcceptedAt: toDate(data.buyerAcceptedAt),
    sellerAcceptedAt: toDate(data.sellerAcceptedAt),
    buyerAcceptedHash: data.buyerAcceptedHash,
    sellerAcceptedHash: data.sellerAcceptedHash,
    
    // Rejection/Cancellation
    rejectedAt: toDate(data.rejectedAt),
    rejectedBy: data.rejectedBy,
    rejectionReason: data.rejectionReason,
    cancellationReason: data.cancellationReason,
    
    // Dispute
    disputedAt: toDate(data.disputedAt),
    disputedBy: data.disputedBy,
    disputeReason: data.disputeReason,
    disputeResolvedAt: toDate(data.disputeResolvedAt),
    disputeResolution: data.disputeResolution,
    
    // Expiration
    expiresAt: toDate(data.expiresAt),

    // eSign
    eSignProvider: data.eSignProvider,
    eSignStatus: data.eSignStatus,
    eSignRequestId: data.eSignRequestId,
    eSignTemplateId: data.eSignTemplateId,
    eSignFileName: data.eSignFileName,
    eSignRecipients: Array.isArray(data.eSignRecipients) ? data.eSignRecipients : [],
    eSignCompletedDocUrl: data.eSignCompletedDocUrl,
    eSignStartedAt: toDate(data.eSignStartedAt),
    eSignCompletedAt: toDate(data.eSignCompletedAt),
    eSignLastSyncedAt: toDate(data.eSignLastSyncedAt),
    eSignError: data.eSignError,
    
    createdAt: toDate(data.createdAt, true) || new Date(),
    updatedAt: toDate(data.updatedAt, true) || new Date(),
  };
}

/**
 * Map legacy data to contract status
 */
function mapContractStatus(data: any): ContractStatus {
  if (data.eSignStatus === 'completed') return 'immutable';
  if (data.eSignStatus === 'rejected' || data.eSignStatus === 'canceled') return 'cancelled';
  if (data.status && ['draft', 'pending', 'accepted', 'immutable', 'rejected', 'cancelled'].includes(data.status)) {
    return data.status;
  }
  if (data.rejectedAt || data.cancellationReason) return 'cancelled';
  if (data.immutableAfterBothAccepted === true) return 'immutable';
  if (data.buyerAcceptedAt && data.sellerAcceptedAt) return 'accepted';
  if (data.buyerAcceptedAt || data.sellerAcceptedAt) return 'pending';
  return 'draft';
}
