/**
 * Authentication Module for Dartmouth Swimming Alumni Archive
 * Handles sign-in, registration, and the member profile in users/{uid}.
 *
 * Membership: every account gets a users/{uid} profile with a status.
 *   'pending' — signed in, but can't see the archive yet
 *   'member'  — can read and contribute
 * A new account becomes a member automatically when its (verified) email
 * is on the invites list; otherwise an admin approves it in Settings.
 * firestore.rules enforces all of this — the client only asks.
 */

import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    updateProfile as updateAuthProfile,
    signOut as firebaseSignOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    deleteField,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

// Details typed into the registration form, used when the profile is first created
let pendingRegistration = null;

// ================================
// Auth state
// ================================

/**
 * Calls onChange(user, profile) whenever the signed-in user or their
 * profile document changes. profile is null while signed out.
 */
export function watchAuth(onChange) {
    let unsubscribeProfile = null;

    onAuthStateChanged(auth, async (user) => {
        if (unsubscribeProfile) {
            unsubscribeProfile();
            unsubscribeProfile = null;
        }

        if (!user) {
            onChange(null, null);
            return;
        }

        try {
            await ensureProfile(user);
        } catch (error) {
            console.error('Error preparing profile:', error);
        }

        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            onChange(user, snap.exists() ? { id: snap.id, ...snap.data() } : null);
        }, (error) => {
            console.error('Error watching profile:', error);
            onChange(user, null);
        });
    });
}

/**
 * Create the profile on first sign-in, tidy up legacy fields, and
 * promote the account to member if its email has been invited.
 */
async function ensureProfile(user) {
    const profileRef = doc(db, 'users', user.uid);
    const snap = await getDoc(profileRef);
    const invited = await isInvited(user);

    if (!snap.exists()) {
        const details = pendingRegistration || {};
        await setDoc(profileRef, {
            displayName: details.displayName || user.displayName || user.email.split('@')[0],
            classYear: details.classYear || null,
            photoURL: user.photoURL || null,
            status: invited ? 'member' : 'pending',
            joinedAt: serverTimestamp()
        });
        await setDoc(doc(db, 'users', user.uid, 'private', 'contact'), {
            email: user.email.toLowerCase()
        });
        pendingRegistration = null;
        return;
    }

    const data = snap.data();
    const changes = {};

    // Early profiles stored email and unused notification settings publicly
    if ('email' in data) changes.email = deleteField();
    if ('notificationPreferences' in data) changes.notificationPreferences = deleteField();
    if (!data.status) changes.status = 'pending';
    if (data.status !== 'member' && invited) changes.status = 'member';

    if (Object.keys(changes).length) {
        if ('email' in data) {
            await setDoc(doc(db, 'users', user.uid, 'private', 'contact'), {
                email: user.email.toLowerCase()
            });
        }
        await updateDoc(profileRef, changes);
    }
}

async function isInvited(user) {
    if (!user.email || !user.emailVerified) return false;
    try {
        const invite = await getDoc(doc(db, 'invites', user.email.toLowerCase()));
        return invite.exists();
    } catch {
        return false;
    }
}

// ================================
// Sign in / out
// ================================

export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return signInWithPopup(auth, provider);
}

export async function signInWithEmail(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function register(email, password, displayName, classYear) {
    pendingRegistration = { displayName, classYear };
    try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateAuthProfile(credential.user, { displayName });
        await sendEmailVerification(credential.user);
        return credential.user;
    } catch (error) {
        pendingRegistration = null;
        throw error;
    }
}

export async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
}

export async function resendVerification() {
    if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
    }
}

/**
 * Re-check the invites list, e.g. after the user verifies their email
 */
export async function recheckMembership() {
    const user = auth.currentUser;
    if (!user) return;
    await user.reload();
    await user.getIdToken(true);
    await ensureProfile(user);
}

export async function signOut() {
    return firebaseSignOut(auth);
}

export function currentUser() {
    return auth.currentUser;
}

// ================================
// Profile
// ================================

export async function updateMyProfile({ displayName, classYear }) {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in to update your details.');

    await updateDoc(doc(db, 'users', user.uid), { displayName, classYear });
    if (displayName !== user.displayName) {
        await updateAuthProfile(user, { displayName });
    }
}

/**
 * Turn a Firebase auth error into a sentence a person can act on
 */
export function describeAuthError(error) {
    const messages = {
        'auth/invalid-credential': 'That email and password don\'t match. Check them, or reset your password.',
        'auth/wrong-password': 'That email and password don\'t match. Check them, or reset your password.',
        'auth/user-not-found': 'There\'s no account with that email. Create one instead.',
        'auth/email-already-in-use': 'An account with that email already exists. Sign in instead.',
        'auth/weak-password': 'Use a password with at least 6 characters.',
        'auth/invalid-email': 'That email address isn\'t valid.',
        'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
        'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
        'auth/unauthorized-domain': 'Sign-in isn\'t enabled for this web address yet. Add it under Authentication › Settings › Authorized domains in the Firebase console.',
        'auth/network-request-failed': 'Couldn\'t reach the sign-in service. Check your connection and try again.'
    };
    return messages[error.code] || error.message;
}
