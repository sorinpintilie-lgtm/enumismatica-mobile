export interface User {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatar?: string;
  role: 'user' | 'admin' | 'moderator' | 'superadmin';
  createdAt: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  preferences?: UserPreferences;
  helpPreferences?: UserHelpPreferences;
  notificationPreferences?: UserNotificationPreferences;

  /**
   * Private personal/contact details.
   * Visible and editable only by the user and admins.
   */
  personalDetails?: UserPersonalDetails;

  /**
  * Identity verification fields (Romania CI / Passport).
  *
  * - idDocumentType / idDocumentNumber: raw document metadata provided at signup
  * - idDocumentSeries: document series for verification
  * - idVerificationStatus: manual verification state controlled by admins
  * - idVerifiedAt / idVerifiedBy: audit trail for who verified and when
  * - idDocumentPhotos: URLs of uploaded ID document photos (front and back)
  */
  idDocumentType?: 'ci' | 'passport';
  idDocumentSeries?: string;
  idDocumentNumber?: string;
  idVerificationStatus?: 'not_provided' | 'pending' | 'verified' | 'rejected';
  idVerifiedAt?: Date;
  idVerifiedBy?: string;
  idDocumentPhotos?: string[];

  /**
   * Current credit balance for the user.
   */
  credits?: number;

  /**
   * Referral system fields.
   */
  referralCode?: string;
  referredBy?: string;
  referralBonusApplied?: boolean;

  /**
   * Time-limited signup / referral bonus tracking.
   * - signupBonusCreditsRemaining: how many promotional credits can still expire
   * - signupBonusExpiresAt: when the promotional credits expire
   */
  signupBonusCreditsRemaining?: number;
  signupBonusExpiresAt?: Date;

  /**
   * "My collection" subscription:
   * user must pay 50 credits / year to keep collection features active.
   */
  collectionSubscriptionExpiresAt?: Date;
}

export interface UserPersonalDetails {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  county?: string;
  postalCode?: string;
  country?: string;
  // Billing details (optional separate billing address)
  billingAddress?: string;
  billingCounty?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  bankAccount?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'ro' | 'en';
  notifications: boolean;
}

export interface UserNotificationPreferences {
  pushEnabled: boolean;
  auctionOutbid: boolean;
  auctionWon: boolean;
  auctionEndedNoWin: boolean;
  watchlistUpdates: boolean;
  offerUpdates: boolean;
  orderUpdates: boolean;
  messageUpdates: boolean;
  systemUpdates: boolean;
  marketingUpdates: boolean;
}

export interface UserHelpPreferences {
  preferredLanguage: 'ro' | 'en';
  viewedArticles: string[];
  helpfulRatings: Record<string, 'helpful' | 'not_helpful'>;
}

/**
 * Product entity representing a numismatic item for sale.
 * Stored in 'products' collection.
 */
export interface Product {
id: string;
name: string;
description: string;
images: string[]; // Array of image URLs
/**
 * Raw/original image URLs (optional).
 * When using async/background compression, uploads may land here first.
 */
imagesRaw?: string[];

/**
 * Async image processing status (optional).
 * Used when images are uploaded first and optimized later.
 */
imageProcessingStatus?: 'processing' | 'done' | 'error';
imageProcessingTotal?: number;
imageProcessingDone?: number;
imageProcessingError?: string;
video?: string; // Optional video URL for demonstration
price: number; // Base price in the platform's currency
ownerId: string; // Reference to the user who owns this product
status: 'pending' | 'approved' | 'rejected'; // Approval status
listingType?: 'direct' | 'auction'; // Type of listing

/**
 * Pullback feature fields
 * Used to track the original collection ID and pullback status
 */
originalCollectionId?: string; // ID of the collection item this product was created from
isPulledBack?: boolean; // Whether the item has been pulled back to collection
pulledBackAt?: Date; // When the item was pulled back

  // Coin-specific metadata for categorization and filtering
  country?: string; // Country of origin (e.g., "Russia", "USA", "Germany")
  year?: number; // Year of minting
  era?: string; // Historical era (e.g., "1895-1917", "Modern", "Ancient")
  denomination?: string; // Coin denomination (e.g., "1 Ruble", "10 Kopeks")
  metal?: string; // Metal composition (e.g., "Silver", "Gold", "Bronze", "Copper")
  grade?: string; // Coin grade/condition (e.g., "MS-65", "VF", "XF", "AU")
  mintMark?: string; // Mint mark if applicable
  rarity?: 'common' | 'uncommon' | 'rare' | 'very-rare' | 'extremely-rare';
  weight?: number; // Weight in grams
  diameter?: number; // Diameter in millimeters
  category?: string; // General category (e.g., "coins", "banknotes", "medals")

  // Certification fields (NGC, PCGS, etc.)
  hasCertification?: boolean;
  certificationCompany?: 'NGC' | 'PCGS';
  certificationCode?: string;
  certificationGrade?: string;
  
  // Legacy NGC fields for backward compatibility
  hasNgcCertification?: boolean;
  ngcCode?: string;
  ngcGrade?: string;

  // Offer functionality
  acceptsOffers?: boolean;

  /**
   * Basic paid shop listing:
   *  - listingExpiresAt: until when the product is kept in the shop
   *    (5 credits per 30 days, extended when the user pays again).
   */
  listingExpiresAt?: Date;

  // Boosted visibility fields (existing "boost" feature)
  boostExpiresAt?: Date; // Until when this product is boosted in listings
  boostedAt?: Date; // When the current boost was applied

  /**
   * Strong promotion / homepage highlight:
   *  - isPromoted: whether the product is promoted
   *  - promotedAt: when promotion was applied
   *  - promotionExpiresAt: when promotion ends
   * This is paid with 20 credits via promoteItemWithCredits().
   */
  isPromoted?: boolean;
  promotedAt?: Date;
  promotionExpiresAt?: Date;

  /**
   * Direct shop sale state:
   *  - isSold / soldAt: mark when the product has been bought.
   *  - buyerId: who bought it.
   *  - orderId: reference to the order in 'orders' collection.
   *
   * These are set by the orderService / payment flow.
   */
  isSold?: boolean;
  soldAt?: Date;
  buyerId?: string;
  orderId?: string;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Auction entity representing an auction for a product.
 * Stored in 'auctions' collection.
 * Has a subcollection 'bids' containing Bid documents.
 */
export interface Auction {
  id: string;
  productId: string; // Reference to the product being auctioned

  /**
   * Optional owner of the auction (usually the product owner).
   * Used when charging credit-based auction creation fees and promotions.
   */
  ownerId?: string;

  startTime: Date;
  endTime: Date;

  /**
   * Public starting price (minimum first bid visible to all).
   * This is used as the base amount for the first bid and for filters/sorting.
   */
  reservePrice: number;

  /**
   * Hidden minimum accepted price (minimum price guarantee).
   * - Only the seller should know this value (never shown publicly).
   * - At auction end, if currentBid < (minAcceptPrice ?? reservePrice),
   *   the auction is treated as having no winner.
   */
  minAcceptPrice?: number;

  currentBid?: number; // Current highest bid amount
  currentBidderId?: string; // User ID of the current highest bidder

  /**
   * Winner metadata set when an auction ends.
   * Used to build dashboards, email links, and reliable transaction history.
   */
  winnerId?: string | null;
  didMeetMinimum?: boolean;
  winnerConversationId?: string;
  winnerName?: string;
  sellerName?: string;

  /**
   * Optional "Cumpără acum" (Buy Now) configuration.
   * If set, users can instantly buy the item for this price while the auction is active.
   */
  buyNowPrice?: number;
  buyNowUsed?: boolean;

  /**
   * Credit-fee metadata:
   *  - creditFeeAmount: how many credits were paid to create this auction
   *  - paidDurationHours: how many hours of runtime were paid for
   * These are set by chargeAuctionCreationWithCredits().
   */
  creditFeeAmount?: number;
  paidDurationHours?: number;

  /**
   * Strong promotion / homepage highlight for auctions.
   */
  isPromoted?: boolean;
  promotedAt?: Date;
  promotionExpiresAt?: Date;

  /**
   * Pullback feature fields
   * Used to track the original collection ID and pullback status
   */
  originalCollectionId?: string; // ID of the collection item this auction was created from
  isPulledBack?: boolean; // Whether the item has been pulled back to collection
  pulledBackAt?: Date; // When the item was pulled back

  status: 'pending' | 'active' | 'ended' | 'cancelled' | 'rejected'; // Approval and activity status
  createdAt: Date;
  updatedAt: Date;
}

/**
 * WatchlistItem entity representing an item in user's watchlist.
 * Stored in 'users/{userId}/watchlist' subcollection.
 */
export interface WatchlistItem {
  id: string;
  userId: string;
  itemType: 'product' | 'auction';
  itemId: string;
  addedAt: Date;
  notes?: string;
  notificationPreferences?: {
    priceChanges: boolean;
    auctionUpdates: boolean;
    bidActivity: boolean;
  };
}

/**
 * CartItem entity representing a product added to a user's cart.
 * Stored in 'users/{userId}/cart' subcollection.
 */
export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  addedAt: Date;
  isMintProduct?: boolean;
  mintProductData?: any;
}

/**
 * HelpArticle entity for Help Center content.
 * Stored in 'helpArticles' collection.
 */
export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  language: 'ro' | 'en';
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  views: number;
  helpfulCount: number;
  notHelpfulCount: number;
  status: 'draft' | 'published' | 'archived';
  version: number;
}

/**
 * HelpCategory entity for organizing help content.
 * Stored in 'helpCategories' collection.
 */
export interface HelpCategory {
  id: string;
  name: string;
  description: string;
  order: number;
  parentCategoryId?: string;
  icon?: string;
  language: 'ro' | 'en';
}

/**
 * HelpSearchResult entity for search functionality.
 */
export interface HelpSearchResult {
  articleId: string;
  title: string;
  contentPreview: string;
  categoryName: string;
  relevanceScore: number;
  language: 'ro' | 'en';
}

/**
 * HelpFeedback entity for user feedback on help articles.
 */
export interface HelpFeedback {
  articleId: string;
  userId: string;
  rating: 'helpful' | 'not_helpful';
  feedback?: string;
  createdAt: Date;
}

/**
 * HelpAnalytics entity for help center analytics.
 */
export interface HelpAnalytics {
  totalArticles: number;
  totalViews: number;
  helpfulRatingPercentage: number;
  mostViewedArticles: HelpArticle[];
  mostHelpfulArticles: HelpArticle[];
}

/**
 * Bid entity representing a bid placed on an auction.
 * Stored in 'auctions/{auctionId}/bids' subcollection.
 */
export interface Bid {
  id: string;
  auctionId: string;
  userId: string;
  amount: number;
  timestamp: Date;
}

/**
 * AutoBid entity representing an automatic bidding rule.
 * Stored in 'auctions/{auctionId}/autoBids' subcollection.
 */
export interface AutoBid {
  id: string;
  auctionId: string;
  userId: string;
  maxAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * BidHistory entity for tracking bid history visualization data.
 * This extends the basic Bid with additional metadata for visualization.
 */
export interface BidHistory extends Bid {
  userName?: string;
  userAvatar?: string;
  isAutoBid?: boolean;
  bidPosition?: number; // Position in bid sequence
  timeSincePreviousBid?: number; // Milliseconds since previous bid
  priceChange?: number; // Change from previous bid amount
  priceChangePercent?: number; // Percentage change from previous bid
}

/**
 * BidHistoryStats for aggregated bid history statistics.
 */
export interface BidHistoryStats {
  totalBids: number;
  totalBidders: number;
  highestBid: number;
  lowestBid: number;
  averageBid: number;
  totalValue: number;
  bidFrequency: number; // bids per hour
  competitionIndex: number; // unique bidders / total bids ratio
  priceTrend: 'up' | 'down' | 'stable'; // Overall price movement trend
}

/**
 * SiteAsset entity representing a site-wide asset like logo or hero image.
 * Stored in 'siteAssets' collection.
 */
export interface SiteAsset {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  altText?: string;
  type: 'logo' | 'hero' | 'banner' | 'icon' | 'other';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CollectionItem entity representing an item in a user's collection.
 * Stored in 'users/{userId}/collection' subcollection.
 *
 * UI rules:
 * - "Nou" badge: shown for the first 12 hours after createdAt.
 * - "Vândut" badge: shown for 24 hours after soldAt (when item is marked as sold).
 */
export interface CollectionItem {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category?: string;
  type?: string;
  year?: number;
  era?: string;
  country?: string;
  denomination?: string;
  metal?: string;
  grade?: string;
  mintMark?: string;
  rarity?: string;
  tags?: string[];
  weight?: number;
  diameter?: number;
  condition?: string;
  acquisitionDate?: Date;
  acquisitionPrice?: number;
  currentValue?: number;
  purchaseSource?: string;
  images?: string[];
  video?: string; // Video URL for demonstration
  notes?: string;
  isPublic?: boolean;

  // Certification fields (NGC, PCGS, etc.)
  hasCertification?: boolean;
  certificationCompany?: 'NGC' | 'PCGS';
  certificationCode?: string;
  certificationGrade?: string;
  
  // Legacy NGC fields for backward compatibility
  hasNgcCertification?: boolean;
  ngcCode?: string;
  ngcGrade?: string;

  /**
   * Mark when an item from the collection has been sold.
   * Used to show "Vândut" for 24 hours after this timestamp.
   */
  isSold?: boolean;
  soldAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Conversation entity representing a chat conversation.
 * Stored in 'conversations' collection.
 */
export interface Conversation {
  id: string;
  participants: string[];
  title?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastMessageBy?: string;
  unreadCount?: number;
  isGroup?: boolean;
  isAdminSupport?: boolean;
  auctionId?: string;
  productId?: string;
  buyerId?: string;
  sellerId?: string;
  buyerName?: string;
  sellerName?: string;
  buyerEmail?: string;
  sellerEmail?: string;
  buyerPhone?: string;
  sellerPhone?: string;
  status?: string;
}

/**
 * ChatMessage entity representing a message in a conversation.
 * Stored in 'conversations/{conversationId}/messages' subcollection.
 */
export interface ChatMessage {
  id: string;
  conversationId?: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  message: string;
  timestamp: Date;
  editedAt?: Date;
  isRead?: boolean;
  isAnonymous?: boolean;
  edited?: boolean;
  deleted?: boolean;
  attachments?: string[];
  readBy?: string[];
}

/**
 * AuctionNotification entity representing a notification about auction activity.
 * Stored in 'users/{userId}/auctionNotifications' subcollection.
 */
export interface AuctionNotification {
  id: string;
  userId: string;
  type: 'outbid' | 'auction_won' | 'auction_ended_no_win';
  message: string;
  read: boolean;
  pushed: boolean;
  createdAt: Date;
  auctionId?: string;
  auctionTitle?: string;
  bidAmount?: number;
}

/**
 * ChatNotification entity representing a notification about chat activity.
 * Stored in 'users/{userId}/notifications' subcollection.
 */
export interface ChatNotification {
  id: string;
  userId: string;
  type:
    | 'new_message'
    | 'conversation_started'
    | 'message_read'
    | 'outbid'
    | 'auction_won'
    | 'auction_ended_no_win'
    | 'system';
  senderId?: string;
  senderName?: string;
  title?: string;
  message: string;
  read: boolean;
  pushed: boolean;
  createdAt: Date;
  conversationId?: string;
  auctionId?: string;
  auctionTitle?: string;
  bidAmount?: number;
}

/**
 * UserPresence entity representing user presence status.
 * Stored in 'presence/{userId}' collection.
 */
export interface UserPresence {
  userId: string;
  lastActive: Date;
  status: 'online' | 'offline' | 'away';
  currentPage?: string;
  lastSeen?: Date;
}

/**
 * EventRegistration entity representing a user registration for an event.
 * Stored in 'eventRegistrations' collection.
 */
export interface EventRegistration {
  id: string;
  email: string;
  fullName?: string;
  source?: string;
  eventKey: string;
  marketingOptIn: boolean;
  notes?: string;
  createdAt: Date;
}

/**
 * PriceHistory entity representing a price history entry for products or auctions.
 * Stored in 'products/{productId}/priceHistory' or 'auctions/{auctionId}/priceHistory' subcollections.
 */
export interface PriceHistory {
  id: string;
  price: number;
  source: 'manual' | 'auction_bid' | 'market_update' | 'system';
  note?: string;
  timestamp: Date;
}

/**
 * Order entity representing a direct purchase from the shop.
 * Stored in 'orders' collection.
 *
 * Payment integration:
 *  - create with status "pending" and paymentProvider "stripe"
 *  - set paymentReference once the payment is initiated
 *  - update status to "paid" from a secure Stripe webhook handler.
 */
export interface Order {
  id: string;
  productId: string;
  buyerId: string;
  sellerId: string;

  /**
   * Denormalized metadata to make transaction history clear even when user/profile reads are restricted.
   */
  buyerName?: string;
  sellerName?: string;

  /**
   * Conversation created between buyer and seller for this order.
   * Used for deep-linking from emails and dashboard.
   */
  conversationId?: string;

  price: number;
  currency: 'RON';
  status: 'pending' | 'paid' | 'cancelled' | 'failed' | 'refunded';
  paymentProvider: 'manual' | 'stripe';
  paymentReference: string | null;
  isMintProduct?: boolean;
  mintProductData?: any; // RawProduct data for mint products
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Offer entity representing an offer made on a product or auction.
 * Stored in 'offers' collection.
 */
export interface Offer {
  id: string;
  itemType: 'product' | 'auction';
  itemId: string;
  buyerId: string;
  sellerId: string;
  offerAmount: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // Optional expiration date
}

