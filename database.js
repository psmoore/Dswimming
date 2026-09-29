/**
 * Database Module for Dartmouth Swimming Alumni Archive
 * All Firestore reads are live listeners, so anything changed in the
 * database (including by hand in the Firebase console) shows up on the
 * page without a reload.
 *
 * Collections
 *   site/home                    title, intro, welcome, footer (admin-edited)
 *   decades/{id}                 label, tagline, startYear (admin-edited)
 *   memories/{id}                a photo, story or document; likedBy (uids), commentCount
 *     comments/{id}              comments on a memory
 *     witnesses/{uid}            members who marked "I was there"
 *   users/{uid}                  public member profile, visible to members
 *     private/contact            email, visible to the member and admins
 *   invites/{email}              invited emails; invitees join automatically
 */

import { auth, db } from './firebase-config.js';
import {
    collection,
    doc,
    query,
    where,
    orderBy,
    onSnapshot,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp,
    increment,
    arrayUnion,
    arrayRemove
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

function withIds(snapshot) {
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

function watch(ref, onData, onError) {
    return onSnapshot(ref, onData, (error) => {
        console.error('Listener error:', error);
        if (onError) onError(error);
    });
}

// ================================
// Site content & decades (public)
// ================================

export function watchSite(onData, onError) {
    return watch(doc(db, 'site', 'home'), snap => onData(snap.exists() ? snap.data() : null), onError);
}

export function watchDecades(onData, onError) {
    return watch(
        query(collection(db, 'decades'), orderBy('startYear')),
        snap => onData(withIds(snap)),
        onError
    );
}

export async function saveSite(fields) {
    await setDoc(doc(db, 'site', 'home'), fields, { merge: true });
}

export async function saveDecade(id, fields) {
    await setDoc(doc(db, 'decades', id), fields, { merge: true });
}

export async function deleteDecade(id) {
    await deleteDoc(doc(db, 'decades', id));
}

/**
 * First-run content for an empty archive. Taglines are left blank on
 * purpose — they're team history, so an admin writes them.
 */
export async function createStarterContent() {
    const batch = writeBatch(db);
    batch.set(doc(db, 'site', 'home'), {
        title: 'Dartmouth Swimming & Diving',
        intro: 'The photographs, stories and papers of Big Green swimmers and divers, kept by the alumni who were there.',
        welcome: 'Pick a decade on the board to see what teammates have shared, or add something of your own.',
        footer: 'Dartmouth Swimming & Diving alumni'
    }, { merge: true });

    for (let start = 1920; start <= 2020; start += 10) {
        batch.set(doc(db, 'decades', `${start}s`), {
            label: `${start}s`,
            tagline: '',
            startYear: start
        }, { merge: true });
    }
    await batch.commit();
}

// ================================
// Memories (members only)
// ================================

/**
 * Every memory, live. Sorting and per-decade grouping happen in the page,
 * which keeps the archive free of composite indexes. Fine for a few
 * thousand memories; switch to per-decade queries beyond that.
 */
export function watchMemories(onData, onError) {
    return watch(collection(db, 'memories'), snap => onData(withIds(snap)), onError);
}

export function newMemoryId() {
    return doc(collection(db, 'memories')).id;
}

export async function createMemory(memoryId, fields, author) {
    await setDoc(doc(db, 'memories', memoryId), {
        type: fields.type,
        title: fields.title,
        story: fields.story,
        decade: fields.decade,
        year: fields.year,
        people: fields.people,
        files: fields.files,
        authorId: auth.currentUser.uid,
        authorName: author.displayName,
        authorClassYear: author.classYear || null,
        likedBy: [],
        commentCount: 0,
        createdAt: serverTimestamp()
    });
}

export async function updateMemory(memoryId, fields) {
    await updateDoc(doc(db, 'memories', memoryId), { ...fields, updatedAt: serverTimestamp() });
}

/**
 * Delete a memory with its comments and "I was there" marks.
 * Storage files are removed separately by the caller.
 */
export async function deleteMemory(memoryId) {
    const batch = writeBatch(db);
    const [comments, witnesses] = await Promise.all([
        getDocs(collection(db, 'memories', memoryId, 'comments')),
        getDocs(collection(db, 'memories', memoryId, 'witnesses'))
    ]);
    comments.forEach(d => batch.delete(d.ref));
    witnesses.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'memories', memoryId));
    await batch.commit();
}

// ================================
// Likes, comments & "I was there"
// ================================

/**
 * Likes are the member uids in memory.likedBy; the rules only let a
 * member add or remove their own
 */
export async function setLike(memoryId, liked) {
    const uid = auth.currentUser.uid;
    await updateDoc(doc(db, 'memories', memoryId), {
        likedBy: liked ? arrayUnion(uid) : arrayRemove(uid)
    });
}

export function watchComments(memoryId, onData, onError) {
    return watch(
        query(collection(db, 'memories', memoryId, 'comments'), orderBy('createdAt')),
        snap => onData(withIds(snap)),
        onError
    );
}

/**
 * Comments and the memory's commentCount change together in one batch,
 * which the rules require, so the count on each card stays accurate
 */
export async function addComment(memoryId, text, author) {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'memories', memoryId, 'comments')), {
        text,
        authorId: auth.currentUser.uid,
        authorName: author.displayName,
        authorClassYear: author.classYear || null,
        createdAt: serverTimestamp()
    });
    batch.update(doc(db, 'memories', memoryId), { commentCount: increment(1) });
    await batch.commit();
}

/**
 * currentCount is the memory's commentCount; comments made before counts
 * existed leave it at 0, and are removed without changing it
 */
export async function deleteComment(memoryId, commentId, currentCount) {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'memories', memoryId, 'comments', commentId));
    if (currentCount > 0) {
        batch.update(doc(db, 'memories', memoryId), { commentCount: increment(-1) });
    }
    await batch.commit();
}

export function watchWitnesses(memoryId, onData, onError) {
    return watch(
        collection(db, 'memories', memoryId, 'witnesses'),
        snap => onData(withIds(snap)),
        onError
    );
}

export async function setWitness(memoryId, isThere, author) {
    const ref = doc(db, 'memories', memoryId, 'witnesses', auth.currentUser.uid);
    if (isThere) {
        await setDoc(ref, {
            displayName: author.displayName,
            classYear: author.classYear || null,
            createdAt: serverTimestamp()
        });
    } else {
        await deleteDoc(ref);
    }
}

// ================================
// Members
// ================================

export function watchMembers(onData, onError) {
    return watch(
        query(collection(db, 'users'), where('status', '==', 'member')),
        snap => onData(withIds(snap)),
        onError
    );
}

export function watchPendingMembers(onData, onError) {
    return watch(
        query(collection(db, 'users'), where('status', '==', 'pending')),
        snap => onData(withIds(snap)),
        onError
    );
}

export async function getMemberEmail(uid) {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'contact'));
    return snap.exists() ? snap.data().email : null;
}

export async function setMemberStatus(uid, status) {
    await updateDoc(doc(db, 'users', uid), { status });
}

// ================================
// Invites
// ================================

export function watchMyInvites(onData, onError) {
    return watch(
        query(collection(db, 'invites'), where('invitedBy', '==', auth.currentUser.uid)),
        snap => onData(withIds(snap)),
        onError
    );
}

/**
 * Add an email to the invite list. Returns false if someone already invited it
 * (the rules refuse to overwrite an existing invite).
 */
export async function addInvite(email, message, inviter) {
    const id = email.trim().toLowerCase();
    try {
        await setDoc(doc(db, 'invites', id), {
            email: id,
            message,
            invitedBy: auth.currentUser.uid,
            inviterName: inviter.displayName,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        if (error.code === 'permission-denied') return false;
        throw error;
    }
}

export async function deleteInvite(email) {
    await deleteDoc(doc(db, 'invites', email));
}
