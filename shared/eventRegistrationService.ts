import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebaseConfig'
import { EventRegistration } from './types'

export interface CreateEventRegistrationInput {
  email: string
  fullName?: string
  source?: string
  eventKey: string
  marketingOptIn?: boolean
  notes?: string
}

/**
 * Create a new event/QR pre-registration entry.
 * Stored under collection: "eventRegistrations".
 */
export async function createEventRegistration(input: CreateEventRegistrationInput): Promise<EventRegistration> {
  if (!db) {
    throw new Error('Firestore is not initialized')
  }

  const ref = collection(db, 'eventRegistrations')

  const docRef = await addDoc(ref, {
    email: input.email,
    fullName: input.fullName || null,
    source: input.source || 'qr-event',
    eventKey: input.eventKey,
    marketingOptIn: input.marketingOptIn ?? true,
    notes: input.notes || null,
    createdAt: serverTimestamp(),
  })

  return {
    id: docRef.id,
    email: input.email,
    fullName: input.fullName,
    source: input.source || 'qr-event',
    eventKey: input.eventKey,
    marketingOptIn: input.marketingOptIn ?? true,
    notes: input.notes,
    createdAt: new Date(),
  }
}