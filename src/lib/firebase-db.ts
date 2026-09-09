import { getFirestore, type Firestore } from 'firebase/firestore';
import { app } from './firebase';

/**
 * The Firestore handle, split from ./firebase on purpose.
 *
 * `firebase/firestore` is the heaviest Firebase module (~150 KiB parsed,
 * websocket transport included). ./firebase stays auth-only so pages that
 * merely need to sign the visitor in — /login above all, the first page
 * every anonymous (and every PageSpeed) visitor sees — never download,
 * parse, or evaluate Firestore code. Consumers that actually read or write
 * documents import this module, which keeps Firestore inside the bundle of
 * the routes that need it.
 */
let firestore: Firestore | null = null;

if (app) {
  try {
    firestore = getFirestore(app);
  } catch (err) {
    console.warn('Firestore initialization error:', err);
  }
}

export const db: Firestore | null = firestore;
