/**
 * DullSopper - Curated Popular Web Shops
 * Matches major online retailers worldwide to ensure instant grayscale protection.
 */

const POPULAR_SHOP_DOMAINS = [
  // Global & General Retailers
  'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es',
  'amazon.ca', 'amazon.co.jp', 'amazon.in', 'amazon.com.au', 'amazon.com.br',
  'ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.it', 'ebay.es', 'ebay.ca', 'ebay.com.au',
  'aliexpress.com', 'alibaba.com', 'temu.com', 'shein.com', 'wish.com',
  'walmart.com', 'target.com', 'costco.com', 'bestbuy.com',

  // Electronics & Tech
  'newegg.com', 'bhphotovideo.com', 'microcenter.com', 'currys.co.uk',
  'mediamarkt.de', 'saturn.de', 'verkkokauppa.com',

  // Fashion & Apparel
  'asos.com', 'zara.com', 'hm.com', 'uniqlo.com', 'nordstrom.com',
  'macys.com', 'zalando.com', 'zalando.de', 'zalando.co.uk',
  'boohoo.com', 'farfetch.com', 'ssense.com', 'net-a-porter.com',
  'nike.com', 'adidas.com', 'lululemon.com',

  // Home, Crafts & Marketplace
  'etsy.com', 'ikea.com', 'wayfair.com', 'homedepot.com', 'lowes.com',
  'overstock.com', 'cdiscount.com', 'allegro.pl', 'mercadolibre.com',
  'rakuten.co.jp', 'rakuten.com', 'lazada.com', 'shopee.com',

  // Beauty & Lifestyle
  'sephora.com', 'ulta.com', 'iherb.com', 'chewy.com'
];

/**
 * Checks if a domain matches known popular shop domains.
 * Handles subdomains, e.g. "smile.amazon.com" or "m.ebay.com".
 * @param {string} domain - Hostname to check
 * @returns {boolean}
 */
function isPopularShop(domain) {
  if (!domain) return false;
  const cleanDomain = domain.toLowerCase().trim().replace(/^www\./, '');
  
  return POPULAR_SHOP_DOMAINS.some(shop => {
    return cleanDomain === shop || cleanDomain.endsWith('.' + shop);
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.POPULAR_SHOP_DOMAINS = POPULAR_SHOP_DOMAINS;
  globalThis.isPopularShop = isPopularShop;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { POPULAR_SHOP_DOMAINS, isPopularShop };
}
