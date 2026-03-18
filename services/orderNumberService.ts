
/**
 * orderNumberService.ts
 * 
 * Generates unique, human-readable order numbers using Firestore transactions.
 * Format: #<SERVICE>-<YY>-<SEQUENCE>
 * Example: #KJ-26-0001
 * 
 * SERVICE codes:
 *   KJ = Kirim Jastip (type: JASTIP)
 *   BT = Beli Titipan (type: BELANJA)
 * 
 * SEQUENCE resets every year and is 4-digit zero-padded.
 * Uses Firestore runTransaction to guarantee no duplicates.
 */

import { db } from '../firebase';
import {
  doc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

type ServiceType = 'JASTIP' | 'BELANJA';

const SERVICE_CODE: Record<ServiceType, string> = {
  JASTIP: 'KJ',
  BELANJA: 'BT',
};

/**
 * Generates the next order number atomically.
 * Counter document path: orderCounters/{SERVICE_CODE}-{YY}
 * e.g. orderCounters/KJ-26
 */
export async function generateOrderNumber(serviceType: ServiceType): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2); // "26"
  const code = SERVICE_CODE[serviceType];
  const counterId = `${code}-${yy}`; // e.g. "KJ-26"
  const counterRef = doc(db, 'orderCounters', counterId);

  const newSequence: number = await runTransaction(db, async (transaction: any) => {
    const counterDoc = await transaction.get(counterRef);

    if (!counterDoc.exists()) {
      // First order of this service+year
      transaction.set(counterRef, { seq: 1, year: Number(yy), service: code });
      return 1;
    }

    const currentSeq = counterDoc.data().seq as number;
    const nextSeq = currentSeq + 1;
    transaction.update(counterRef, { seq: nextSeq });
    return nextSeq;
  });

  // Format: #KJ-26-0001
  const paddedSeq = String(newSequence).padStart(4, '0');
  return `#${code}-${yy}-${paddedSeq}`;
}
