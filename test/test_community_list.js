/**
 * DullSopper - Community Blocklist Unit Tests
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const constants = require('../shared/constants.js');
const DullSopperCommunityList = require('../shared/community-list.js');
const DullSopperStorage = require('../shared/storage.js');

describe('Community Shopping Blocklist Parser & Matching', () => {
  test('parseHosts correctly extracts domains from hosts format', () => {
    const raw = `
# Community Shopping Blocklist
# Exported from hosts format
0.0.0.0 001shop.cz
0.0.0.0 0-360.com
127.0.0.1 www.fashion-store.co.uk
0.0.0.0 001shop.cz # duplicate entry
# 0.0.0.0 commented-out-store.com
`;

    const domains = DullSopperCommunityList.parseHosts(raw);
    assert.deepEqual(domains, [
      '001shop.cz',
      '0-360.com',
      'fashion-store.co.uk'
    ]);
  });

  test('isCommunityShop matches exact domains and subdomains', () => {
    DullSopperCommunityList.setDomainsForTesting([
      'badstore.com',
      'electronics-deal.net',
      '001shop.cz'
    ]);

    // Exact matches
    assert.equal(DullSopperCommunityList.isCommunityShop('badstore.com'), true);
    assert.equal(DullSopperCommunityList.isCommunityShop('www.badstore.com'), true);
    assert.equal(DullSopperCommunityList.isCommunityShop('001shop.cz'), true);

    // Subdomain matches
    assert.equal(DullSopperCommunityList.isCommunityShop('checkout.badstore.com'), true);
    assert.equal(DullSopperCommunityList.isCommunityShop('mobile.electronics-deal.net'), true);

    // Non-matches
    assert.equal(DullSopperCommunityList.isCommunityShop('wikipedia.org'), false);
    assert.equal(DullSopperCommunityList.isCommunityShop('notbadstore.com'), false);
  });

  test('evaluateSite respects Community Blocklist with Whitelist override', async () => {
    DullSopperCommunityList.setDomainsForTesting([
      'fast-fashion.com',
      'gadgets-depot.com'
    ]);

    // 1. Domain in community list -> dulled with status dulled_community
    const context1 = {
      settings: {
        enabled: true,
        useCommunityBlocklist: true,
        autoDetect: false,
        includePreloadedShops: false
      },
      blocklist: [],
      whitelist: [],
      detectedShops: {},
      communityChecker: DullSopperCommunityList.isCommunityShop
    };

    const res1 = await DullSopperStorage.evaluateSite('fast-fashion.com', false, [], context1);
    assert.equal(res1.isDulled, true);
    assert.equal(res1.status, constants.STATUS.DULLED_COMMUNITY);

    // 2. Whitelist overrides community list
    const context2 = {
      ...context1,
      whitelist: ['fast-fashion.com']
    };

    const res2 = await DullSopperStorage.evaluateSite('fast-fashion.com', false, [], context2);
    assert.equal(res2.isDulled, false);
    assert.equal(res2.status, constants.STATUS.WHITELISTED);

    // 3. Community blocklist disabled in settings
    const context3 = {
      ...context1,
      settings: {
        ...context1.settings,
        useCommunityBlocklist: false
      }
    };

    const res3 = await DullSopperStorage.evaluateSite('fast-fashion.com', false, [], context3);
    assert.equal(res3.isDulled, false);
    assert.equal(res3.status, constants.STATUS.NORMAL);
  });
});
