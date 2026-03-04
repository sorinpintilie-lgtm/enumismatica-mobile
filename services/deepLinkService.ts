import type { ChatNotification } from '@shared/types';

export const APP_SCHEME_PREFIX = 'enumismatica://';
export const WEB_BASE_URL = 'https://enumismatica.ro';

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getFirstNonEmptyString(
  source: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = asNonEmptyString(source[key]);
    if (value) return value;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getPayloadCandidates(data: NotificationLike): Record<string, unknown>[] {
  const primary = data as Record<string, unknown>;
  const nestedData = asRecord(primary.data);
  return nestedData ? [primary, nestedData] : [primary];
}

function getFirstNonEmptyStringFromPayloads(
  payloads: Record<string, unknown>[],
  keys: string[],
): string | null {
  for (const payload of payloads) {
    const value = getFirstNonEmptyString(payload, keys);
    if (value) return value;
  }
  return null;
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function buildWebUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${WEB_BASE_URL}${normalizedPath}`;
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildProductDeepLink(productId: string): string {
  return `${APP_SCHEME_PREFIX}product/${encodeSegment(productId)}`;
}

export function buildProductWebLink(productId: string): string {
  return buildWebUrl(`/products/${encodeSegment(productId)}`);
}

export function buildAuctionDeepLink(auctionId: string): string {
  return `${APP_SCHEME_PREFIX}auction/${encodeSegment(auctionId)}`;
}

export function buildAuctionWebLink(auctionId: string): string {
  return buildWebUrl(`/auctions/${encodeSegment(auctionId)}`);
}

export function buildMintProductDeepLink(productId: string): string {
  return `${APP_SCHEME_PREFIX}monetaria-statului/${encodeSegment(productId)}`;
}

export function buildMintProductWebLink(productId: string): string {
  return buildWebUrl(`/monetaria-statului/${encodeSegment(productId)}`);
}

export function buildOrderDeepLink(orderId: string): string {
  return `${APP_SCHEME_PREFIX}order/${encodeSegment(orderId)}`;
}

export function buildOrderWebLink(orderId: string): string {
  return buildWebUrl(`/orders/${encodeSegment(orderId)}`);
}

export function buildConversationDeepLink(conversationId: string): string {
  return `${APP_SCHEME_PREFIX}messages/${encodeSegment(conversationId)}`;
}

export function buildMessagesDeepLink(conversationId?: string): string {
  if (conversationId) {
    return buildConversationDeepLink(conversationId);
  }
  return `${APP_SCHEME_PREFIX}messages`;
}

export function buildMessagesWebLink(conversationId?: string): string {
  if (conversationId) {
    return buildWebUrl(`/messages?conversation=${encodeSegment(conversationId)}`);
  }
  return buildWebUrl('/messages');
}

export function buildSupportChatDeepLink(supportChatId: string): string {
  return `${APP_SCHEME_PREFIX}support/${encodeSegment(supportChatId)}`;
}

export type NotificationNavigationTarget =
  | { screen: 'Messages'; params: { conversationId?: string; supportChatId?: string } }
  | { screen: 'Messages'; params: { conversationId: string } }
  | { screen: 'Messages'; params: { supportChatId: string } }
  | { screen: 'AuctionDetails'; params: { auctionId: string } }
  | { screen: 'ProductDetails'; params: { productId: string } }
  | { screen: 'MonetariaStatuluiProductDetails'; params: { productId: string } }
  | { screen: 'OrderDetails'; params: { orderId: string } };

type NotificationLike = Partial<ChatNotification> & Record<string, unknown>;

function splitDeepLinkSegments(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();

  if (trimmed.startsWith(APP_SCHEME_PREFIX)) {
    return trimmed
      .slice(APP_SCHEME_PREFIX.length)
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.split('?')[0] ?? segment)
      .map(decodeSegment);
  }

  const appSitePrefix = 'https://enumismatica.ro/';
  const appSiteWwwPrefix = 'https://www.enumismatica.ro/';
  if (trimmed.startsWith(appSitePrefix)) {
    return trimmed
      .slice(appSitePrefix.length)
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.split('?')[0] ?? segment)
      .map(decodeSegment);
  }
  if (trimmed.startsWith(appSiteWwwPrefix)) {
    return trimmed
      .slice(appSiteWwwPrefix.length)
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.split('?')[0] ?? segment)
      .map(decodeSegment);
  }

  return [];
}

function getDeepLinkQueryParams(rawUrl: string): URLSearchParams {
  const queryIndex = rawUrl.indexOf('?');
  if (queryIndex < 0 || queryIndex === rawUrl.length - 1) {
    return new URLSearchParams();
  }
  return new URLSearchParams(rawUrl.slice(queryIndex + 1));
}

export function resolveDeepLinkNavigationTarget(url: string): NotificationNavigationTarget | null {
  const segments = splitDeepLinkSegments(url);
  const queryParams = getDeepLinkQueryParams(url);
  if (!segments.length) return null;

  const [first, second] = segments;
  if (!first) return null;

  if ((first === 'auction' || first === 'auctions') && second) {
    return { screen: 'AuctionDetails', params: { auctionId: second } };
  }
  if ((first === 'product' || first === 'products') && second) {
    return { screen: 'ProductDetails', params: { productId: second } };
  }
  if (first === 'monetaria-statului' && second) {
    return { screen: 'MonetariaStatuluiProductDetails', params: { productId: second } };
  }
  if ((first === 'order' || first === 'orders') && second) {
    return { screen: 'OrderDetails', params: { orderId: second } };
  }
  if (first === 'messages') {
    const conversationFromQuery =
      queryParams.get('conversationId') ??
      queryParams.get('conversation') ??
      queryParams.get('conversation_id');
    const supportFromQuery =
      queryParams.get('supportChatId') ??
      queryParams.get('support_chat_id') ??
      queryParams.get('supportChat');

    if (supportFromQuery) {
      return { screen: 'Messages', params: { supportChatId: decodeSegment(supportFromQuery) } };
    }

    if (second) {
      return { screen: 'Messages', params: { conversationId: second } };
    }

    if (conversationFromQuery) {
      return { screen: 'Messages', params: { conversationId: decodeSegment(conversationFromQuery) } };
    }

    return { screen: 'Messages', params: {} };
  }
  if (first === 'support' && second) {
    return { screen: 'Messages', params: { supportChatId: second } };
  }

  return null;
}

export function resolveNotificationNavigationTarget(
  data: NotificationLike | null | undefined,
): NotificationNavigationTarget | null {
  if (!data) return null;

  const payloads = getPayloadCandidates(data);

  const deepLink = getFirstNonEmptyStringFromPayloads(payloads, ['deepLink', 'url', 'link']);
  if (deepLink) {
    const deepLinkTarget = resolveDeepLinkNavigationTarget(deepLink);
    if (deepLinkTarget) return deepLinkTarget;
  }

  const supportChatId = getFirstNonEmptyStringFromPayloads(payloads, [
    'supportChatId',
    'support_chat_id',
    'supportChat',
    'supportChatID',
  ]);
  if (supportChatId) {
    return { screen: 'Messages', params: { supportChatId } };
  }

  const conversationId = getFirstNonEmptyStringFromPayloads(payloads, [
    'conversationId',
    'conversation_id',
    'conversation',
    'chatConversationId',
  ]);
  if (conversationId) {
    return { screen: 'Messages', params: { conversationId } };
  }

  const auctionId = getFirstNonEmptyStringFromPayloads(payloads, ['auctionId', 'auction_id', 'auction']);
  if (auctionId) {
    return { screen: 'AuctionDetails', params: { auctionId } };
  }

  const productId = getFirstNonEmptyStringFromPayloads(payloads, ['productId', 'product_id', 'product']);
  if (productId) {
    return { screen: 'ProductDetails', params: { productId } };
  }

  const itemType = getFirstNonEmptyStringFromPayloads(payloads, ['itemType', 'entityType'])?.toLowerCase() ?? null;
  const itemId = getFirstNonEmptyStringFromPayloads(payloads, ['itemId', 'entityId']);
  if (itemType && itemId) {
    if (itemType === 'auction') {
      return { screen: 'AuctionDetails', params: { auctionId: itemId } };
    }
    if (itemType === 'product') {
      return { screen: 'ProductDetails', params: { productId: itemId } };
    }
  }

  const orderId = getFirstNonEmptyStringFromPayloads(payloads, ['orderId', 'order_id', 'order']);
  if (orderId) {
    return { screen: 'OrderDetails', params: { orderId } };
  }

  const type = getFirstNonEmptyStringFromPayloads(payloads, ['type', 'notificationType'])?.toLowerCase() ?? null;
  const inferredItemId = getFirstNonEmptyStringFromPayloads(payloads, ['itemId', 'entityId']);
  if (type && inferredItemId) {
    if (type === 'outbid' || type === 'auction_won' || type === 'auction_ended_no_win') {
      return { screen: 'AuctionDetails', params: { auctionId: inferredItemId } };
    }
  }

  if (type && (type === 'new_message' || type === 'conversation_started' || type === 'message_read')) {
    return { screen: 'Messages', params: {} };
  }

  return null;
}
