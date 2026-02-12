import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Cart: undefined;
  /** Auth stack wrapper (unauthenticated flow) */
  Auth: undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  Home: undefined;
  ProductDetails: { productId: string };
  AuctionDetails: { auctionId: string; filters?: any };
  BidHistory: { auctionId?: string; userId?: string };
  HelpArticle: { articleId: string };
  Notifications: undefined;
  /** Private messages / support chat */
  Messages: { conversationId?: string; conversation?: string };
  UserProducts: undefined;
  UserAuctions: undefined;
  HelpCenter: undefined;
  /** Settings hub */
  Settings: undefined;
  ChangePassword: undefined;
  ChangeEmail: undefined;
  TwoFA: undefined;
  Sessions: undefined;
  TrustedDevices: undefined;
  AccountActions: undefined;
  /** Istoricul comenzilor (cumpărări) pentru utilizatorul curent */
  OrderHistory: undefined;
  /** Detalii despre o comandă specifică */
  OrderDetails: { orderId: string };
  /** Istoricul vânzărilor pentru utilizatorul curent */
  SalesHistory: undefined;
  Login: undefined;
  Register: undefined;
  Checkout: {
    /** Optional single product for "Buy Now" flow */
    productId?: string;
    /** Optional list of products for cart checkout */
    productIds?: string[];
    /** Optional cart items for checkout with Monetaria Statului products */
    cartItems?: any[];
  };
  BuyCredits: undefined;
  NewListing: { listingType: 'direct' | 'auction'; productId?: string };
  About: undefined;
  Contact: undefined;
  Pronumismatica: undefined;
  MonetariaStatului: undefined;
  MonetariaStatuluiProductDetails: { productId: string };
  Contracts: undefined;
  Event: undefined;
  Bookmarks: undefined;
  Watchlist: undefined;
  Collection: undefined;
  AuctionList: { filters?: any };
  SellerProfile: {
    sellerId: string;
    /** Optional display data passed from product/auction screens to avoid extra reads. */
    sellerName?: string;
    sellerUsername?: string;
    sellerVerified?: boolean;
  };
  // Admin screens
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminUserDetail: { userId: string };
  AdminVerification: undefined;
  AdminActivityLogs: undefined;
  AdminAnalytics: undefined;
  AdminAuctions: undefined;
  AdminAuditTrail: undefined;
  AdminConversations: undefined;
  AdminHelp: undefined;
  AdminModerator: undefined;
  AdminNotifications: undefined;
  AdminTestBoost: undefined;
  AdminTransactions: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  ProductCatalog: undefined;
  AuctionList: { filters?: any };
  Cart: undefined;
  Watchlist: undefined;
  HelpCenter: undefined;
};
