/**
 * Firebase Configuration for Dartmouth Swimming Alumni Archive
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Click "Create a project" (or "Add project")
 * 3. Name it "dartmouth-swimming" (or similar)
 * 4. Disable Google Analytics (optional, not needed)
 * 5. Once created, click the web icon (</>) to add a web app
 * 6. Register the app with nickname "Dartmouth Swimming Archive"
 * 7. Copy the firebaseConfig object values below
 * 8. Enable Authentication: Build > Authentication > Get Started > Email/Password
 * 9. Enable Firestore: Build > Firestore Database > Create database > Start in test mode
 * 10. Enable Storage: Build > Storage > Get Started > Start in test mode
 */

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBE64JOiiLpU_S2R-jh4oJW1LTzO8F2GQw",
  authDomain: "dartmouth-swimming.firebaseapp.com",
  projectId: "dartmouth-swimming",
  storageBucket: "dartmouth-swimming.firebasestorage.app",
  messagingSenderId: "131577590878",
  appId: "1:131577590878:web:06afbb877b187545bdb0cf",
  measurementId: "G-FMMVRZ70RF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Export for use in other modules
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;

console.log('Firebase initialized successfully');
