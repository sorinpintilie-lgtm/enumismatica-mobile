import { apiPost } from './apiClient';

export type PullbackItemType = 'product' | 'auction';

export type PullbackApiResponse = {
  success: boolean;
  message?: string;
};

export async function requestPullback(itemType: PullbackItemType, itemId: string): Promise<PullbackApiResponse> {
  const base = itemType === 'product' ? 'products' : 'auctions';
  return apiPost<PullbackApiResponse>(`/api/${base}/${itemId}/pullback`, {});
}

