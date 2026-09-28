# CLAUDE.md

Dartmouth Swimming Alumni Archive — a members-only site at https://www.dartmouthswimming.com where swim & dive alumni share photos, stories and documents, organized by decade.

## Start of every session
- Read `MEMORY.md` for current status, decisions, and the active todo list.
- When you finish meaningful work, update `MEMORY.md`: status, todo checkboxes (keep the last 3 completed), and any new architectural decision with its date and reasoning.

## Stack rules (do not change)
- Plain HTML / CSS / vanilla JS as **native ES modules** (`<script type="module">`). **No** bundler, framework, TypeScript or build step. Runtime npm packages are not allowed; `tests/` has dev-only dependencies.
- Firebase **modular SDK v12**, imported from `https://www.gstatic.com/firebasejs/12.19.0/…`. The version appears in `firebase-config.js`, `auth.js`, `database.js` and `storage.js` — upgrade all four together.
- Modules: `firebase-config.js` (init + emulator switch), `auth.js` (sign-in, membership profile), `database.js` (live Firestore listeners + writes), `storage.js` (uploads), `ui.js` (DOM helpers), `app.js` (routing and rendering).
- Hosted on GitHub Pages from `master`. Pushing to `master` deploys to the live site.

## Content rules
- **No hard-coded content.** Everything a visitor reads (site title, intro, decades, taglines, memories, members, counts) comes from Firestore via live `onSnapshot` listeners, so edits in the Firebase console appear without a reload. UI labels and help text are fine in HTML.
- Render member-supplied text with `h()` / `textContent` from `ui.js`, never `innerHTML`.

## Security model (enforced in `firestore.rules` and `storage.rules`)
- Public: `site/home`, `decades/*`. Everything else requires `users/{uid}.status == 'member'`.
- New accounts are `pending`; they become `member` automatically if their verified email is in `invites/{email}`, or when an admin approves them in Settings.
- Admin = member with `role: 'admin'`, set by hand in the Firebase console. Clients can never set `role`.
- Emails live in `users/{uid}/private/contact` (self + admins only), not the public profile.
- After changing rules: run the tests (below), then deploy with `npx firebase-tools deploy --only firestore:rules,storage`.

## Do not
- Delete, rename, or edit `CNAME` — it breaks the custom domain.
- Treat the Firebase config in `firebase-config.js` as a secret (it's public by design).
- Add large binary assets without asking.
- Write to the production database from scripts; use the emulators.

## Style
- Match existing code: 4-space indent, `// ====` section banners in JS, async/await with try/catch.
- Design: aged paper, walnut wood rail, and the honor-board decade index (Dartmouth green panel, gilt lettering). Fonts: IM Fell English (display, stories) and Alegreya Sans (UI). Colors are tokens at the top of `styles.css`.
- Copy: sentence case, plain verbs, errors say what to do next.

## Local testing with the emulators
Java comes from Homebrew's unlinked openjdk; nginx on this machine holds port 8080, so Firestore's emulator uses 8181.
```
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
npx firebase-tools emulators:start                 # auth 9099, firestore 8181, storage 9199
cd tests && npm install && npm run seed            # test accounts: admin@ / member@ / pending@test.com, password "password"
python3 -m http.server 8000                        # then open http://localhost:8000/?emulator
```
Rules tests (starts and stops emulators itself):
```
npx firebase-tools emulators:exec --only firestore,storage "cd tests && npm test"
```
Without `?emulator`, localhost talks to the **production** Firebase project.
