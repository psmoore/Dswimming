# Project Memory: Dartmouth Swimming Alumni Archive

## Current Status & "The North Star"
*Last Updated: 2026-09-27*
- **North Star:** A private, living archive where Dartmouth varsity swim & dive alumni share photos and stories, organized by decade, and get notified when teammates add new memories.
- **Live at:** https://www.dartmouthswimming.com (GitHub Pages, repo `psmoore/Dswimming`, branch `master`)
- **Current State:** Front-end UI is built. Firebase project is configured and Auth (email/password + Google Sign-In) is wired up. Most data flows in `app.js` are still **simulated** (see Todo).
- **Current Sprint:** _TBD — fill in_
- **Next Immediate Step:** _TBD — likely wiring the Contribute form to `submitMemoryToFirebase()`_

---

## Tech Stack & Environment (Immutable)
*Note to AI: Do not suggest alternatives to these.*
- **Core:** Plain HTML / CSS / vanilla JavaScript. No framework, no bundler, no build step, no npm.
- **Backend:** Firebase project `dartmouth-swimming` — Auth, Firestore, Storage — loaded via the **v9 compat SDK** (`firebase-*-compat.js` 9.22.0 from gstatic CDN), i.e. the namespaced `firebase.firestore()` style API.
- **Hosting:** GitHub Pages with custom domain via `CNAME` (`www.dartmouthswimming.com`).
- **Fonts:** Google Fonts — Playfair Display (headings), Source Sans 3 (body).

### File map
| File | Role |
|---|---|
| `index.html` | Single page; all views (Timeline, Contribute, Invite) and modals |
| `styles.css` | All styling; pool lane-line motif, Dartmouth green branding |
| `firebase-config.js` | Firebase init; exposes `window.firebaseAuth/Db/Storage` |
| `auth.js` | `AuthModule` — sign up/in, Google sign-in, `users` collection |
| `database.js` | `DatabaseModule` — `memories` (+ `reactions`, `comments` subcollections), `decades`, `invites`, `users`, `notifications` |
| `storage.js` | `StorageModule` — photo/file uploads to Firebase Storage |
| `app.js` | UI state, event handlers, view switching, demo/simulation logic |
| `D-Pine_*.{eps,jpg,png}`, `d-pine.png` | Official Dartmouth D-Pine logos (favicon = `D-Pine_RGB.png`) |

Script load order matters (globals, no modules): Firebase SDK → `firebase-config.js` → `auth.js` → `database.js` → `storage.js` → `app.js`.

---

## Core Architectural Decisions (The "Why")
*This section prevents the AI from 'forgetting' why we didn't use a certain library or pattern.*

1. **2026-01-12: Static site + Firebase, no build tooling**
   - **Context:** Small alumni site, hosted free on GitHub Pages.
   - **Decision:** Vanilla JS with global module objects (`AuthModule`, `DatabaseModule`, `StorageModule`) and Firebase as the entire backend.
   - **Reasoning:** Zero server to maintain; anyone can edit and push.
   - **Consequence:** Don't introduce npm, React, ES module imports, or a bundler. Keep using the compat SDK API.

2. **2026-01-12: Decade-based timeline as the organizing structure**
   - **Context:** Alumni span 1950s–2020s and contribute memories retroactively.
   - **Decision:** Memories are tagged by decade; the Timeline view switches between decades.
   - **Consequence:** New content features should fit the decade model.

3. **2026-02-05: Official Dartmouth D-Pine branding**
   - **Decision:** Use the official D-Pine logo files in the repo root rather than recreated artwork.

---

## Known Constraints & "Do Not" List
- **Firebase web config is public by design** — the API key in `firebase-config.js` is not a secret. Real protection must come from Firestore/Storage **security rules**.
- **Security rules:** Setup notes say Firestore and Storage were started in *test mode* — must be locked down before real alumni data goes in. _(Verify current state in the Firebase console.)_
- **CNAME:** Don't delete or rename `CNAME` — history shows repeated create/delete churn that breaks the custom domain.
- **Do not** add a build step or framework (see Decision 1).
- Don't commit large new binary assets unnecessarily; the logo `.eps` files are already ~9 MB.

---

## Active Todo / Working Memory
- [ ] Wire Contribute form (`handleContributeSubmit`) to `submitMemoryToFirebase()` + `StorageModule` — currently only shows a fake toast
- [ ] Replace hard-coded `decadeData` counts in `app.js` with Firestore data
- [ ] Remove demo simulations (`simulateNewContent`, fake "247 alumni notified", static notification badge "3")
- [ ] Actually send invite emails (`DatabaseModule.sendInvite` only writes to `invites`; needs a Cloud Function or email service)
- [ ] Write and deploy Firestore/Storage security rules (restrict to signed-in / invited alumni)
- [x] Add Google Sign-In authentication (2026-01-12)
- [x] Add official D-Pine logos (2026-02-05)
- [x] Change browser tab favicon (2026-02-05)
