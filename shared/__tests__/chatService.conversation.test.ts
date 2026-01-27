declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

// Prevent noisy console errors in chatService when Notification API is not present in Jest.
// chatService uses `Notification.permission` inside a try/catch; provide a minimal stub.
(globalThis as any).Notification = { permission: 'denied' };

const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();

const mockDoc = jest.fn((_: any, ...parts: string[]) => ({
  path: parts.join('/'),
  id: parts[parts.length - 1],
}));

jest.mock('../firebaseConfig', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  // builders
  collection: jest.fn((_: any, ...parts: string[]) => ({ path: parts.join('/') })),
  doc: (...args: any[]) => mockDoc(...args),
  query: jest.fn((...args: any[]) => ({ args })),
  where: jest.fn((...args: any[]) => ({ args })),
  orderBy: jest.fn((...args: any[]) => ({ args })),
  limit: jest.fn((n: number) => ({ n })),

  // reads/writes
  addDoc: (...args: any[]) => mockAddDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),

  // timestamps
  serverTimestamp: jest.fn(() => ({ __type: 'serverTimestamp' })),

  // unused in these tests
  onSnapshot: jest.fn(),
  Timestamp: { now: jest.fn() },
  increment: jest.fn(),
  setDoc: jest.fn(),
  arrayUnion: jest.fn(),
  arrayRemove: jest.fn(),
  deleteField: jest.fn(),
}));

import { createOrGetConversation } from '../chatService';

describe('chatService.createOrGetConversation()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not write undefined participant fields (e.g. buyerPhone) when creating a conversation', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    // buyer + seller user docs (no personalDetails.phone)
    mockGetDoc.mockImplementation(async (ref: any) => {
      if (ref.path === 'users/buyer-1') {
        return { exists: () => true, data: () => ({ displayName: 'Buyer', email: 'buyer@example.com' }) };
      }
      if (ref.path === 'users/seller-1') {
        return { exists: () => true, data: () => ({ displayName: 'Seller', email: 'seller@example.com' }) };
      }
      return { exists: () => false, data: () => ({}) };
    });

    mockAddDoc.mockResolvedValue({ id: 'conv-123' });

    const id = await createOrGetConversation('buyer-1', 'seller-1', undefined, 'prod-1', false);
    expect(id).toBe('conv-123');

    const written = mockAddDoc.mock.calls[0][1];
    expect(written).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(written, 'buyerPhone')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(written, 'sellerPhone')).toBe(false);
  });

  it('does not write undefined participant fields when backfilling an existing conversation', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'existing-1',
          data: () => ({
            participants: ['buyer-1', 'seller-1'],
            buyerId: 'buyer-1',
            sellerId: 'seller-1',
            productId: 'prod-1',
            // Missing buyerPhone/sellerPhone triggers backfill.
          }),
        },
      ],
    });

    mockGetDoc.mockImplementation(async (ref: any) => {
      if (ref.path === 'users/buyer-1') {
        // no phone field
        return { exists: () => true, data: () => ({ displayName: 'Buyer', email: 'buyer@example.com' }) };
      }
      if (ref.path === 'users/seller-1') {
        // no phone field
        return { exists: () => true, data: () => ({ displayName: 'Seller', email: 'seller@example.com' }) };
      }
      return { exists: () => false, data: () => ({}) };
    });

    const id = await createOrGetConversation('buyer-1', 'seller-1', undefined, 'prod-1', false);
    expect(id).toBe('existing-1');

    // Backfill should call updateDoc with a patch that does NOT include undefined phone fields.
    const patch = mockUpdateDoc.mock.calls[0][1];
    expect(Object.prototype.hasOwnProperty.call(patch, 'buyerPhone')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(patch, 'sellerPhone')).toBe(false);
  });
});

