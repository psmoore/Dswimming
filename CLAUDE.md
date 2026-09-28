# CLAUDE.md

Dartmouth Swimming Alumni Archive — a static site at https://www.dartmouthswimming.com where swim & dive alumni share photos and stories organized by decade.

## Start of every session
- Read `MEMORY.md` for current status, decisions, and the active todo list.
- When you finish meaningful work, update `MEMORY.md`: status, todo checkboxes (keep the last 3 completed), and any new architectural decision with its date and reasoning.

## Stack rules (do not change)
- Plain HTML / CSS / vanilla JS. **No** npm, bundler, framework, TypeScript, or ES module `import`s.
- Firebase (Auth, Firestore, Storage) via the **v9 compat SDK** from the gstatic CDN — use the namespaced style (`firebase.firestore().collection(...)`), not the modular API.
- Code is organized as global objects: `AuthModule` (`auth.js`), `DatabaseModule` (`database.js`), `StorageModule` (`storage.js`); UI logic lives in `app.js`. Script order in `index.html` matters.
- Hosted on GitHub Pages from `master`. Pushing to `master` deploys to the live site.

## Do not
- Delete, rename, or edit `CNAME` — it breaks the custom domain.
- Treat the Firebase config in `firebase-config.js` as a secret (it's public by design); security comes from Firestore/Storage rules.
- Add large binary assets without asking.

## Style
- Match existing code: 4-space indent, `// ====` section banners in JS, async/await with try/catch in modules.
- Branding: Dartmouth green, Playfair Display headings, Source Sans 3 body, official D-Pine logo files in the repo root.

## Testing
- No test suite or build. Preview by opening `index.html` via a local server (e.g. `python3 -m http.server`) and checking the browser console.
