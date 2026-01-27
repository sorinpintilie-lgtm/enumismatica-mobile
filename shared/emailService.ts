/**
 * Email service (client-safe): calls the Next.js API route that performs the
 * actual SendGrid send on the server.
 */

export type EmailTemplateKey = string;

type SendTemplateEmailInput = {
  to: string;
  templateKey: EmailTemplateKey;
  vars?: Record<string, unknown>;
  fallbackKey?: EmailTemplateKey;
};

const DEFAULT_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://enumismatica.ro';

function isBrowser() {
  return typeof window !== 'undefined';
}

export async function sendTemplateEmail(input: SendTemplateEmailInput): Promise<void> {
  const url = isBrowser() ? '/api/email/send' : `${DEFAULT_SITE_URL}/api/email/send`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to send email (${res.status}): ${body}`);
  }
}

// =============================================================================
// High-level helpers (used across the app)
// =============================================================================

export async function sendWelcomeEmail(email: string, displayName: string): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'account_welcome',
    vars: {
      user_name: displayName,
      login_link: `${DEFAULT_SITE_URL}/login`,
    },
    fallbackKey: 'fallback_default',
  });
}

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'account_password_reset_requested',
    vars: {
      user_name: 'Utilizator',
      reset_link: resetLink,
    },
    fallbackKey: 'fallback_security',
  });
}

export async function sendAccountBlockedEmail(email: string, reason: string): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'account_blocked',
    vars: {
      user_name: 'Utilizator',
      event_title: 'Cont blocat',
      event_message: `Contul tău a fost blocat temporar. Motiv: ${reason}`,
      action_link: `${DEFAULT_SITE_URL}/contact`,
    },
    fallbackKey: 'fallback_security',
  });
}

export async function sendEventConfirmationEmail(
  email: string,
  eventName: string,
  eventDetails: string,
): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'event_registration_confirmed',
    vars: {
      user_name: 'Utilizator',
      event_title: eventName,
      event_message: eventDetails,
      action_link: DEFAULT_SITE_URL,
    },
    fallbackKey: 'fallback_default',
  });
}

export async function sendPurchaseConfirmationEmail(
  email: string,
  productName: string,
  price: number,
  orderId: string,
  options?: {
    sellerName?: string;
    conversationId?: string;
  },
): Promise<void> {
  const conversationLink = options?.conversationId
    ? `${DEFAULT_SITE_URL}/messages?conversation=${options.conversationId}`
    : `${DEFAULT_SITE_URL}/messages`;

  return sendTemplateEmail({
    to: email,
    templateKey: 'purchase_confirmation_buyer',
    vars: {
      buyer_name: 'Utilizator',
      listing_title: productName,
      amount: price.toFixed(2),
      currency: 'EUR',
      transaction_link: `${DEFAULT_SITE_URL}/orders/${orderId}`,
      conversation_link: conversationLink,
      seller_name: options?.sellerName || 'Vânzător',
    },
    fallbackKey: 'fallback_transaction',
  });
}

export async function sendOutbidEmail(
  email: string,
  auctionTitle: string,
  currentBid: number,
  auctionId: string,
): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'bid_outbid',
    vars: {
      user_name: 'Utilizator',
      listing_title: auctionTitle,
      current_price: currentBid.toFixed(2),
      currency: 'EUR',
      auction_link: `${DEFAULT_SITE_URL}/auctions/${auctionId}`,
    },
    fallbackKey: 'fallback_default',
  });
}

export async function sendAuctionWonEmail(
  email: string,
  auctionTitle: string,
  finalBid: number,
  auctionId: string,
  options?: {
    sellerName?: string;
    conversationId?: string;
  },
): Promise<void> {
  const conversationLink = options?.conversationId
    ? `${DEFAULT_SITE_URL}/messages?conversation=${options.conversationId}`
    : `${DEFAULT_SITE_URL}/messages`;

  return sendTemplateEmail({
    to: email,
    templateKey: 'auction_won_buyer',
    vars: {
      buyer_name: 'Utilizator',
      listing_title: auctionTitle,
      amount: finalBid.toFixed(2),
      currency: 'EUR',
      seller_name: options?.sellerName || 'Vânzător',
      transaction_link: `${DEFAULT_SITE_URL}/auctions/${auctionId}`,
      conversation_link: conversationLink,
    },
    fallbackKey: 'fallback_transaction',
  });
}

export async function sendProductSoldEmail(
  email: string,
  productName: string,
  price: number,
  buyerName: string,
  options?: {
    conversationId?: string;
    orderId?: string;
  },
): Promise<void> {
  const conversationLink = options?.conversationId
    ? `${DEFAULT_SITE_URL}/messages?conversation=${options.conversationId}`
    : `${DEFAULT_SITE_URL}/messages`;

  return sendTemplateEmail({
    to: email,
    templateKey: 'product_sold_seller',
    vars: {
      user_name: 'Vânzător',
      listing_title: productName,
      amount: price.toFixed(2),
      currency: 'EUR',
      buyer_name: buyerName,
      action_link: options?.orderId
        ? `${DEFAULT_SITE_URL}/orders/${options.orderId}`
        : `${DEFAULT_SITE_URL}/dashboard`,
      conversation_link: conversationLink,
    },
    fallbackKey: 'fallback_transaction',
  });
}

export async function sendAuctionSoldEmail(
  email: string,
  auctionTitle: string,
  finalBid: number,
  winnerName: string,
  auctionId: string,
  options?: {
    conversationId?: string;
  },
): Promise<void> {
  const conversationLink = options?.conversationId
    ? `${DEFAULT_SITE_URL}/messages?conversation=${options.conversationId}`
    : `${DEFAULT_SITE_URL}/messages`;

  return sendTemplateEmail({
    to: email,
    templateKey: 'auction_sold_seller',
    vars: {
      user_name: 'Vânzător',
      listing_title: auctionTitle,
      amount: finalBid.toFixed(2),
      currency: 'EUR',
      buyer_name: winnerName,
      action_link: `${DEFAULT_SITE_URL}/auctions/${auctionId}`,
      conversation_link: conversationLink,
    },
    fallbackKey: 'fallback_transaction',
  });
}

export async function sendProductApprovedEmail(
  email: string,
  productName: string,
  productId: string,
): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'product_approved',
    vars: {
      user_name: 'Utilizator',
      listing_title: productName,
      listing_link: `${DEFAULT_SITE_URL}/products/${productId}`,
      action_link: `${DEFAULT_SITE_URL}/products/${productId}`,
    },
    fallbackKey: 'fallback_default',
  });
}

export async function sendProductRejectedEmail(
  email: string,
  productName: string,
  reason: string,
): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'product_rejected',
    vars: {
      user_name: 'Utilizator',
      listing_title: productName,
      event_message: reason,
      action_link: `${DEFAULT_SITE_URL}/dashboard`,
    },
    fallbackKey: 'fallback_default',
  });
}

export async function sendAuctionApprovedEmail(
  email: string,
  auctionTitle: string,
  auctionId: string,
): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'auction_approved',
    vars: {
      user_name: 'Utilizator',
      listing_title: auctionTitle,
      auction_link: `${DEFAULT_SITE_URL}/auctions/${auctionId}`,
      action_link: `${DEFAULT_SITE_URL}/auctions/${auctionId}`,
    },
    fallbackKey: 'fallback_default',
  });
}

export async function sendAuctionRejectedEmail(
  email: string,
  auctionTitle: string,
  reason: string,
): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'auction_rejected',
    vars: {
      user_name: 'Utilizator',
      listing_title: auctionTitle,
      event_message: reason,
      action_link: `${DEFAULT_SITE_URL}/dashboard`,
    },
    fallbackKey: 'fallback_default',
  });
}

export default {
  sendTemplateEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendAccountBlockedEmail,
  sendEventConfirmationEmail,
  sendPurchaseConfirmationEmail,
  sendOutbidEmail,
  sendAuctionWonEmail,
  sendProductSoldEmail,
  sendAuctionSoldEmail,
  sendProductApprovedEmail,
  sendProductRejectedEmail,
  sendAuctionApprovedEmail,
  sendAuctionRejectedEmail,
};

export async function send2FAEnabledEmail(email: string): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'account_2fa_enabled',
    vars: {
      user_name: 'Utilizator',
      event_title: 'Autentificare cu doi factori activată',
      event_message: 'Autentificarea cu doi factori a fost activată cu succes pentru contul tău. Acum vei avea nevoie de un cod de verificare la fiecare autentificare.',
      action_link: `${DEFAULT_SITE_URL}/settings`,
    },
    fallbackKey: 'fallback_security',
  });
}

export async function send2FADisabledEmail(email: string): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'account_2fa_disabled',
    vars: {
      user_name: 'Utilizator',
      event_title: 'Autentificare cu doi factori dezactivată',
      event_message: 'Autentificarea cu doi factori a fost dezactivată pentru contul tău. Dacă nu ai făcut tu această modificare, te rugăm să ne contactezi imediat.',
      action_link: `${DEFAULT_SITE_URL}/contact`,
    },
    fallbackKey: 'fallback_security',
  });
}

export async function sendPasswordChangedEmail(email: string): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'account_password_changed',
    vars: {
      user_name: 'Utilizator',
      event_title: 'Parolă schimbată',
      event_message: 'Parola contului tău a fost schimbată cu succes. Dacă nu ai făcut tu această modificare, te rugăm să ne contactezi imediat.',
      action_link: `${DEFAULT_SITE_URL}/contact`,
    },
    fallbackKey: 'fallback_security',
  });
}

export async function sendEmailVerificationEmail(email: string, verificationLink: string): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'account_email_verification',
    vars: {
      user_name: 'Utilizator',
      verification_link: verificationLink,
    },
    fallbackKey: 'fallback_default',
  });
}

export async function sendLoginAttemptEmail(
  email: string,
  location: string,
  dateTime: string,
  device: string,
  actionLink: string
): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'security_login_attempt',
    vars: {
      user_name: email.split('@')[0],
      location: location,
      date_time: dateTime,
      device: device,
      action_link: actionLink,
    },
    fallbackKey: 'fallback_security',
  });
}

export async function sendLoginSuccessEmail(
  email: string,
  location: string,
  dateTime: string,
  device: string,
  actionLink: string
): Promise<void> {
  return sendTemplateEmail({
    to: email,
    templateKey: 'security_login_success',
    vars: {
      user_name: email.split('@')[0],
      location: location,
      date_time: dateTime,
      device: device,
      action_link: actionLink,
    },
    fallbackKey: 'fallback_security',
  });
}

export async function sendPullbackRequestEmail(
  itemId: string,
  userId: string,
  itemType: 'product' | 'auction',
  reason?: string
): Promise<void> {
  // In a real implementation, you would fetch the admin email and user email
  // For now, we'll use a placeholder admin email
  const adminEmail = 'admin@enumismatica.ro';
  
  return sendTemplateEmail({
    to: adminEmail,
    templateKey: 'pullback_request_admin',
    vars: {
      item_id: itemId,
      item_type: itemType,
      user_id: userId,
      reason: reason || 'No reason provided',
      admin_link: `${DEFAULT_SITE_URL}/admin/pullback-requests`,
    },
    fallbackKey: 'fallback_admin',
  });
}

export async function sendPullbackApprovalEmail(
  itemId: string,
  userId: string,
  itemType: 'product' | 'auction',
  adminId: string
): Promise<void> {
  // In a real implementation, you would fetch the user email
  // For now, we'll use a placeholder user email
  const userEmail = 'user@enumismatica.ro';
  
  return sendTemplateEmail({
    to: userEmail,
    templateKey: 'pullback_approved_user',
    vars: {
      item_id: itemId,
      item_type: itemType,
      admin_id: adminId,
      user_link: `${DEFAULT_SITE_URL}/dashboard`,
    },
    fallbackKey: 'fallback_default',
  });
}

export async function sendPullbackConfirmationEmail(
  itemId: string,
  userId: string,
  itemType: 'product' | 'auction'
): Promise<void> {
  // In a real implementation, you would fetch the user email
  // For now, we'll use a placeholder user email
  const userEmail = 'user@enumismatica.ro';
  
  return sendTemplateEmail({
    to: userEmail,
    templateKey: 'pullback_confirmation',
    vars: {
      item_id: itemId,
      item_type: itemType,
      user_link: `${DEFAULT_SITE_URL}/dashboard`,
    },
    fallbackKey: 'fallback_default',
  });
}

