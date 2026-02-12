import { auth, functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const API_BASE_URL = 'https://enumismatica.ro';

export interface NetopiaInitResponse {
  paymentId: string;
  paymentUrl: string;
  paymentReference: string;
}

export interface NetopiaPaymentStatus {
  paymentId: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  creditsAdded: number;
  ronAmount: number;
  paymentReference: string;
}

async function getAuthTokenOrThrow(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Trebuie să fii autentificat pentru a cumpăra credite.');
  }

  return currentUser.getIdToken();
}

export async function initNetopiaCreditPayment(ronAmount: number): Promise<NetopiaInitResponse> {
  await getAuthTokenOrThrow();
  const call = httpsCallable(functions, 'initNetopiaPaymentCallable');
  const result = await call({ ronAmount });
  return result.data as NetopiaInitResponse;
}

export async function getNetopiaPaymentStatus(paymentId: string): Promise<NetopiaPaymentStatus> {
  await getAuthTokenOrThrow();
  const call = httpsCallable(functions, 'getNetopiaPaymentStatusCallable');
  const result = await call({ paymentId });
  return result.data as NetopiaPaymentStatus;
}

