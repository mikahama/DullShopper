/**
 * DullShopper - Web Shop Detector Engine
 * Multi-layer heuristic analyzer that evaluates structured data,
 * platform footprints, interactive shopping buttons, and DOM semantics.
 */

const DullShopperDetector = (() => {
  const SHOP_THRESHOLD = 35;

  // Multilingual regex for "Add to Cart", "Buy Now", "Checkout"
  const BUY_BUTTON_REGEX = /\b(add to cart|add to bag|add to basket|buy now|buy it now|proceed to checkout|place order|order now|checkout now|in den warenkorb|in den einkaufswagen|jetzt kaufen|zur kasse|ajouter au panier|passer la commande|acheter maintenant|commander|añadir al carrito|añadir a la cesta|comprar ahora|comprar ya|aggiungi al carrello|acquista ora|concludi ordine|lisää ostoskoriin|siirry kassalle|osta nyt|lägg i varukorg|till kassan|köp nu|in winkelwagen|bestel nu)\b/i;

  const CART_CONTAINER_REGEX = /(mini[-_]?cart|cart[-_]?drawer|cart[-_]?count|cart[-_]?total|shopping[-_]?cart|header[-_]?cart|cart[-_]?dropdown|basket[-_]?preview)/i;

  const PRICE_CLASS_REGEX = /(product[-_]?price|current[-_]?price|offer[-_]?price|sale[-_]?price|regular[-_]?price|price[-_]?box)/i;
  const CURRENCY_REGEX = /([$€£¥₹₽₩₪₫]|USD|EUR|GBP|CAD|AUD|SEK|NOK|DKK|PLN|JPY|CHF)\s*[\d,.]+|[\d,.]+\s*([$€£¥₹₽₩₪₫]|USD|EUR|GBP|CAD|AUD|SEK|NOK|DKK|PLN|JPY|CHF)/i;

  /**
   * Check Schema.org JSON-LD scripts and Microdata for product/offer signals
   */
  function checkStructuredData() {
    let score = 0;
    const reasons = [];

    // 1. JSON-LD scripts
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        if (!script.textContent) continue;
        try {
          const data = JSON.parse(script.textContent);
          const items = Array.isArray(data) ? data : (data['@graph'] || [data]);

          for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const type = item['@type'];
            const typeStr = Array.isArray(type) ? type.join(' ') : String(type || '');

            if (/Product|IndividualProduct|ProductGroup|ProductModel|SomeProducts/i.test(typeStr)) {
              score += 45;
              reasons.push('Schema.org Product structured data');
              break;
            } else if (/Offer|AggregateOffer/i.test(typeStr)) {
              score += 40;
              reasons.push('Schema.org Offer structured data');
              break;
            } else if (/OnlineStore|Store|CheckoutPage|ShoppingCart/i.test(typeStr)) {
              score += 40;
              reasons.push('Schema.org Store/Checkout structured data');
              break;
            }
          }
          if (score >= 40) break;
        } catch {
          // Ignore invalid JSON in page scripts
        }
      }
    } catch (e) {
      console.debug('DullSopper: JSON-LD parse error', e);
    }

    // 2. Microdata attributes
    try {
      if (score === 0) {
        if (document.querySelector('[itemtype*="schema.org/Product"]')) {
          score += 45;
          reasons.push('Microdata Product definition');
        } else if (document.querySelector('[itemtype*="schema.org/Offer"]')) {
          score += 40;
          reasons.push('Microdata Offer definition');
        } else if (document.querySelector('[itemprop="price"]') || document.querySelector('[itemprop="priceCurrency"]')) {
          score += 25;
          reasons.push('Microdata price attributes');
        }
      }
    } catch {
      // Ignore query errors
    }

    return { score, reasons };
  }

  /**
   * Check Meta Tags and OpenGraph tags
   */
  function checkMetaTags() {
    let score = 0;
    const reasons = [];

    // OpenGraph product
    const ogType = document.querySelector('meta[property="og:type"], meta[name="og:type"]');
    if (ogType && /product(\.item|\.group)?/i.test(ogType.getAttribute('content') || '')) {
      score += 35;
      reasons.push('OpenGraph product meta tag');
    }

    // Product price meta tags
    const priceMeta = document.querySelector('meta[property*="price:amount"], meta[name*="price:amount"], meta[name="product:price"]');
    if (priceMeta) {
      score += 25;
      reasons.push('Product price meta tag');
    }

    // Generator meta tag (CMS / Platform)
    const generator = document.querySelector('meta[name="generator"]');
    if (generator) {
      const content = (generator.getAttribute('content') || '').toLowerCase();
      if (/shopify|woocommerce|magento|prestashop|bigcommerce|opencart|nopcommerce/i.test(content)) {
        score += 45;
        reasons.push(`E-commerce generator tag (${content})`);
      }
    }

    return { score, reasons };
  }

  /**
   * Check Platform Signatures (Shopify, WooCommerce, Magento, BigCommerce, etc.)
   */
  function checkPlatformSignatures() {
    let score = 0;
    const reasons = [];

    // Shopify detection
    if (
      (typeof window !== 'undefined' && (window.Shopify || window.ShopifyPay)) ||
      document.querySelector('script[src*="cdn.shopify.com"]') ||
      document.querySelector('link[href*="cdn.shopify.com"]') ||
      document.querySelector('link[href*="/collections/"]')
    ) {
      score += 45;
      reasons.push('Shopify e-commerce platform');
    }

    // WooCommerce detection
    if (
      document.body && (
        document.body.classList.contains('woocommerce') ||
        document.body.classList.contains('woocommerce-page')
      ) ||
      document.querySelector('.woocommerce') ||
      document.querySelector('link[href*="woocommerce"]') ||
      document.querySelector('script[src*="woocommerce"]')
    ) {
      score += 45;
      reasons.push('WooCommerce platform');
    }

    // Magento detection
    if (
      document.querySelector('script[type="text/x-magento-init"]') ||
      document.querySelector('script[src*="/mage/"]') ||
      (document.body && document.body.className.includes('catalog-product-view'))
    ) {
      score += 45;
      reasons.push('Magento platform');
    }

    // BigCommerce detection
    if (
      (typeof window !== 'undefined' && window.BCData) ||
      document.querySelector('script[src*="cdn.bigcommerce.com"]')
    ) {
      score += 45;
      reasons.push('BigCommerce platform');
    }

    // Webflow Ecommerce or Squarespace Commerce
    if (
      document.querySelector('.w-commerce-commerceaddtocartbutton') ||
      document.querySelector('.sqs-money-native') ||
      document.querySelector('.sqs-add-to-cart-button')
    ) {
      score += 40;
      reasons.push('Storefront checkout widget');
    }

    return { score, reasons };
  }

  /**
   * Check Interactive Buttons and Forms ("Add to Cart", "Checkout")
   */
  function checkInteractiveElements() {
    let score = 0;
    const reasons = [];

    // Buy/Cart buttons
    const candidates = document.querySelectorAll(
      'button, input[type="submit"], input[type="button"], [role="button"], a.btn, a.button, a[class*="cart"], a[class*="buy"]'
    );

    let foundBuyBtn = false;
    for (let i = 0; i < Math.min(candidates.length, 100); i++) {
      const el = candidates[i];
      const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim();
      if (text && BUY_BUTTON_REGEX.test(text)) {
        foundBuyBtn = true;
        break;
      }
    }

    if (foundBuyBtn) {
      score += 30;
      reasons.push('"Add to Cart" or "Buy Now" button');
    }

    // Cart forms
    const cartForm = document.querySelector('form[action*="/cart" i], form[action*="/checkout" i], form[action*="add-to-cart" i]');
    if (cartForm) {
      score += 25;
      reasons.push('Shopping cart form action');
    }

    // Form inputs named add-to-cart
    if (document.querySelector('input[name="add-to-cart"], button[name="add-to-cart"]')) {
      score += 25;
      reasons.push('Add-to-cart form input');
    }

    return { score, reasons };
  }

  /**
   * Check Shopping Cart widgets and Price markers
   */
  function checkCartAndPricingElements() {
    let score = 0;
    const reasons = [];

    // Cart containers / badges
    const elementsWithIdOrClass = document.querySelectorAll(
      '[id*="cart" i], [class*="cart" i], [id*="basket" i], [class*="basket" i]'
    );

    let foundCartContainer = false;
    for (let i = 0; i < Math.min(elementsWithIdOrClass.length, 30); i++) {
      const el = elementsWithIdOrClass[i];
      const idClass = `${el.id} ${el.className}`;
      if (CART_CONTAINER_REGEX.test(idClass)) {
        foundCartContainer = true;
        break;
      }
    }

    if (foundCartContainer) {
      score += 15;
      reasons.push('Shopping cart container or badge');
    }

    // Price elements with currency symbols
    const priceCandidates = document.querySelectorAll('[class*="price" i], [id*="price" i]');
    let foundPrice = false;
    for (let i = 0; i < Math.min(priceCandidates.length, 25); i++) {
      const el = priceCandidates[i];
      const cls = el.className || '';
      if (PRICE_CLASS_REGEX.test(cls)) {
        const text = (el.textContent || '').trim();
        if (CURRENCY_REGEX.test(text)) {
          foundPrice = true;
          break;
        }
      }
    }

    if (foundPrice) {
      score += 15;
      reasons.push('Product price formatted with currency');
    }

    return { score, reasons };
  }

  /**
   * Check URL Path signals
   */
  function checkUrlSignals() {
    let score = 0;
    const reasons = [];
    const path = window.location.pathname.toLowerCase();

    if (/\/(products?|items?|shop|store|cart|checkout|collections?|catalog)\b/i.test(path)) {
      score += 10;
      reasons.push('E-commerce URL path pattern');
    }

    return { score, reasons };
  }

  /**
   * Run full heuristic detection on the current page.
   * Returns: { isShop: boolean, score: number, reasons: string[] }
   */
  function analyzePage() {
    let totalScore = 0;
    const allReasons = [];

    const checks = [
      checkStructuredData(),
      checkPlatformSignatures(),
      checkMetaTags(),
      checkInteractiveElements(),
      checkCartAndPricingElements(),
      checkUrlSignals()
    ];

    for (const res of checks) {
      totalScore += res.score;
      for (const reason of res.reasons) {
        if (!allReasons.includes(reason)) {
          allReasons.push(reason);
        }
      }
    }

    const isShop = totalScore >= SHOP_THRESHOLD;

    return {
      isShop,
      score: totalScore,
      threshold: SHOP_THRESHOLD,
      reasons: allReasons
    };
  }

  return {
    analyzePage,
    BUY_BUTTON_REGEX,
    SHOP_THRESHOLD
  };
})();

const DullSopperDetector = DullShopperDetector;

if (typeof globalThis !== 'undefined') {
  globalThis.DullShopperDetector = DullShopperDetector;
  globalThis.DullSopperDetector = DullShopperDetector;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DullShopperDetector;
}
