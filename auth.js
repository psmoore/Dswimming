/**
 * Authentication Module for Dartmouth Swimming Alumni Archive
 * Handles user registration, login, logout, and session management
 */

const AuthModule = {
    currentUser: null,

    /**
     * Initialize auth state listener
     */
    init() {
        firebase.auth().onAuthStateChanged((user) => {
            this.currentUser = user;
            this.updateUI(user);

            if (user) {
                console.log('User signed in:', user.email);
                this.loadUserProfile(user.uid);
            } else {
                console.log('No user signed in');
            }
        });
    },

    /**
     * Register a new user
     */
    async register(email, password, displayName, classYear) {
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Update display name
            await user.updateProfile({ displayName });

            // Create user profile in Firestore
            await firebase.firestore().collection('users').doc(user.uid).set({
                email: email,
                displayName: displayName,
                classYear: classYear,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                notificationPreferences: {
                    newMemoriesFromEra: true,
                    taggedInMemory: true,
                    allNewUploads: false,
                    weeklyDigest: true,
                    emailFrequency: 'daily'
                }
            });

            this.showToast('Welcome to the Archive!', `Account created successfully.`, '🎉');
            return user;
        } catch (error) {
            console.error('Registration error:', error);
            this.showToast('Registration Failed', error.message, '⚠️');
            throw error;
        }
    },

    /**
     * Sign in existing user
     */
    async login(email, password) {
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            this.showToast('Welcome Back!', `Signed in as ${email}`, '👋');
            return userCredential.user;
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Login Failed', error.message, '⚠️');
            throw error;
        }
    },

    /**
     * Sign out current user
     */
    async logout() {
        try {
            await firebase.auth().signOut();
            this.showToast('Signed Out', 'You have been logged out.', '👋');
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    },

    /**
     * Send password reset email
     */
    async resetPassword(email) {
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            this.showToast('Email Sent', 'Check your inbox for password reset instructions.', '📧');
        } catch (error) {
            console.error('Password reset error:', error);
            this.showToast('Error', error.message, '⚠️');
            throw error;
        }
    },

    /**
     * Load user profile from Firestore
     */
    async loadUserProfile(uid) {
        try {
            const doc = await firebase.firestore().collection('users').doc(uid).get();
            if (doc.exists) {
                this.userProfile = doc.data();
                return this.userProfile;
            }
            return null;
        } catch (error) {
            console.error('Error loading profile:', error);
            return null;
        }
    },

    /**
     * Update notification preferences
     */
    async updateNotificationPreferences(preferences) {
        if (!this.currentUser) return;

        try {
            await firebase.firestore().collection('users').doc(this.currentUser.uid).update({
                notificationPreferences: preferences
            });
            this.showToast('Preferences Saved', 'Your notification settings have been updated.', '✓');
        } catch (error) {
            console.error('Error updating preferences:', error);
            throw error;
        }
    },

    /**
     * Update UI based on auth state
     */
    updateUI(user) {
        const userSection = document.querySelector('.user-section');
        const userName = document.querySelector('.user-name');

        if (user) {
            // User is signed in
            if (userName) {
                const displayName = user.displayName || user.email.split('@')[0];
                userName.textContent = `Welcome, ${displayName}`;
            }
            document.body.classList.add('authenticated');
            document.body.classList.remove('unauthenticated');
        } else {
            // User is signed out
            if (userName) {
                userName.textContent = 'Sign In';
                userName.style.cursor = 'pointer';
                userName.onclick = () => this.showAuthModal();
            }
            document.body.classList.add('unauthenticated');
            document.body.classList.remove('authenticated');
        }
    },

    /**
     * Show authentication modal
     */
    showAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    /**
     * Hide authentication modal
     */
    hideAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    /**
     * Show toast notification
     */
    showToast(title, message, icon = '✓') {
        if (typeof showToast === 'function') {
            showToast(title, message, icon);
        } else {
            console.log(`${icon} ${title}: ${message}`);
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be initialized
    if (typeof firebase !== 'undefined') {
        AuthModule.init();
    }
});

// Export module
window.AuthModule = AuthModule;
