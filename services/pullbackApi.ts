import { auth } from '@shared/firebaseConfig';
import { pullbackProduct, pullbackAuction } from '@shared/pullbackService';

export type PullbackItemType = 'product' | 'auction';

export type PullbackApiResponse = {
  success: boolean;
  message?: string;
};

export async function requestPullback(itemType: PullbackItemType, itemId: string): Promise<PullbackApiResponse> {
  const userId = auth.currentUser?.uid || null;
  if (!userId) {
    throw new Error('Autentificare necesară');
  }

  if (itemType === 'product') {
    await pullbackProduct(itemId, userId);
  } else {
    await pullbackAuction(itemId, userId);
  }

  return {
    success: true,
    message: 'Articolul a fost returnat în colecție cu succes',
  };
}

