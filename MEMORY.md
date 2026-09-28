# Project Memory: Dartmouth Swimming Alumni Archive

## Current Status & "The North Star"
*Last Updated: 2026-09-27*
- **North Star:** A private, living archive where Dartmouth swim & dive alumni share photos, stories and documents, organized by decade.
- **Live at:** https://www.dartmouthswimming.com (GitHub Pages, repo `psmoore/Dswimming`, branch `master`)
- **Current State:** Full redesign and rebuild done locally (vintage paper / walnut / honor board look, all content live from Firestore, members-only access, security rules with 54 passing tests). **Not yet committed, pushed or deployed.**
- **Next Immediate Step:** Launch checklist below.

### Launch checklist (order matters)
1. Enable Firebase Storage (requires the Blaze pay-as-you-go plan for `*.firebasestorage.app` buckets). Without it, photo and document uploads fail; stories still work.
2. Deploy rules: `npx firebase-tools login`, then `npx firebase-tools deploy --only firestore:rules,storage`. Until this is done, the production database is readable by anyone.
3. In the Firebase console, on your own `users/{uid}` document: set `status: "member"` and `role: "admin"` (the first admin can only be set by hand).
4. Check Authentication › Settings › Authorized domains includes `www.dartmouthswimming.com`, and that Email/Password and Google providers are enabled.
5. Push to `master`, sign in, open Settings, choose "Add starter content", then write the decade taglines.

---

## Tech Stack & Environment (Immutable)
*Note to AI: Do not suggest alternatives to these.*
- **Core:** Plain HTML / CSS / vanilla JS as native ES modules. No framework, bundler or build step.
- **Backend:** Firebase project `dartmouth-swimming` — Auth, Firestore, Storage — modular SDK 12.19.0 from the gstatic CDN.
- **Hosting:** GitHub Pages with custom domain via `CNAME`.
- **Fonts:** IM Fell English / IM Fell English SC (display, stories), Alegreya Sans (UI).
- **Dev tooling:** Firebase CLI via `npx firebase-tools`; emulators need Java from `/opt/homebrew/opt/openjdk/bin`; Firestore emulator on 8181 because nginx holds 8080.

### Data model
| Path | Contents | Who can read |
|---|---|---|
| `site/home` | title, intro, welcome, footer | anyone |
| `decades/{1990s}` | label, tagline, startYear | anyone |
| `memories/{id}` | type, title, story, decade, year, people, files, author fields | members |
| `memories/{id}/comments/{id}` | text, author fields | members |
| `memories/{id}/witnesses/{uid}` | "I was there" marks | members |
| `users/{uid}` | displayName, classYear, status, role, joinedAt | self + members |
| `users/{uid}/private/contact` | email | self + admins |
| `invites/{email}` | invite list; id is the lowercased email | inviter, invitee, admins |

---

## Core Architectural Decisions (The "Why")

1. **2026-01-12: Static site + Firebase, no build tooling**
   - **Decision:** Vanilla JS with Firebase as the entire backend.
   - **Reasoning:** Zero server to maintain; hosted free on GitHub Pages.
   - **Consequence:** Don't introduce npm runtime deps, React, or a bundler.

2. **2026-01-12: Decade-based timeline as the organizing structure**
   - **Consequence:** New content features should fit the decade model.

3. **2026-09-27: Modular Firebase SDK v12 as native ES modules** (replaced the v9 compat SDK)
   - **Reasoning:** Current, supported API; no build step needed with `<script type="module">`.

4. **2026-09-27: Everything shown comes from Firestore, live**
   - **Context:** The old site was full of fake content (sample memories, "247 members", "7 championships", simulated notifications).
   - **Decision:** All content comes from `onSnapshot` listeners; empty states invite people to add content. Admins edit the front page and decades in Settings (or in the Firebase console).
   - **Consequence:** Never hard-code content. The site loads all memories in one listener, which is fine for a few thousand; switch to per-decade queries beyond that.

5. **2026-09-27: Members-only, with invite-based membership**
   - **Context:** The owner chose "signed-in alumni only". Sign-in alone would let anyone with a Google account in.
   - **Decision:** Accounts start `pending`. A verified email on the invite list joins automatically; otherwise an admin approves. Invites create the list entry and open a pre-written email in the member's own mail app (no server-side email).
   - **Consequence:** Rules, not the client, enforce access. Keep `tests/rules.test.mjs` passing.

6. **2026-09-27: Vintage design built around the honor board**
   - **Decision:** Aged paper with grain and foxing, a walnut rail, and a natatorium-style honor board (walnut frame, Dartmouth green panel, gilt lettering) as the decade index. Photos are mounted with black photo corners and brick-red date stamps; stories are set in IM Fell with drop caps.
   - **Consequence:** Keep one bold element (the board); everything else stays quiet.

---

## Known Constraints & "Do Not" List
- **Firebase web config is public by design** — protection comes from the rules.
- **CNAME:** Don't delete or rename it.
- **Download URLs:** Storage download URLs carry a token and work for anyone who has the link; the rules only stop listing and guessing.
- Don't write to production from scripts; use the emulators and `tests/seed.mjs`.
- The old `notifications` collection is unused and closed by the rules.

---

## Active Todo / Working Memory
- [ ] Work through the launch checklist above
- [ ] Decide whether to send invite and new-memory emails automatically (needs Cloud Functions or the Trigger Email extension, both on the Blaze plan)
- [ ] Optional: Firebase App Check to limit API abuse
- [x] Redesign: vintage paper, walnut, honor board (2026-09-27)
- [x] Replace all fake content with live Firestore data; members-only rules with 54 tests (2026-09-27)
- [x] Add CLAUDE.md and MEMORY.md (2026-09-27)
