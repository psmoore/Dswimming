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

// TODO: Replace these placeholder values with your actual Firebase config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
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
