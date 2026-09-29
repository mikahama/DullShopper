/**
 * DullSopper - Detector DOM Fixture Tests
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Minimal DOM mock environment for testing heuristic detection
function createMockDOM(fixture) {
  const elements = {
    scripts: fixture.scripts || [],
    metas: fixture.metas || [],
    buttons: fixture.buttons || [],
    links: fixture.links || [],
    forms: fixture.forms || [],
    generic: fixture.generic || [],
    bodyClass: fixture.bodyClass || ''
  };

  const doc = {
    body: {
      className: elements.bodyClass,
      classList: {
        contains: (cls) => elements.bodyClass.split(/\s+/).includes(cls)
      }
    },
    querySelectorAll: (selector) => {
      if (selector.includes('application/ld+json')) {
        return elements.scripts.filter(s => s.type === 'application/ld+json');
      }
      if (selector.startsWith('button, input[type="submit"]')) {
        return elements.buttons;
      }
      if (selector.includes('id*="cart"') || selector.includes('class*="cart"')) {
        return elements.generic.filter(el => /cart|basket/i.test(`${el.id || ''} ${el.className || ''}`));
      }
      if (selector.includes('class*="price"') || selector.includes('id*="price"')) {
        return elements.generic.filter(el => /price/i.test(`${el.className || ''} ${el.id || ''}`));
      }
      return [];
    },
    querySelector: (selector) => {
      if (selector.includes('og:type')) {
        return elements.metas.find(m => m.property === 'og:type' || m.name === 'og:type') || null;
      }
      if (selector.includes('price:amount') || selector.includes('product:price')) {
        return elements.metas.find(m => (m.property || '').includes('price') || (m.name || '').includes('price')) || null;
      }
      if (selector.includes('meta[name="generator"]')) {
        return elements.metas.find(m => m.name === 'generator') || null;
      }
      if (selector.includes('script[src*="cdn.shopify.com"]')) {
        return elements.scripts.find(s => (s.src || '').includes('cdn.shopify.com')) || null;
      }
      if (selector.includes('itemtype*="schema.org/Product"')) {
        return elements.generic.find(el => (el.itemtype || '').includes('schema.org/Product')) || null;
      }
      if (selector.includes('.woocommerce')) {
        return elements.generic.find(el => (el.className || '').includes('woocommerce')) || null;
      }
      if (selector.includes('form[action*="/cart"')) {
        return elements.forms.find(f => (f.action || '').includes('/cart')) || null;
      }
      return null;
    }
  };

  const win = {
    location: {
      pathname: fixture.pathname || '/'
    }
  };

  if (fixture.shopify) {
    win.Shopify = { shop: 'example-store.myshopify.com' };
  }

  return { doc, win };
}

describe('Detector Heuristic Fixtures', () => {
  const DullSopperDetector = require('../content/detector.js');

  test('Shopify store fixture triggers detection', () => {
    const { doc, win } = createMockDOM({
      pathname: '/products/cotton-t-shirt',
      shopify: true,
      scripts: [
        { type: 'text/javascript', src: 'https://cdn.shopify.com/s/files/theme.js' }
      ],
      buttons: [
        { textContent: 'Add to Cart', getAttribute: () => null }
      ],
      generic: [
        { className: 'product-price', textContent: '$29.99' }
      ]
    });

    global.document = doc;
    global.window = win;

    const result = DullSopperDetector.analyzePage();
    assert.equal(result.isShop, true);
    assert.ok(result.score >= DullSopperDetector.SHOP_THRESHOLD);
    assert.ok(result.reasons.some(r => r.includes('Shopify')));
    assert.ok(result.reasons.some(r => r.includes('Add to Cart')));
  });

  test('JSON-LD Schema Product fixture triggers detection', () => {
    const { doc, win } = createMockDOM({
      pathname: '/items/headphones-wireless',
      scripts: [
        {
          type: 'application/ld+json',
          textContent: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            'name': 'Wireless Noise Canceling Headphones',
            'offers': {
              '@type': 'Offer',
              'price': '199.99',
              'priceCurrency': 'USD'
            }
          })
        }
      ],
      buttons: [
        { textContent: 'Buy Now', getAttribute: () => null }
      ]
    });

    global.document = doc;
    global.window = win;

    const result = DullSopperDetector.analyzePage();
    assert.equal(result.isShop, true);
    assert.ok(result.reasons.some(r => r.includes('Schema.org Product')));
  });

  test('WooCommerce store fixture triggers detection', () => {
    const { doc, win } = createMockDOM({
      pathname: '/checkout/',
      bodyClass: 'woocommerce woocommerce-page',
      buttons: [
        { textContent: 'Proceed to Checkout', getAttribute: () => null }
      ],
      forms: [
        { action: '/cart?action=update' }
      ]
    });

    global.document = doc;
    global.window = win;

    const result = DullSopperDetector.analyzePage();
    assert.equal(result.isShop, true);
    assert.ok(result.reasons.some(r => r.includes('WooCommerce')));
  });

  test('Regular blog/news article fixture does NOT trigger detection', () => {
    const { doc, win } = createMockDOM({
      pathname: '/2026/09/how-to-grow-tomatoes',
      buttons: [
        { textContent: 'Post Comment', getAttribute: () => null },
        { textContent: 'Share Article', getAttribute: () => null }
      ],
      generic: [
        { className: 'author-bio', textContent: 'John Doe is a gardener.' }
      ]
    });

    global.document = doc;
    global.window = win;

    const result = DullSopperDetector.analyzePage();
    assert.equal(result.isShop, false);
    assert.equal(result.score < DullSopperDetector.SHOP_THRESHOLD, true);
    assert.equal(result.reasons.length, 0);
  });
});
