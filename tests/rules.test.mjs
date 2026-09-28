import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, serverTimestamp, deleteField, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const env = await initializeTestEnvironment({
    projectId: 'dartmouth-swimming',
    firestore: { rules: readFileSync(`${ROOT}/firestore.rules`, 'utf8'), host: '127.0.0.1', port: 8181 },
    storage: { rules: readFileSync(`${ROOT}/storage.rules`, 'utf8'), host: '127.0.0.1', port: 9199 }
});

let passed = 0, failed = 0;
async function t(name, fn) {
    try { await fn(); passed++; console.log('  ok  ', name); }
    catch (e) { failed++; console.log('  FAIL', name, '\n       ', e.message.split('\n')[0]); }
}

await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'site/home'), { title: 'T' });
    await setDoc(doc(db, 'decades/1990s'), { label: '1990s', tagline: '', startYear: 1990 });
    await setDoc(doc(db, 'users/admin'), { displayName: 'Ada', classYear: 1990, status: 'member', role: 'admin' });
    await setDoc(doc(db, 'users/mem'), { displayName: 'Mo', classYear: 1995, status: 'member' });
    await setDoc(doc(db, 'users/pend'), { displayName: 'Pat', classYear: null, status: 'pending' });
    await setDoc(doc(db, 'users/legacy'), { displayName: 'Leg', email: 'leg@x.com', notificationPreferences: { a: 1 }, createdAt: new Date() });
    await setDoc(doc(db, 'users/mem/private/contact'), { email: 'mo@x.com' });
    await setDoc(doc(db, 'invites/inv@x.com'), { email: 'inv@x.com', invitedBy: 'mem', inviterName: 'Mo', message: '', createdAt: new Date() });
    await setDoc(doc(db, 'memories/m1'), { type: 'story', title: 'Hi', story: 's', decade: '1990s', year: 1994, people: [], files: [], authorId: 'mem', authorName: 'Mo', authorClassYear: 1995, createdAt: new Date() });
    await setDoc(doc(db, 'memories/m1/comments/c1'), { text: 'x', authorId: 'admin', authorName: 'Ada', authorClassYear: 1990, createdAt: new Date() });
});

const anon = env.unauthenticatedContext().firestore();
const pend = env.authenticatedContext('pend', { email: 'pat@x.com', email_verified: true }).firestore();
const mem = env.authenticatedContext('mem', { email: 'mo@x.com', email_verified: true }).firestore();
const admin = env.authenticatedContext('admin', { email: 'ada@x.com', email_verified: true }).firestore();
const stranger = env.authenticatedContext('new1', { email: 'nobody@x.com', email_verified: true }).firestore();
const invitee = env.authenticatedContext('new2', { email: 'INV@x.com', email_verified: true }).firestore();
const unverifiedInvitee = env.authenticatedContext('new3', { email: 'inv@x.com', email_verified: false }).firestore();
const legacy = env.authenticatedContext('legacy', { email: 'leg@x.com', email_verified: true }).firestore();

const memory = (over = {}) => ({ type: 'story', title: 'T', story: 'S', decade: '1990s', year: null, people: [], files: [], authorId: 'mem', authorName: 'Mo', authorClassYear: 1995, createdAt: serverTimestamp(), ...over });
const newProfile = (status) => ({ displayName: 'N', classYear: 2001, photoURL: null, status, joinedAt: serverTimestamp() });

console.log('Public');
await t('anyone reads site & decades', () => Promise.all([assertSucceeds(getDoc(doc(anon, 'site/home'))), assertSucceeds(getDoc(doc(anon, 'decades/1990s')))]));
await t('anon cannot read memories', () => assertFails(getDoc(doc(anon, 'memories/m1'))));
await t('anon cannot read users', () => assertFails(getDocs(collection(anon, 'users'))));
await t('member cannot edit site', () => assertFails(setDoc(doc(mem, 'site/home'), { title: 'x' })));
await t('admin edits site & decades', () => Promise.all([assertSucceeds(setDoc(doc(admin, 'site/home'), { title: 'x' }, { merge: true })), assertSucceeds(setDoc(doc(admin, 'decades/2000s'), { label: '2000s', startYear: 2000, tagline: '' }))]));

console.log('Joining');
await t('stranger creates pending profile', () => assertSucceeds(setDoc(doc(stranger, 'users/new1'), newProfile('pending'))));
await t('stranger cannot self-create as member', () => assertFails(setDoc(doc(stranger, 'users/new1b'), newProfile('member'))));
await t('stranger cannot create profile with role', () => assertFails(setDoc(doc(stranger, 'users/new1'), { ...newProfile('pending'), role: 'admin' })));
await t('invitee (case-insensitive) creates member profile', () => assertSucceeds(setDoc(doc(invitee, 'users/new2'), newProfile('member'))));
await t('unverified invitee cannot be member', () => assertFails(setDoc(doc(unverifiedInvitee, 'users/new3'), newProfile('member'))));
await t('pending cannot promote self', () => assertFails(updateDoc(doc(pend, 'users/pend'), { status: 'member' })));
await t('member cannot make self admin', () => assertFails(updateDoc(doc(mem, 'users/mem'), { role: 'admin' })));
await t('member edits own name/year', () => assertSucceeds(updateDoc(doc(mem, 'users/mem'), { displayName: 'Mo B', classYear: 1996 })));
await t('member cannot edit someone else', () => assertFails(updateDoc(doc(mem, 'users/pend'), { displayName: 'x' })));
await t('legacy profile migrates (drop email, set pending)', () => assertSucceeds(updateDoc(doc(legacy, 'users/legacy'), { email: deleteField(), notificationPreferences: deleteField(), status: 'pending' })));
await t('legacy writes own private email', () => assertSucceeds(setDoc(doc(legacy, 'users/legacy/private/contact'), { email: 'leg@x.com' })));
await t('cannot write someone else\'s email as own', () => assertFails(setDoc(doc(legacy, 'users/legacy/private/contact'), { email: 'other@x.com' })));
await t('admin approves pending', () => assertSucceeds(updateDoc(doc(admin, 'users/pend'), { status: 'member' })));
await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'users/pend'), { status: 'pending' }));

console.log('Privacy');
await t('pending reads own profile', () => assertSucceeds(getDoc(doc(pend, 'users/pend'))));
await t('pending cannot read memories', () => assertFails(getDoc(doc(pend, 'memories/m1'))));
await t('pending cannot read other profiles', () => assertFails(getDoc(doc(pend, 'users/mem'))));
await t('member reads members list', () => assertSucceeds(getDocs(query(collection(mem, 'users'), where('status', '==', 'member')))));
await t('member cannot read another member\'s email', () => assertFails(getDoc(doc(mem, 'users/admin/private/contact'))));
await t('admin reads a member\'s email', () => assertSucceeds(getDoc(doc(admin, 'users/mem/private/contact'))));

console.log('Memories');
await t('member reads memories', () => assertSucceeds(getDocs(collection(mem, 'memories'))));
await t('member creates memory', () => assertSucceeds(setDoc(doc(mem, 'memories/m2'), memory())));
await t('cannot create memory as someone else', () => assertFails(setDoc(doc(mem, 'memories/m3'), memory({ authorId: 'admin' }))));
await t('cannot create memory in unknown decade', () => assertFails(setDoc(doc(mem, 'memories/m4'), memory({ decade: '1880s' }))));
await t('cannot add unknown fields', () => assertFails(setDoc(doc(mem, 'memories/m5'), memory({ featured: true }))));
await t('pending cannot create memory', () => assertFails(setDoc(doc(pend, 'memories/m6'), memory({ authorId: 'pend' }))));
await t('author edits own memory', () => assertSucceeds(updateDoc(doc(mem, 'memories/m1'), { title: 'New', updatedAt: serverTimestamp() })));
await t('author cannot change authorId', () => assertFails(updateDoc(doc(mem, 'memories/m1'), { authorId: 'admin' })));
await t('another member cannot edit', () => assertFails(updateDoc(doc(invitee, 'memories/m1'), { title: 'x' })));
await t('admin edits any memory', () => assertSucceeds(updateDoc(doc(admin, 'memories/m1'), { title: 'Admin' })));

console.log('Comments & witnesses');
await t('member comments', () => assertSucceeds(setDoc(doc(mem, 'memories/m1/comments/c2'), { text: 'hi', authorId: 'mem', authorName: 'Mo', authorClassYear: 1995, createdAt: serverTimestamp() })));
await t('empty comment refused', () => assertFails(setDoc(doc(mem, 'memories/m1/comments/c3'), { text: '', authorId: 'mem', authorName: 'Mo', authorClassYear: 1995, createdAt: serverTimestamp() })));
await t('member marks I was there', () => assertSucceeds(setDoc(doc(mem, 'memories/m1/witnesses/mem'), { displayName: 'Mo', classYear: 1995, createdAt: serverTimestamp() })));
await t('cannot mark for someone else', () => assertFails(setDoc(doc(mem, 'memories/m1/witnesses/admin'), { displayName: 'Ada', classYear: 1990, createdAt: serverTimestamp() })));
await t('memory author deletes memory with others\' comments (batch)', async () => {
    const batch = writeBatch(mem);
    batch.delete(doc(mem, 'memories/m1/comments/c1'));
    batch.delete(doc(mem, 'memories/m1/comments/c2'));
    batch.delete(doc(mem, 'memories/m1/witnesses/mem'));
    batch.delete(doc(mem, 'memories/m1'));
    await assertSucceeds(batch.commit());
});

console.log('Invites');
await t('member invites lowercase email', () => assertSucceeds(setDoc(doc(mem, 'invites/new@x.com'), { email: 'new@x.com', message: '', invitedBy: 'mem', inviterName: 'Mo', createdAt: serverTimestamp() })));
await t('cannot overwrite existing invite', () => assertFails(setDoc(doc(admin, 'invites/new@x.com'), { email: 'new@x.com', message: '', invitedBy: 'admin', inviterName: 'Ada', createdAt: serverTimestamp() })));
await t('uppercase invite id refused', () => assertFails(setDoc(doc(mem, 'invites/Big@x.com'), { email: 'Big@x.com', message: '', invitedBy: 'mem', inviterName: 'Mo', createdAt: serverTimestamp() })));
await t('pending cannot invite', () => assertFails(setDoc(doc(pend, 'invites/p@x.com'), { email: 'p@x.com', message: '', invitedBy: 'pend', inviterName: 'Pat', createdAt: serverTimestamp() })));
await t('member lists own invites', () => assertSucceeds(getDocs(query(collection(mem, 'invites'), where('invitedBy', '==', 'mem')))));
await t('member cannot list all invites', () => assertFails(getDocs(collection(mem, 'invites'))));
await t('invitee reads own invite', () => assertSucceeds(getDoc(doc(invitee, 'invites/inv@x.com'))));
await t('stranger cannot read others\' invite', () => assertFails(getDoc(doc(stranger, 'invites/inv@x.com'))));
await t('closed collections stay closed', () => assertFails(getDocs(collection(admin, 'notifications'))));

console.log('Storage');
const bytes = new Uint8Array([1, 2, 3]);
const st = (ctx) => ctx.storage();
const memCtx = env.authenticatedContext('mem', { email: 'mo@x.com', email_verified: true });
const pendCtx = env.authenticatedContext('pend', { email: 'pat@x.com', email_verified: true });
await t('member uploads a photo', () => assertSucceeds(uploadBytes(ref(st(memCtx), 'memories/m9/a.jpg'), bytes, { contentType: 'image/jpeg', customMetadata: { uploadedBy: 'mem' } })));
await t('member reads a photo', () => assertSucceeds(getBytes(ref(st(memCtx), 'memories/m9/a.jpg'))));
await t('pending cannot upload', () => assertFails(uploadBytes(ref(st(pendCtx), 'memories/m9/b.jpg'), bytes, { contentType: 'image/jpeg', customMetadata: { uploadedBy: 'pend' } })));
await t('pending cannot read photos', () => assertFails(getBytes(ref(st(pendCtx), 'memories/m9/a.jpg'))));
await t('non-image upload refused', () => assertFails(uploadBytes(ref(st(memCtx), 'memories/m9/x.html'), bytes, { contentType: 'text/html', customMetadata: { uploadedBy: 'mem' } })));
await t('upload outside memories/ refused', () => assertFails(uploadBytes(ref(st(memCtx), 'other/a.jpg'), bytes, { contentType: 'image/jpeg', customMetadata: { uploadedBy: 'mem' } })));

console.log(`\n${passed} passed, ${failed} failed`);
await env.cleanup();
process.exit(failed ? 1 : 0);
