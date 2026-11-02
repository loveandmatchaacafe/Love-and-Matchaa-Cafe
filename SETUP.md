# Love & Matchaa Café V5 — setup checklist

**This is a Firebase-connected starter build, not a ready-to-deploy live POS.** You must complete Firebase setup, copy image assets, test permissions and backups before using it for real orders. Hosting on GitHub Pages can stay free. Firebase Spark is a quota-limited ongoing free plan, not a time-limited trial.

## 0. Preserve the original site and its data

- Do **not** replace the live V4 site yet.
- On the original browser used by the café, open V4 and export orders and sales CSV files; save copies somewhere safe. Do not clear browser data.
- Copy the `assets/images/` folder (logo and drink-1.webp through drink-11.webp) from the V4 project into this V5 project. These assets were not included in the three files uploaded to ChatGPT.

## 1. Create a Firebase project (using the owner's Google account)

1. Visit Firebase Console, create a project, and select the **Spark** (no-cost) plan. Do not enable billing.
2. Under **Build > Authentication > Sign-in method**, enable **Email/Password**.
3. Under **Build > Firestore Database**, create a database (choose a region reasonably near the café). Use production mode and publish the supplied `firestore.rules` under **Firestore > Rules** immediately.
4. Under **Project settings > Your apps**, register a **Web app**, copy its Firebase config into `js/firebase-config.js` (only replace placeholders).
5. In **Authentication > Settings > Authorized domains**, add your exact GitHub Pages host if required (e.g. `lylemalvin.github.io`).

## 2. Create the FIRST owner account (one-time bootstrap)

1. In **Authentication > Users**, click **Add user** and create the owner's email/password. Copy that user's UID.
2. In **Firestore > Data**, create collection `users`, document ID = **the exact UID**.
3. Add these fields with the exact types:
   - `email` (string): the owner's email
   - `role` (string): `owner`
   - `active` (boolean): `true`
4. Do not enable public sign-up. Other accounts must be created inside the app by the owner.
5. In Firestore Rules, paste/publish `firestore.rules`. Never deploy permissive test-mode rules.

## 3. Deploy

1. Keep `index.html`, `css/`, `js/`, and `assets/` in the GitHub repository root (not nested inside an extra folder).
2. Prefer deploying V5 to a **separate test repository** first so V4 remains available during testing.
3. GitHub repository > Settings > Pages > Deploy from `main` branch and `/(root)`.
4. Open the GitHub Pages site directly in Chrome or Edge. Sign in with the owner account.
5. Test: create a staff account and viewer account, sign in on different devices, verify updates arrive live, and verify viewers cannot edit or export. Disable a staff account and check that access is revoked.
6. Test Export Orders, Export Sales, and End-of-Day Report in a normal browser. Downloads should save `.csv` files.

## 4. Import the V4 order history

On the **same browser/device** that originally saved V4 orders, visit the new V5 URL, log in as Owner, and select **Import local V4 orders**. It reads the original V4 localStorage key and skips IDs that already exist. Keep exported CSV backups. If the V4 and V5 sites use **different origins** (e.g. different GitHub Pages domains), browser localStorage will not transfer; use a separate migration method before switching.

## 5. Important limits and safety

- V5 shows **up to the 500 newest orders** in the live history view; this is not yet a complete paginated reporting/archive solution. Plan pagination before production use.
- Real-time saving needs internet. This build does **not** offer safe offline order queueing or automatic conflict resolution. If internet goes down, do not assume an order was saved.
- Firebase email/password accounts need a secure password-reset workflow and ideally MFA for owner access before production. The temporary password creation flow is a starter and should not be used to send passwords in public chat.
- Firebase's free plan has read/write/storage quotas. Check the Firebase Console usage dashboards. If limits are reached, functionality can stop until quota resets.
- Owner should regularly export backups. This is a small-business starter POS, not a certified financial/accounting system.
- Firestore security rules restrict who can read/write, but do not by themselves validate every possible business field. For higher assurance, validate prices and order totals in trusted server-side code (which may require paid features or a separate backend).
- An owner can disable users from the staff panel. Firebase Auth records for disabled users remain until cleaned up in the console; database rules block access while disabled.
