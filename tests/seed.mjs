// Seeds the local emulators with test accounts and content (never touches production)
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const env = await initializeTestEnvironment({
    projectId: 'dartmouth-swimming',
    firestore: { rules: readFileSync(`${ROOT}/firestore.rules`, 'utf8'), host: '127.0.0.1', port: 8181 },
    storage: { rules: readFileSync(`${ROOT}/storage.rules`, 'utf8'), host: '127.0.0.1', port: 9199 }
});
await env.clearFirestore();
await env.clearStorage();
await fetch('http://127.0.0.1:9099/emulator/v1/projects/dartmouth-swimming/accounts', { method: 'DELETE' });

async function account(email, password, displayName) {
    const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, returnSecureToken: true })
    });
    return (await r.json()).localId;
}

const adminId = await account('admin@test.com', 'password', 'Ada Lindqvist');
const memberId = await account('member@test.com', 'password', 'Mike Kennedy');
const pendingId = await account('pending@test.com', 'password', 'Pat Nguyen');

// Grainy monochrome "photographs"
function photo(w, h, scene, seed) {
    const scenes = {
        pool: `<rect width='${w}' height='${h}' fill='#8c8a80'/>
            ${[...Array(6)].map((_, i) => `<rect x='0' y='${h * 0.35 + i * h * 0.11}' width='${w}' height='${h * 0.012}' fill='#3d3c37'/>`).join('')}
            <rect width='${w}' height='${h * 0.3}' fill='#54524a'/>
            ${[...Array(9)].map((_, i) => `<circle cx='${w * 0.08 + i * w * 0.105}' cy='${h * 0.27}' r='${h * 0.035}' fill='#222'/><rect x='${w * 0.065 + i * w * 0.105}' y='${h * 0.29}' width='${w * 0.03}' height='${h * 0.1}' fill='#222'/>`).join('')}`,
        team: `<rect width='${w}' height='${h}' fill='#a19d90'/>
            <rect y='${h * 0.62}' width='${w}' height='${h * 0.38}' fill='#6f6b60'/>
            ${[0, 1, 2].map(row => [...Array(7 - row)].map((_, i) => `<ellipse cx='${w * (0.16 + row * 0.055) + i * w * 0.115}' cy='${h * (0.32 + row * 0.16)}' rx='${w * 0.035}' ry='${h * 0.06}' fill='#2b2925'/><rect x='${w * (0.12 + row * 0.055) + i * w * 0.115}' y='${h * (0.37 + row * 0.16)}' width='${w * 0.08}' height='${h * 0.2}' rx='8' fill='#34322d'/>`).join('')).join('')}`,
        dive: `<rect width='${w}' height='${h}' fill='#b3b0a5'/>
            <rect x='${w * 0.1}' y='${h * 0.55}' width='${w * 0.45}' height='${h * 0.03}' fill='#2a2925'/>
            <rect x='${w * 0.1}' y='${h * 0.58}' width='${w * 0.04}' height='${h * 0.42}' fill='#3a3934'/>
            <ellipse cx='${w * 0.66}' cy='${h * 0.3}' rx='${w * 0.03}' ry='${h * 0.035}' fill='#1d1c1a'/>
            <path d='M${w * 0.6} ${h * 0.34} q ${w * 0.08} ${h * 0.02} ${w * 0.1} ${h * 0.14} l -${w * 0.02} ${h * 0.02} q -${w * 0.06} -${h * 0.08} -${w * 0.1} -${h * 0.1} z' fill='#1d1c1a'/>
            <rect y='${h * 0.8}' width='${w}' height='${h * 0.2}' fill='#77746a'/>`
    };
    return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
        <filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.9' seed='${seed}'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='.35'/></feComponentTransfer></filter>
        <filter id='b'><feGaussianBlur stdDeviation='1.2'/></filter>
        <g filter='url(#b)'>${scenes[scene]}</g>
        <rect width='100%' height='100%' filter='url(#g)'/>
        <radialGradient id='v'><stop offset='.55' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.45'/></radialGradient>
        <rect width='100%' height='100%' fill='url(#v)'/></svg>`;
}

const ts = (y, m = 5) => Timestamp.fromDate(new Date(y, m, 1));
const recent = (daysAgo) => Timestamp.fromDate(new Date(Date.now() - daysAgo * 864e5));

await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const storage = ctx.storage();

    async function upload(memId, name, svg, w, h) {
        const path = `memories/${memId}/${name}`;
        const r = ref(storage, path);
        await uploadBytes(r, new TextEncoder().encode(svg), { contentType: 'image/svg+xml', customMetadata: { uploadedBy: memberId } });
        return { url: await getDownloadURL(r), path, name, type: 'image/svg+xml', width: w, height: h };
    }

    await setDoc(doc(db, 'site/home'), {
        title: 'Dartmouth Swimming & Diving',
        intro: 'The photographs, stories and papers of Big Green swimmers and divers, kept by the alumni who were there.',
        welcome: 'Pick a decade on the board to see what teammates have shared, or add something of your own.',
        footer: 'Dartmouth Swimming & Diving alumni'
    });
    const taglines = { '1950s': 'Spaulding Pool days', '1990s': 'Karl Michael Pool opens', '2010s': '' };
    for (let s = 1950; s <= 2020; s += 10) {
        await setDoc(doc(db, `decades/${s}s`), { label: `${s}s`, tagline: taglines[`${s}s`] || '', startYear: s });
    }

    await setDoc(doc(db, `users/${adminId}`), { displayName: 'Ada Lindqvist', classYear: 1989, photoURL: null, status: 'member', role: 'admin', joinedAt: recent(200) });
    await setDoc(doc(db, `users/${adminId}/private/contact`), { email: 'admin@test.com' });
    await setDoc(doc(db, `users/${memberId}`), { displayName: 'Mike Kennedy', classYear: 1995, photoURL: null, status: 'member', joinedAt: recent(3) });
    await setDoc(doc(db, `users/${memberId}/private/contact`), { email: 'member@test.com' });
    await setDoc(doc(db, `users/${pendingId}`), { displayName: 'Pat Nguyen', classYear: 2004, photoURL: null, status: 'pending', joinedAt: recent(1) });
    await setDoc(doc(db, `users/${pendingId}/private/contact`), { email: 'pending@test.com' });

    const mem = (id, fields) => setDoc(doc(db, `memories/${id}`), {
        people: [], files: [], story: '', year: null, authorId: memberId, authorName: 'Mike Kennedy', authorClassYear: 1995, createdAt: recent(10), ...fields
    });

    await mem('m1', { type: 'photo', title: 'Ivy Championships, the 400 free relay', decade: '1990s', year: 1994,
        story: 'The moment we clinched it. Years of 5am practices, and it came down to the last relay.\n\nI still remember the sound in that natatorium: the echoes, the cheering, the slap of the touchpad.',
        people: ['Jim Thompson ’95', 'Sarah Reynolds ’98'], likedBy: [adminId], commentCount: 1, files: [await upload('m1', 'relay.svg', photo(1200, 800, 'pool', 3), 1200, 800)] });
    await mem('m2', { type: 'story', title: 'The bus ride to Princeton', decade: '1990s', year: 1997, authorId: adminId, authorName: 'Ada Lindqvist', authorClassYear: 1989,
        story: 'What was supposed to be a four-hour trip turned into an eleven-hour odyssey through a Connecticut ice storm. We ran out of snacks by Hartford and started a team-wide game of twenty questions that nobody ever won.\n\nWe swam the next morning on four hours of sleep. Half of us had best times.' });
    await mem('m3', { type: 'photo', title: 'Team photo, freshman year', decade: '1990s', year: 1991,
        files: [await upload('m3', 'team.svg', photo(900, 1100, 'team', 8), 900, 1100)] });
    await mem('m4', { type: 'photo', title: 'Three-meter board at Spaulding', decade: '1950s', year: 1956, authorId: adminId, authorName: 'Ada Lindqvist', authorClassYear: 1989,
        story: 'From my grandfather’s album. He dove for the Big Green from 1955 to 1958.',
        files: [await upload('m4', 'dive.svg', photo(1000, 1000, 'dive', 13), 1000, 1000)] });
    await mem('m5', { type: 'story', title: 'Coach’s last season', decade: '1990s', year: 1993,
        story: 'After twenty-five years, he announced his retirement at the end-of-season banquet. There wasn’t a dry eye in the room.' });

    await setDoc(doc(db, 'memories/m1/comments/c1'), { text: 'I was in that relay! Still the best swim of my life.', authorId: adminId, authorName: 'Ada Lindqvist', authorClassYear: 1989, createdAt: recent(2) });
    await setDoc(doc(db, `memories/m1/witnesses/${adminId}`), { displayName: 'Ada Lindqvist', classYear: 1989, createdAt: recent(2) });
    await setDoc(doc(db, 'invites/friend@test.com'), { email: 'friend@test.com', message: '', invitedBy: memberId, inviterName: 'Mike Kennedy', createdAt: recent(4) });
});

console.log('Seeded. Accounts: admin@test.com, member@test.com, pending@test.com (password: password)');
await env.cleanup();
process.exit(0);
