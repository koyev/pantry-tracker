# Pantry Tracker — Product & Build Spec (v3)

> **How to use this doc:** This is the single source of truth for the app. When working with an AI coding assistant (Cursor, Claude Code, etc.), paste or point it at this file first so it understands the product, the data shapes, and the rules before writing any code. Keep it updated as decisions change.

> **Changelog v2 → v3 (2026-06):** Aligned the build to **Expo SDK 56** (the version now on `main`). Locked previously-open decisions: **storage = `expo-sqlite`** (not AsyncStorage), **navigation = expo-router `NativeTabs`** (not React Navigation), **scanning = `expo-camera`** (the old `expo-barcode-scanner` is removed in modern SDKs). Reworked the folder map to the real `src/`-based structure. Reconciled the expiry status thresholds. Noted that ASO app naming is already applied (`Pantry Tracker — Stockpile`).
>
> **⚠️ Verify-before-trusting:** SDK 56 post-dates some tooling knowledge and the live Expo docs may be unreachable in CI/agent sandboxes. Every SDK-56 API named below (camera barcode props, sqlite methods, native-tabs surface, notification trigger shape) is a **target to confirm against the installed TypeScript types** in `node_modules/expo-*` before relying on it.

A simple, minimalist app to scan groceries, track what you have, and get alerted before food expires. Built solo on Windows + iPhone, shipped to iOS and Android from one codebase.

---

## 1. Product context (read this first)

**Problem:** People forget what's in their fridge/pantry and throw out food that quietly expired. Existing apps are either bloated business-inventory tools or ugly.

**Target user:** A regular household person (not a business) who wants to waste less food and money. Tech comfort: medium. Wants something they can use in under 10 seconds per item.

**Core promise:** Scan a barcode, set an expiry, and get warned before it goes bad.

**Design principles:**

- Minimalist and fast. Adding an item should take seconds.
- Works fully offline. No login required to use the core app.
- Calm, not nagging. Notifications are helpful, never spammy.

**Explicit non-goals for v1:** No accounts/login, no cloud sync, no barcode generation, no recipes, no nutrition tracking, no multi-user, **no web app**. These are future features, not v1.

**Platforms:** v1 ships to **iOS and Android only.** The app's core action — scanning a barcode with the phone camera in the kitchen — is inherently mobile, and the device features it relies on (camera, scheduled local notifications) degrade or don't work on web. Web is therefore *not* an app target. A simple **marketing/landing page** is built at the very end of v1 (see §11) — separate from the app, not the React Native code running in a browser.

---

## 2. Scope rule

If a feature isn't listed in this doc, it does **not** go in version 1. First apps die from scope creep. Ship small, add later.

---

## 3. User stories with acceptance criteria

Each story is "done" only when every acceptance criterion passes.

**US-1 — Add item by scanning**
As a user, I can scan a product barcode to quickly add it to my pantry.

- Tapping "+ Scan" opens the camera.
- A recognized barcode triggers an Open Food Facts lookup.
- If found, the name and image are pre-filled; I only set quantity + expiry.
- If not found, I can type the name manually; the barcode is still saved.
- Saving returns me to the Home list with the new item visible.

**US-2 — Add item manually**
As a user, I can add an item with no barcode (e.g. leftovers, loose veg).

- An "Add manually" option exists on the Scan screen.
- Name + expiry are required; quantity defaults to 1.

**US-3 — See what's expiring**
As a user, I can see my items sorted by soonest expiry.

- Home list is sorted ascending by `expiryDate`.
- Each row shows a status dot per the single thresholds rule (Section 5.1): green (>3 days), amber (0–3 days), red (expired).
- Expired items are visually distinct and sorted to the top.

**US-4 — Edit / delete an item**

- Tapping an item opens detail; I can change quantity, expiry, location, or delete it.
- Delete asks for confirmation.

**US-5 — Get expiry alerts**
As a user, I get notified before food expires.

- A daily local notification summarizes items expiring within my chosen lead time (default 2 days).
- Tapping the notification opens the Home list.
- I can turn notifications off and change the lead time in Settings.

**US-6 — Data persists**

- All items survive closing and reopening the app (stored on device via `expo-sqlite`).

**US-7 — Review prompt (see ASO section)**

- After the user successfully saves their **first** item, show the OS review prompt once. Never during onboarding or on an error.

---

## 4. Screens & routes (the entire app is 4 screens)

The app is built on **expo-router** with the file tree rooted at `src/app/` (see Section 8). Screen → route mapping:

1. **Home / My Pantry** — `src/app/index.tsx` (tab `index`). List sorted by soonest expiry; name, quantity, expiry, status dot. Big "+ Scan" button. Empty state explains how to add the first item.
2. **Scan** — `src/app/scan.tsx` (non-tab route). Camera + barcode reader; "Add manually" fallback; after lookup shows an editable form (name, quantity, unit, location, expiry).
3. **Item detail / edit** — `src/app/item/[id].tsx` (non-tab dynamic route). Edit fields, delete.
4. **Settings** — `src/app/settings.tsx` (tab `settings`). Notifications toggle, lead-time (days before expiry), and later the Pro upgrade.

No login screen in v1. The two tabs are **Home** and **Settings**; `scan` and `item/[id]` are pushed/presented routes, not tabs (see the NativeTabs note in Section 8).

---

## 5. Data model (one local table)

```ts
type Location = 'fridge' | 'freezer' | 'pantry';

interface Item {
  id: string; // uuid — generated with expo-crypto's Crypto.randomUUID()
  name: string; // required, 1–80 chars
  barcode: string | null; // nullable for manual items
  quantity: number; // default 1, min 0
  unit: string; // "pcs" | "g" | "ml" | "kg" | "L" ...
  location: Location; // default "fridge"
  expiryDate: string; // ISO date "YYYY-MM-DD", required
  addedDate: string; // ISO date, set on create
  imageUrl: string | null; // from food API, nullable
}
```

**Validation rules:** name required and trimmed; expiryDate required and a valid date (may be in the past — that's an expired item, allowed); quantity ≥ 0.

**ID generation:** use `Crypto.randomUUID()` from **`expo-crypto`** (no polyfill needed on React Native). The repo also pins `uuid@^11` via `overrides`; `uuid.v4()` is a viable alternative but requires `react-native-get-random-values` — prefer `expo-crypto` to avoid the extra polyfill.

**Storage:** **`expo-sqlite`** (decided — clean scaling for sorting/filtering by expiry; no AsyncStorage). All on-device, no server in v1. All access goes through `src/lib/db.ts` (Section 8). Target API to use (confirm against installed types): a `SQLiteProvider` mounted in `src/app/_layout.tsx`, `useSQLiteContext()` inside `db.ts`, and `runAsync` / `getAllAsync` / `getFirstAsync` / `execAsync` for queries/migrations.

### 5.1 Expiry status thresholds (single source of truth)

Computed from days until `expiryDate` (today = day 0). Keep these constants in `src/constants/theme.ts` so the dot color and any copy stay consistent:

- **Green** — more than 3 days left (`daysLeft > 3`).
- **Amber** — 0 to 3 days left (`0 <= daysLeft <= 3`).
- **Red** — expired (`daysLeft < 0`).

---

## 6. Barcode lookup — API contract

**Open Food Facts** — free, open, no API key.

- Request: `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
- Success shape (only fields we use):

```json
{
  "status": 1,
  "product": {
    "product_name": "Greek Yogurt",
    "image_front_small_url": "https://images.openfoodfacts.org/..."
  }
}
```

- Not found: `status` is `0` → fall back to manual name entry.
- **Handle gracefully:** no network, timeout, missing `product_name`, missing image. Never block the user — if lookup fails, let them type the name. Always persist the scanned `barcode` so repeat scans can be cached locally later.
- All calls go through `src/lib/openFoodFacts.ts`. Render the product image with `expo-image` (already installed).

---

## 7. Notifications

- Local only (**`expo-notifications`**), scheduled on-device. No server.
- One daily check; if any item is within the lead time, fire a summary: "3 items expiring in the next 2 days."
- Respect the Settings toggle and lead-time value. Request OS notification permission at a sensible moment (after the first item is added, not on first launch).
- Target API to use (confirm against installed types): `setNotificationHandler` at startup, `requestPermissionsAsync` at the permission moment, and a **daily calendar trigger** for the summary check. All logic lives in `src/lib/notifications.ts`.
- **Testing caveat:** camera and local notifications are **not fully exercisable in Expo Go** (notification support is limited there). Use a **development build / EAS Build** to test on a real device. The repo already has an EAS `projectId` in `app.json`, so an EAS dev build is ready to configure (see Section 11).

---

## 8. Tech stack & conventions (Windows + iPhone friendly)

- **Framework:** React Native + **Expo SDK 56** (one codebase → iOS + Android). No Mac needed. (Web is not a v1 target — see §1.)
- **iOS builds:** **EAS Build** (Expo cloud) compiles the iOS binary; install on your iPhone to test. `app.json` already carries the EAS `projectId`.
- **Navigation:** **expo-router** with the new **`NativeTabs`** (`expo-router/unstable-native-tabs`), already wired in `src/components/app-tabs.tsx`. (`@react-navigation/*` is no longer a dependency.) `NativeTabs` is an `unstable-` API — confirm its surface against installed types before extending it.
- **Scanning:** **`expo-camera`** (`CameraView` + `useCameraPermissions` + barcode-scanning props such as `onBarcodeScanned` / `barcodeScannerSettings` — confirm exact names against SDK 56 types). **Do not use `expo-barcode-scanner`** — it is removed in modern SDKs.
- **Storage:** **`expo-sqlite`** (see Section 5).
- **Notifications:** **`expo-notifications`** (see Section 7).
- **Language:** TypeScript (strict), with `typedRoutes` and `reactCompiler` experiments enabled in `app.json`.
- **Path alias:** `@/` maps to `src/` — use it in imports (e.g. `@/lib/db`, `@/constants/theme`).

**Actual folder structure (rooted at `src/`):**

```plaintext
src/
  app/                 # expo-router routes
    _layout.tsx        # ThemeProvider + AppTabs (+ SQLiteProvider; see note)
    index.tsx          # Home / My Pantry  (tab)
    settings.tsx       # Settings          (tab; replaces template's explore.tsx)
    scan.tsx           # Scan              (non-tab route)
    item/[id].tsx      # Item detail / edit (non-tab dynamic route)
  components/          # reusable UI (ItemRow, StatusDot, ScanButton, app-tabs.tsx ...)
  lib/                 # db.ts (storage), openFoodFacts.ts (API), notifications.ts
  types/               # item.ts (Item, Location)
  constants/           # theme.ts — colors, expiry thresholds (Section 5.1)
  hooks/               # existing template hooks
  global.css           # CSS styling entry
```

**Packages to add** (none installed yet) — install with `npx expo install` so versions pin to SDK 56:
`expo-camera`, `expo-sqlite`, `expo-notifications`, `expo-crypto`.
Already present and reused: `expo-image`, `expo-device`. Also available but **optional** (v1 stays minimalist): `@expo/ui`, `expo-glass-effect`.

**Navigation note (open architectural item):** `src/app/_layout.tsx` currently renders `NativeTabs` directly with no root `Stack`. Presenting non-tab routes (`scan`, `item/[id]`) under `NativeTabs` needs SDK 56 verification — the likely pattern is a root `Stack` in `_layout.tsx` with the tabs as one screen and `scan` / `item/[id]` as additional (modal) stack screens. Confirm the supported composition before implementing.

**Template cleanup:** the starter's demo files (`animated-icon`, `hint-row`, `web-badge`, `external-link`, `collapsible`, the welcome content in `index.tsx`/`explore.tsx`) are removed or replaced during implementation.

- **Conventions for the AI:** keep functions small and pure where possible; all data access goes through `src/lib/db.ts`; all API calls through `src/lib/openFoodFacts.ts`; no business logic inside screen components.
- **Run cost:** ~$0 — everything on-device.

---

## 9. App Store Optimization (ASO) — do this BEFORE you name the app

> ASO is SEO for apps. For an indie with no marketing budget, this is how ~98% of downloads happen. Source: indie devs like Sebastian (HabitKit) who reached the top of the store almost entirely through ASO. The actions below are the highest-impact, lowest-effort wins.

> **Status:** the app name already follows this guidance — `app.json` sets the name to **"Pantry Tracker — Stockpile"** (primary keyword + brand) and slug `pantry-tracker-stockpile`. What remains: validate the primary keyword with an ASO tool, write the subtitle, fill the keyword field, and produce screenshots.

### 9.1 Keyword research (do this first, before naming)

1. **Brainstorm** the keyword landscape with an LLM: what do people actually type to find an app like this? Seed list for this app: `pantry tracker`, `food expiry tracker`, `expiration date tracker`, `fridge inventory`, `grocery tracker`, `food inventory`, `kitchen inventory`, `food waste`, `pantry inventory`.
2. **Validate** real search demand with an ASO tool (e.g. Astro, AppFigures) — they show **popularity** (how often it's searched) and **difficulty** (competition).
3. **Pick a primary keyword:** aim for high popularity with manageable difficulty — but if forced to choose, _compete for a valuable hard keyword rather than dominate an easy low-volume one._ Likely primary candidates here: **"pantry tracker"** or **"food expiry tracker."**

### 9.2 Naming (the #1 ASO factor)

- **App name = primary keyword + brand.** Put the keyword first. Indies can't afford to bury it.
  - Example pattern (HabitKit is literally listed as "Habit Tracker - HabitKit"): consider **"Pantry Tracker — [Brand]"** or **"Food Expiry Tracker — [Brand]"**. (Applied: "Pantry Tracker — Stockpile".)
- **Subtitle (30 chars):** use it for _secondary_ keywords. Example: "Fridge & grocery inventory."
- **Do not repeat keywords** between name and subtitle — Apple indexes them as one combined string, so repetition wastes space.

### 9.3 The keyword field (App Store Connect, 100 chars, hidden from users)

Apple indexes this for search. Rules:

- Separate with **commas, no spaces**.
- **Don't repeat** any word already in the name or subtitle.
- **Don't use plurals** if you already used the singular.
- **No competitor app names** (Apple may reject).
- **Use all 100 characters.**
- Draft example: `expiration,date,fridge,freezer,grocery,kitchen,food,waste,inventory,scan,barcode,reminder,shelf,life`

### 9.4 Screenshots (drive conversion rate)

- You have **3–5 seconds** to convince someone. Screenshots matter most for conversion.
- **First screenshot = your best, most visual feature.** For this app that's the color-coded expiry list (green/amber/red) — unique and instantly understandable. Never lead with a generic welcome/onboarding screen.
- **Show real UI**, not abstract lifestyle graphics. People want to see what they're actually getting.
- **A/B test** with Apple's Product Page Optimization. Lesson from the field: fancier isn't always better — authentic, simpler screenshots sometimes convert higher. Always test, don't assume.

### 9.5 Reviews & ratings (rankings + conversion + product insight)

- Ratings feed both Apple/Google's ranking algorithms **and** conversion. Even a top-ranked app with bad reviews won't convert.
- **Prompt at a happy moment:** here, right after the user **saves their first item** (or marks one as used before it expired) — not during onboarding, never on an error.
- **Don't nag.** If dismissed, wait a long time before asking again.
- **Reply to every review** — thank the good, help on the bad. People often upgrade a 1-star to 5-star after you fix their issue.
- **Support email signature trick:** end help replies with a gentle "If you're enjoying the app, I'd be grateful for a review." Asking right after you've helped someone converts well.
- **Mine reviews for the roadmap:** if many users request the same feature, that's a strong prioritization signal.

### 9.6 Mindset: ASO is a marathon

Expect to be invisible at launch even if you do everything right. Realistic timeline from a real indie: ~6 months to crack top 10 in smaller markets (UK/Germany), ~1 year to occasionally hit US top 10, ~3 years to sit consistently in the US top 5. Keep shipping updates and collecting reviews. The work you do today pays off months later.

---

## 10. Free vs Pro (add Pro _after_ the free app is live)

**Free forever:** unlimited items, scanning, expiry alerts, one device. Generous on purpose — drives downloads + reviews (which drive ASO).

**Pro (~$2.99/mo or ~$15/yr), later:** cloud sync + multi-device, shared household pantry, CSV export + auto shopping list from low/empty items, custom categories & themes. Cloud sync is the feature that justifies a subscription because it's the one thing that genuinely needs a backend.

Ship v1 **100% free** to learn the publishing pipeline and gather reviews. Add Pro in v2.

---

## 11. Build order (suggested 4–6 week solo plan)

> **Prerequisite:** the SDK 56 code lives on `main`. Make sure your working branch is based on (or has merged) the SDK 56 `main` before writing app code — the spec's `src/` layout assumes it.

1. **Week 1** — Confirm SDK 56 base; Home screen with hardcoded items; the two tabs (Home, Settings) plus `scan` / `item/[id]` routes navigable.
2. **Week 2** — `expo-sqlite` via `src/lib/db.ts`: add/edit/delete real items that persist.
3. **Week 3** — `expo-camera` scanning + Open Food Facts lookup wired into Scan.
4. **Week 4** — Expiry sorting, status dots (Section 5.1), local notifications, Settings.
5. **Week 5** — Polish: empty states, icon, splash screen; finalize subtitle/keyword field/screenshots (Section 9); make an **EAS development build** and test camera + notifications on your iPhone.
6. **Week 6** — Store assets (screenshots per 9.4, description), submit. Finally, build a simple **marketing/landing page** (a static site — not the app in a browser): app name, the color-coded list screenshot, store links.

---

## 12. Publishing checklist

- **Apple:** Apple Developer Program, **$99/yr**, enroll as an **individual** (no D-U-N-S). No tester rule.
- **Google Play:** **$25 one-time**. Personal accounts must pass the 12-testers / 14-day closed test; an **organization** account (via your registered preduzetnik) is exempt.
- **Serbia:** register as **preduzetnik on the paušal regime** so you can legally receive Apple/Google payouts; ask a knjigovođa to set the right activity code.

---

## 13. Definition of done for v1

Open the app → scan a yogurt → set it to expire in 2 days → see it in the list with an amber dot (Section 5.1) → close the app → reopen tomorrow and it's still there → get a notification before it expires. If that loop works end-to-end _and_ the store listing follows Section 9, ship it.
