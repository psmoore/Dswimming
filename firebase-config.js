/**
 * Firebase Configuration for Dartmouth Swimming Alumni Archive
 *
 * Uses the modular Firebase JS SDK loaded as native ES modules from the
 * gstatic CDN (no build step). To upgrade, change SDK_VERSION everywhere
 * it appears in auth.js, database.js and storage.js as well.
 *
 * The web config below is public by design. Access control lives in
 * firestore.rules and storage.rules — deploy those with the Firebase CLI.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    memoryLocalCache,
    connectFirestoreEmulator
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { getStorage, connectStorageEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';

// Local testing against the Firebase emulators: open http://localhost:8000/?emulator
// after running `npx firebase-tools emulators:start` (see CLAUDE.md)
const useEmulator = ['localhost', '127.0.0.1'].includes(location.hostname)
    && new URLSearchParams(location.search).has('emulator');

const firebaseConfig = {
    apiKey: "AIzaSyBE64JOiiLpU_S2R-jh4oJW1LTzO8F2GQw",
    authDomain: "dartmouth-swimming.firebaseapp.com",
    projectId: "dartmouth-swimming",
    storageBucket: "dartmouth-swimming.firebasestorage.app",
    messagingSenderId: "131577590878",
    appId: "1:131577590878:web:06afbb877b187545bdb0cf",
    measurementId: "G-FMMVRZ70RF"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Offline cache shared across tabs, so the archive opens instantly on repeat visits
export const db = initializeFirestore(app, {
    localCache: useEmulator
        ? memoryLocalCache()
        : persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const storage = getStorage(app);

if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8181);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    console.info('Using local Firebase emulators');
}
