declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

const mockRunTransaction = jest.fn();

jest.mock('../firebaseConfig', () => ({
  db: {},
}));

const mockDoc = jest.fn((_: any, ...parts: string[]) => ({
  path: parts.join('/'),
  id: parts[parts.length - 1],
}));

jest.mock('firebase/firestore', () => ({
  // builders
  collection: jest.fn((_: any, ...parts: string[]) => ({ path: parts.join('/') })),
  doc: (...args: any[]) => mockDoc(...args),
  query: jest.fn((...args: any[]) => ({ args })),
  where: jest.fn((...args: any[]) => ({ args })),
  orderBy: jest.fn((...args: any[]) => ({ args })),
  limit: jest.fn((n: number) => ({ n })),

  // timestamps
  serverTimestamp: jest.fn(() => ({ __type: 'serverTimestamp' })),
  Timestamp: { fromDate: jest.fn((d: Date) => d) },

  // writes
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(async () => ({ docs: [] })),

  // transaction
  runTransaction: (...args: any[]) => mockRunTransaction(...args),
}));

import { acceptOffer } from '../offerService';

describe('offerService.acceptOffer()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks product as sold when accepting a pending product offer', async () => {
    let txUpdate: any;

    mockRunTransaction.mockImplementation(async (_db: any, cb: any) => {
      const tx = {
        get: jest.fn(async (ref: any) => {
          if (ref.path === 'offers/offer-1') {
            return {
              exists: () => true,
              data: () => ({
                itemType: 'product',
                itemId: 'prod-1',
                buyerId: 'buyer-1',
                sellerId: 'seller-1',
                status: 'pending',
                offerAmount: 123,
              }),
            };
          }
          if (ref.path === 'products/prod-1') {
            return {
              exists: () => true,
              data: () => ({ ownerId: 'seller-1', isSold: false }),
            };
          }
          return { exists: () => false, data: () => ({}) };
        }),
        update: jest.fn(),
        set: jest.fn(),
      };

      txUpdate = tx.update;
      await cb(tx);
      return undefined;
    });

    await acceptOffer('offer-1');

    // Verify tx.update called for offer and product.
    expect(mockRunTransaction).toHaveBeenCalled();

    const updateCalls = txUpdate.mock.calls;
    expect(updateCalls.length).toBeGreaterThanOrEqual(2);

    const offerUpdate = updateCalls.find((c: any[]) => c[0]?.path === 'offers/offer-1');
    expect(offerUpdate).toBeTruthy();
    expect(offerUpdate[1]).toMatchObject({ status: 'accepted' });

    const productUpdate = updateCalls.find((c: any[]) => c[0]?.path === 'products/prod-1');
    expect(productUpdate).toBeTruthy();
    expect(productUpdate[1]).toMatchObject({ isSold: true, buyerId: 'buyer-1' });
  });
});

