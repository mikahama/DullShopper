/**
 * DullSopper - Unit & Integration Tests
 * Runs with Node.js test runner: node --test test/test_suite.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const constants = require('../shared/constants.js');
const { POPULAR_SHOP_DOMAINS, isPopularShop } = require('../shared/popular-shops.js');
const DullSopperStorage = require('../shared/storage.js');
const DullSopperDetector = require('../content/detector.js');

describe('Domain Cleaning & Matching', () => {
  test('cleanDomain strips protocol, path, port, and www', () => {
    assert.equal(DullSopperStorage.cleanDomain('https://www.amazon.com/dp/B08N5WRWNW'), 'amazon.com');
    assert.equal(DullSopperStorage.cleanDomain('http://store.steampowered.com/app/10/'), 'store.steampowered.com');
    assert.equal(DullSopperStorage.cleanDomain('http://www.sub.example.co.uk:8080/path?q=1#hash'), 'sub.example.co.uk');
    assert.equal(DullSopperStorage.cleanDomain('www.shopify.com'), 'shopify.com');
    assert.equal(DullSopperStorage.cleanDomain('   EBAY.DE/itm/123   '), 'ebay.de');
  });

  test('domainMatches handles exact and subdomains', () => {
    assert.equal(DullSopperStorage.domainMatches('nike.com', 'nike.com'), true);
    assert.equal(DullSopperStorage.domainMatches('store.nike.com', 'nike.com'), true);
    assert.equal(DullSopperStorage.domainMatches('www.nike.com', 'nike.com'), true);
    assert.equal(DullSopperStorage.domainMatches('notnike.com', 'nike.com'), false);
    assert.equal(DullSopperStorage.domainMatches('nike.com.other.com', 'nike.com'), false);
  });

  test('isDomainInList matches rules in array', () => {
    const list = ['amazon.com', 'asos.com', '*.target.com'];
    assert.equal(DullSopperStorage.isDomainInList('amazon.com', list), true);
    assert.equal(DullSopperStorage.isDomainInList('smile.amazon.com', list), true);
    assert.equal(DullSopperStorage.isDomainInList('shop.target.com', list), true);
    assert.equal(DullSopperStorage.isDomainInList('wikipedia.org', list), false);
  });

  test('isPopularShop matches major retail stores', () => {
    assert.equal(isPopularShop('amazon.com'), true);
    assert.equal(isPopularShop('www.amazon.co.uk'), true);
    assert.equal(isPopularShop('smile.amazon.com'), true);
    assert.equal(isPopularShop('ebay.de'), true);
    assert.equal(isPopularShop('aliexpress.com'), true);
    assert.equal(isPopularShop('etsy.com'), true);
    assert.equal(isPopularShop('zalando.de'), true);
    assert.equal(isPopularShop('github.com'), false);
    assert.equal(isPopularShop('wikipedia.org'), false);
  });
});

describe('Web Shop Detector Heuristics', () => {
  test('Buy Button Regex detects multilingual action phrases', () => {
    const regex = DullSopperDetector.BUY_BUTTON_REGEX;

    // English
    assert.equal(regex.test('Add to Cart'), true);
    assert.equal(regex.test('Add to Bag'), true);
    assert.equal(regex.test('Add to Basket'), true);
    assert.equal(regex.test('Buy Now'), true);
    assert.equal(regex.test('Proceed to Checkout'), true);
    assert.equal(regex.test('Place Order'), true);

    // Multilingual
    assert.equal(regex.test('In den Warenkorb'), true); // German
    assert.equal(regex.test('Jetzt kaufen'), true);     // German
    assert.equal(regex.test('Ajouter au panier'), true); // French
    assert.equal(regex.test('Añadir a la cesta'), true); // Spanish
    assert.equal(regex.test('Aggiungi al carrello'), true); // Italian
    assert.equal(regex.test('Lisää ostoskoriin'), true); // Finnish
    assert.equal(regex.test('Siirry kassalle'), true);   // Finnish
    assert.equal(regex.test('Lägg i varukorg'), true);   // Swedish
    assert.equal(regex.test('In winkelwagen'), true);    // Dutch

    // Negative matches (should not match regular prose)
    assert.equal(regex.test('Read article'), false);
    assert.equal(regex.test('Download PDF'), false);
    assert.equal(regex.test('Submit comment'), false);
    assert.equal(regex.test('Sign in to account'), false);
  });
});

describe('Site Status Evaluation Logic', () => {
  test('Evaluation correctly prioritizes Whitelist over auto-detection', async () => {
    // If a site is whitelisted, even if it is Amazon or a detected shop, isDulled must be false
    const context = {
      settings: {
        enabled: true,
        autoDetect: true,
        includePreloadedShops: true,
        grayscaleIntensity: 100
      },
      blocklist: [],
      whitelist: ['amazon.com'],
      detectedShops: {}
    };

    const res = await DullSopperStorage.evaluateSite('amazon.com', true, ['Add to Cart button'], context);
    assert.equal(res.isDulled, false);
    assert.equal(res.status, constants.STATUS.WHITELISTED);
  });

  test('Evaluation correctly prioritizes Blocklist over normal status', async () => {
    const context = {
      settings: {
        enabled: true,
        autoDetect: true,
        includePreloadedShops: true,
        grayscaleIntensity: 100
      },
      blocklist: ['example-blog.org'],
      whitelist: [],
      detectedShops: {}
    };

    const res = await DullSopperStorage.evaluateSite('example-blog.org', false, [], context);
    assert.equal(res.isDulled, true);
    assert.equal(res.status, constants.STATUS.DULLED_BLOCKED);
  });

  test('Evaluation turns off all dulling when master switch is disabled', async () => {
    const context = {
      settings: {
        enabled: false, // Disabled!
        autoDetect: true,
        includePreloadedShops: true,
        grayscaleIntensity: 100
      },
      blocklist: ['shop.com'],
      whitelist: [],
      detectedShops: { 'shop.com': { reasons: ['Shopify'] } }
    };

    const res = await DullSopperStorage.evaluateSite('shop.com', true, ['Shopify'], context);
    assert.equal(res.isDulled, false);
    assert.equal(res.status, constants.STATUS.NORMAL);
  });

  test('Evaluation detects preloaded popular retailer', async () => {
    const context = {
      settings: {
        enabled: true,
        autoDetect: true,
        includePreloadedShops: true,
        grayscaleIntensity: 100
      },
      blocklist: [],
      whitelist: [],
      detectedShops: {}
    };

    const res = await DullSopperStorage.evaluateSite('aliexpress.com', false, [], context);
    assert.equal(res.isDulled, true);
    assert.equal(res.status, constants.STATUS.DULLED_PRELOADED);
  });

  test('Evaluation flags auto-detected shop', async () => {
    const context = {
      settings: {
        enabled: true,
        autoDetect: true,
        includePreloadedShops: true,
        grayscaleIntensity: 100
      },
      blocklist: [],
      whitelist: [],
      detectedShops: {}
    };

    const res = await DullSopperStorage.evaluateSite('boutique-store.net', true, ['Schema.org Product', 'Add to Cart button'], context);
    assert.equal(res.isDulled, true);
    assert.equal(res.status, constants.STATUS.DULLED_DETECTED);
    assert.deepEqual(res.reasons, ['Schema.org Product', 'Add to Cart button']);
  });

  test('Evaluation leaves normal site untouched', async () => {
    const context = {
      settings: {
        enabled: true,
        autoDetect: true,
        includePreloadedShops: true,
        grayscaleIntensity: 100
      },
      blocklist: [],
      whitelist: [],
      detectedShops: {}
    };

    const res = await DullSopperStorage.evaluateSite('wikipedia.org', false, [], context);
    assert.equal(res.isDulled, false);
    assert.equal(res.status, constants.STATUS.NORMAL);
  });
});
