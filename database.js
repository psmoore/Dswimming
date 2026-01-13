/**
 * Database Module for Dartmouth Swimming Alumni Archive
 * Handles all Firestore operations for memories, decades, and invites
 */

const DatabaseModule = {
    /**
     * Add a new memory to the archive
     */
    async addMemory(memoryData) {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Must be signed in to add memories');
        }

        try {
            const memory = {
                ...memoryData,
                authorId: user.uid,
                authorName: user.displayName || user.email,
                authorEmail: user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                reactions: {
                    swim: 0,
                    heart: 0,
                    celebrate: 0
                },
                commentCount: 0
            };

            const docRef = await firebase.firestore().collection('memories').add(memory);

            // Update decade stats
            await this.incrementDecadeCount(memoryData.decade);

            // Trigger notifications for subscribers
            await this.notifySubscribers(memory);

            return docRef.id;
        } catch (error) {
            console.error('Error adding memory:', error);
            throw error;
        }
    },

    /**
     * Get memories for a specific decade
     */
    async getMemoriesByDecade(decade, limitCount = 20, lastDoc = null) {
        try {
            let query = firebase.firestore()
                .collection('memories')
                .where('decade', '==', decade)
                .orderBy('createdAt', 'desc')
                .limit(limitCount);

            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();
            const memories = [];

            snapshot.forEach(doc => {
                memories.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return {
                memories,
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === limitCount
            };
        } catch (error) {
            console.error('Error fetching memories:', error);
            throw error;
        }
    },

    /**
     * Get a single memory by ID
     */
    async getMemory(memoryId) {
        try {
            const doc = await firebase.firestore().collection('memories').doc(memoryId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error fetching memory:', error);
            throw error;
        }
    },

    /**
     * Add a reaction to a memory
     */
    async addReaction(memoryId, reactionType) {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const reactionRef = firebase.firestore()
            .collection('memories')
            .doc(memoryId)
            .collection('reactions')
            .doc(user.uid);

        try {
            const existingReaction = await reactionRef.get();

            if (existingReaction.exists && existingReaction.data().type === reactionType) {
                // Remove reaction
                await reactionRef.delete();
                await firebase.firestore().collection('memories').doc(memoryId).update({
                    [`reactions.${reactionType}`]: firebase.firestore.FieldValue.increment(-1)
                });
                return false;
            } else {
                // Add/change reaction
                if (existingReaction.exists) {
                    const oldType = existingReaction.data().type;
                    await firebase.firestore().collection('memories').doc(memoryId).update({
                        [`reactions.${oldType}`]: firebase.firestore.FieldValue.increment(-1)
                    });
                }

                await reactionRef.set({
                    type: reactionType,
                    userId: user.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await firebase.firestore().collection('memories').doc(memoryId).update({
                    [`reactions.${reactionType}`]: firebase.firestore.FieldValue.increment(1)
                });
                return true;
            }
        } catch (error) {
            console.error('Error adding reaction:', error);
            throw error;
        }
    },

    /**
     * Add a comment to a memory
     */
    async addComment(memoryId, commentText) {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Must be signed in to comment');
        }

        try {
            const comment = {
                memoryId,
                authorId: user.uid,
                authorName: user.displayName || user.email,
                text: commentText,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await firebase.firestore()
                .collection('memories')
                .doc(memoryId)
                .collection('comments')
                .add(comment);

            // Update comment count
            await firebase.firestore().collection('memories').doc(memoryId).update({
                commentCount: firebase.firestore.FieldValue.increment(1)
            });

            return comment;
        } catch (error) {
            console.error('Error adding comment:', error);
            throw error;
        }
    },

    /**
     * Get comments for a memory
     */
    async getComments(memoryId) {
        try {
            const snapshot = await firebase.firestore()
                .collection('memories')
                .doc(memoryId)
                .collection('comments')
                .orderBy('createdAt', 'asc')
                .get();

            const comments = [];
            snapshot.forEach(doc => {
                comments.push({ id: doc.id, ...doc.data() });
            });

            return comments;
        } catch (error) {
            console.error('Error fetching comments:', error);
            throw error;
        }
    },

    /**
     * Get decade statistics
     */
    async getDecadeStats() {
        try {
            const snapshot = await firebase.firestore().collection('decades').get();
            const stats = {};

            snapshot.forEach(doc => {
                stats[doc.id] = doc.data();
            });

            return stats;
        } catch (error) {
            console.error('Error fetching decade stats:', error);
            // Return default stats if collection doesn't exist yet
            return {
                '1950s': { memoryCount: 0, contributorCount: 0, tagline: 'The Founding Years' },
                '1960s': { memoryCount: 0, contributorCount: 0, tagline: 'Building Tradition' },
                '1970s': { memoryCount: 0, contributorCount: 0, tagline: 'The Rise' },
                '1980s': { memoryCount: 0, contributorCount: 0, tagline: 'Dynasty Beginnings' },
                '1990s': { memoryCount: 0, contributorCount: 0, tagline: 'The Golden Era' },
                '2000s': { memoryCount: 0, contributorCount: 0, tagline: 'New Millennium' },
                '2010s': { memoryCount: 0, contributorCount: 0, tagline: 'Modern Excellence' },
                '2020s': { memoryCount: 0, contributorCount: 0, tagline: 'The New Wave' }
            };
        }
    },

    /**
     * Increment decade memory count
     */
    async incrementDecadeCount(decade) {
        const decadeRef = firebase.firestore().collection('decades').doc(decade);

        try {
            await decadeRef.set({
                memoryCount: firebase.firestore.FieldValue.increment(1),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Error updating decade count:', error);
        }
    },

    /**
     * Send invite to join the archive
     */
    async sendInvite(email, personalMessage = '') {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Must be signed in to send invites');
        }

        try {
            const invite = {
                email: email.toLowerCase(),
                invitedBy: user.uid,
                inviterName: user.displayName || user.email,
                personalMessage,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Check if already invited
            const existing = await firebase.firestore()
                .collection('invites')
                .where('email', '==', email.toLowerCase())
                .get();

            if (!existing.empty) {
                throw new Error('This email has already been invited');
            }

            await firebase.firestore().collection('invites').add(invite);

            // In production, this would trigger a Cloud Function to send the email
            console.log('Invite created for:', email);

            return true;
        } catch (error) {
            console.error('Error sending invite:', error);
            throw error;
        }
    },

    /**
     * Get pending invites sent by current user
     */
    async getMyInvites() {
        const user = firebase.auth().currentUser;
        if (!user) return [];

        try {
            const snapshot = await firebase.firestore()
                .collection('invites')
                .where('invitedBy', '==', user.uid)
                .orderBy('createdAt', 'desc')
                .get();

            const invites = [];
            snapshot.forEach(doc => {
                invites.push({ id: doc.id, ...doc.data() });
            });

            return invites;
        } catch (error) {
            console.error('Error fetching invites:', error);
            return [];
        }
    },

    /**
     * Get recently joined users
     */
    async getRecentJoins(limit = 5) {
        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            const users = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                users.push({
                    id: doc.id,
                    displayName: data.displayName,
                    classYear: data.classYear,
                    createdAt: data.createdAt
                });
            });

            return users;
        } catch (error) {
            console.error('Error fetching recent joins:', error);
            return [];
        }
    },

    /**
     * Get community statistics
     */
    async getCommunityStats() {
        try {
            // Get user count
            const usersSnapshot = await firebase.firestore().collection('users').get();
            const userCount = usersSnapshot.size;

            // Get memory count
            const memoriesSnapshot = await firebase.firestore().collection('memories').get();
            const memoryCount = memoriesSnapshot.size;

            // Get decades represented
            const decadesSnapshot = await firebase.firestore().collection('decades').get();
            const decadeCount = decadesSnapshot.size || 8;

            return {
                userCount,
                memoryCount,
                decadeCount
            };
        } catch (error) {
            console.error('Error fetching community stats:', error);
            return { userCount: 0, memoryCount: 0, decadeCount: 8 };
        }
    },

    /**
     * Notify subscribers about new content
     * In production, this would be handled by Cloud Functions
     */
    async notifySubscribers(memory) {
        // This is a placeholder - actual implementation would use Cloud Functions
        // to send emails to users who have subscribed to notifications
        console.log('Would notify subscribers about new memory:', memory.title);

        // Store notification record
        try {
            await firebase.firestore().collection('notifications').add({
                type: 'new_memory',
                memoryId: memory.id,
                decade: memory.decade,
                title: memory.title,
                authorName: memory.authorName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                processed: false
            });
        } catch (error) {
            console.error('Error creating notification record:', error);
        }
    },

    /**
     * Search memories by title or content
     */
    async searchMemories(searchTerm, decade = null) {
        // Note: Full-text search in Firestore is limited
        // For production, consider using Algolia or Elasticsearch
        try {
            let query = firebase.firestore().collection('memories');

            if (decade) {
                query = query.where('decade', '==', decade);
            }

            const snapshot = await query.orderBy('createdAt', 'desc').limit(100).get();
            const memories = [];
            const searchLower = searchTerm.toLowerCase();

            snapshot.forEach(doc => {
                const data = doc.data();
                if (
                    data.title?.toLowerCase().includes(searchLower) ||
                    data.story?.toLowerCase().includes(searchLower)
                ) {
                    memories.push({ id: doc.id, ...data });
                }
            });

            return memories;
        } catch (error) {
            console.error('Error searching memories:', error);
            return [];
        }
    }
};

// Export module
window.DatabaseModule = DatabaseModule;
