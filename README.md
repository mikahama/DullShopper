# DullSopper 😴🛍️

> **Tame your shopping impulses by turning web shops into dull, unappealing grayscale.**

**DullSopper** is a lightweight Firefox extension (Manifest V3) that automatically detects online shops and e-commerce stores, instantly stripping away their vibrant, dopamine-inducing colors and rendering them in flat, drab grayscale.

Research in consumer psychology shows that vibrant colors and polished product photography stimulate emotional impulses and urgency. DullSopper neutralizes this effect, helping you slow down, think rationally, and curb impulse spending.

---

## ✨ Features

- 🧠 **Automatic Web Shop Detection**:
  - **Schema.org Structured Data**: Recognizes `Product`, `Offer`, `AggregateOffer`, `Store`, and `ShoppingCart` microdata and JSON-LD.
  - **Platform Signatures**: Identifies Shopify, WooCommerce, Magento, BigCommerce, PrestaShop, Squarespace Commerce, etc.
  - **Interactive Buy Triggers**: Detects multilingual "Add to Cart", "Buy Now", and "Proceed to Checkout" actions (English, German, French, Spanish, Finnish, Swedish, Dutch, etc.).
  - **Preloaded Major Retailers**: Instant zero-delay grayscale for global platforms (Amazon, eBay, AliExpress, Walmart, Target, Etsy, Shein, Temu, ASOS, Zara, etc.).
- 🩶 **Clean, Fast Grayscale Filtering**:
  - Injected via high-performance CSS filter variables with zero layout disruption.
  - Zero-flash startup: known shops and blocked domains are dulled immediately before DOM rendering completes.
- 🔒 **Custom Dull List (Blocklist)**:
  - Add any domain to always be grayscale, even if it's not an e-commerce store.
  - Quick-add domains directly from the popup or the Options page.
- 🌈 **Per-Site Enable / Disable (Whitelist)**:
  - Easily toggle the extension off for specific websites (e.g. essential groceries or photo-review sites).
  - 1-click "Allow on this site (Restore color)" directly in the popup or in-page banner.
- ⚙️ **Comprehensive Settings & Options**:
  - **Grayscale Dullness Slider**: Choose from 10% to 100% black-and-white.
  - **Extra Drab Mode**: Optional 10% contrast reduction to flatten shiny hero images.
  - **Dim Images**: Optional brightness reduction for less visual pop.
  - **Detected Shops History**: View all automatically discovered stores with exact detection signals, with options to allow or delete.
  - **Import & Export**: Backup and restore domain lists and preferences as JSON.
- 🔒 **100% Local & Private**:
  - Zero analytics, zero tracking, zero external network requests. Everything runs locally in your browser.

---

## 🚀 Installation into Firefox

### Option A: Load Temporarily in Firefox (Quickest)
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on..."**.
3. Select the `manifest.json` file inside the `DullSopper` directory (or the `.zip` in `web-ext-artifacts/`).
4. The DullSopper icon will appear in your Firefox toolbar!

### Option B: Run via `web-ext`
```bash
npm start
```
This automatically launches a clean Firefox profile with DullSopper preloaded.

---

## 🛠️ Usage

### Extension Popup
Click the DullSopper icon in the toolbar on any webpage:
- **Site Status**: Shows whether the site is **Dulled (Shop Detected)**, **Dulled (Blocklist)**, **Allowed (Whitelisted)**, or **Normal**.
- **Detection Reasons**: Click to expand and see why a site was classified as a store (e.g., *Shopify platform*, *Schema.org Product*, *Add to Cart button*).
- **1-Click Action**:
  - If a site is dulled: Click **"Allow on this site (Restore color)"** to whitelist it.
  - If a site is normal: Click **"Dull this site (Add to Dull List)"** to blocklist it.
- **Grayscale Slider**: Adjust dullness in real time.
- **Quick Add**: Type any domain to immediately add it to your Dull List.

### Options Page
Right-click the DullSopper toolbar icon and select **Manage Extension** > **Options** (or click **⚙️ Settings & Lists** in the popup):
- **Domain Lists**: View, filter, and delete domains in your Dull List (Blocklist) and Allowed List (Whitelist).
- **Detected Shops**: See history of all shops detected during your browsing sessions.
- **Detection & Filter Settings**: Configure sensitivity, contrast reduction, brightness dimming, and toolbar badges.
- **Backup & Restore**: Export your customized rules to a JSON file or import existing settings.

---

## 🧪 Testing & Validation

The extension includes automated unit and DOM fixture tests:

```bash
# Run unit tests and DOM fixture tests
npm test

# Lint with Mozilla's official web-ext linter
npm run lint

# Build production zip package
npm run build
```

---

## 📁 File Structure

```
DullSopper/
├── manifest.json            # Firefox Manifest V3 definition
├── package.json             # NPM package scripts & dependencies
├── README.md                # Documentation
├── background/
│   └── background.js        # Background worker (tab badges, state sync)
├── content/
│   ├── detector.js          # Heuristic e-commerce detection engine
│   ├── content.js           # Content coordinator & style injection
│   └── dullsopper.css       # Grayscale filter and notification styling
├── popup/
│   ├── popup.html           # Browser toolbar popup interface
│   ├── popup.css            # Dark mode styling for popup
│   └── popup.js             # Popup controller & real-time updates
├── options/
│   ├── options.html         # Settings, list management, and history
│   ├── options.css          # Options page design
│   └── options.js           # Settings controller & JSON import/export
├── shared/
│   ├── constants.js         # Shared status enums and message channels
│   ├── popular-shops.js     # Curated database of major online retailers
│   └── storage.js           # Unified storage and domain evaluation
├── icons/                   # Extension icons (16, 32, 48, 128 px)
└── test/
    ├── test_suite.js        # Unit tests for domain extraction & evaluation
    └── test_detector_dom.js # DOM fixture tests for detection engine
```

---

## 📜 License

MIT License. Designed to promote mindful shopping and financial wellness.
