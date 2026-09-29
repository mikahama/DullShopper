/**
 * DullSopper - Background Script
 * Coordinates tab statuses, toolbar icon badges, and storage synchronization.
 */

(() => {
  const browserApi = (typeof browser !== 'undefined') ? browser : chrome;

  /**
   * Update browser action badge and icon for a tab
   */
  async function updateTabBadge(tabId, url) {
    if (!tabId || !url || url.startsWith('about:') || url.startsWith('chrome:') || url.startsWith('moz-extension:')) {
      await clearBadge(tabId);
      return;
    }

    try {
      const evaluation = await DullSopperStorage.evaluateSite(url);
      const settings = evaluation.settings;

      if (!settings.enabled) {
        await setBadge(tabId, 'OFF', '#71717a');
        await setActionIcon(tabId, false);
        return;
      }

      if (evaluation.isDulled) {
        if (settings.showBadge) {
          await setBadge(tabId, 'DULL', '#3f3f46');
        } else {
          await clearBadge(tabId);
        }
        await setActionIcon(tabId, true);
      } else if (evaluation.status === DULLSOPPER_CONSTANTS.STATUS.WHITELISTED) {
        if (settings.showBadge) {
          await setBadge(tabId, 'OFF', '#10b981');
        } else {
          await clearBadge(tabId);
        }
        await setActionIcon(tabId, false);
      } else {
        await clearBadge(tabId);
        await setActionIcon(tabId, false);
      }
    } catch (e) {
      console.debug('DullSopper: updateTabBadge error', e);
    }
  }

  async function setBadge(tabId, text, color) {
    try {
      await browserApi.action.setBadgeText({ text, tabId });
      await browserApi.action.setBadgeBackgroundColor({ color, tabId });
    } catch {}
  }

  async function clearBadge(tabId) {
    try {
      await browserApi.action.setBadgeText({ text: '', tabId });
    } catch {}
  }

  async function setActionIcon(tabId, isDulled) {
    try {
      const prefix = isDulled ? 'icons/icon-gray-' : 'icons/icon-';
      await browserApi.action.setIcon({
        tabId,
        path: {
          16: `${prefix}16.png`,
          32: `${prefix}32.png`,
          48: `${prefix}48.png`
        }
      });
    } catch {}
  }

  /**
   * Broadcast style updates to all tabs matching a domain or all tabs if no domain given
   */
  async function broadcastStateChange(targetDomain = null) {
    try {
      const tabs = await browserApi.tabs.query({});
      for (const tab of tabs) {
        if (!tab.url || !tab.id) continue;
        const tabDomain = DullSopperStorage.cleanDomain(tab.url);

        if (!targetDomain || tabDomain === targetDomain || tabDomain.endsWith('.' + targetDomain)) {
          const evalResult = await DullSopperStorage.evaluateSite(tab.url);
          // Send message to tab content script
          browserApi.tabs.sendMessage(tab.id, {
            action: DULLSOPPER_CONSTANTS.MESSAGES.APPLY_STYLES,
            isDulled: evalResult.isDulled,
            settings: evalResult.settings
          }).catch(() => {});

          // Also refresh tab badge
          updateTabBadge(tab.id, tab.url);
        }
      }
    } catch (e) {
      console.debug('DullSopper: broadcastStateChange error', e);
    }
  }

  // Handle Tab Activated / Updated
  browserApi.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await browserApi.tabs.get(activeInfo.tabId);
      if (tab && tab.url) {
        updateTabBadge(tab.id, tab.url);
      }
    } catch {}
  });

  browserApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab && tab.url) {
      updateTabBadge(tabId, tab.url);
    }
  });

  // Handle Extension Installation / Startup
  browserApi.runtime.onInstalled.addListener(async () => {
    console.log('DullSopper extension installed successfully.');
    const settings = await DullSopperStorage.getSettings();
    await DullSopperStorage.saveSettings(settings);
  });

  // Handle Runtime Messages
  browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return false;

    (async () => {
      try {
        switch (message.action) {
          case DULLSOPPER_CONSTANTS.MESSAGES.SHOP_DETECTED: {
            if (sender.tab && sender.tab.id && message.domain) {
              await DullSopperStorage.saveDetectedShop(message.domain, {
                reasons: message.reasons || [],
                score: message.score || 0,
                url: message.url || (sender.tab.url || '')
              });
              await updateTabBadge(sender.tab.id, sender.tab.url || message.url);
            }
            sendResponse({ success: true });
            break;
          }

          case DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS: {
            const domain = DullSopperStorage.cleanDomain(message.domain);
            if (!domain) {
              sendResponse({ success: false, error: 'Invalid domain' });
              return;
            }

            if (message.status === DULLSOPPER_CONSTANTS.STATUS.DULLED_BLOCKED) {
              await DullSopperStorage.addToBlocklist(domain);
            } else if (message.status === DULLSOPPER_CONSTANTS.STATUS.WHITELISTED) {
              await DullSopperStorage.addToWhitelist(domain);
            } else if (message.status === DULLSOPPER_CONSTANTS.STATUS.NORMAL) {
              // Reset / remove from both lists
              await DullSopperStorage.removeFromBlocklist(domain);
              await DullSopperStorage.removeFromWhitelist(domain);
              await DullSopperStorage.removeDetectedShop(domain);
            }

            // Immediately broadcast update so changes reflect without page refresh
            await broadcastStateChange(domain);
            sendResponse({ success: true });
            break;
          }

          case DULLSOPPER_CONSTANTS.MESSAGES.UPDATE_SETTINGS: {
            if (message.settings) {
              await DullSopperStorage.saveSettings(message.settings);
              await broadcastStateChange(null);
            }
            sendResponse({ success: true });
            break;
          }

          case DULLSOPPER_CONSTANTS.MESSAGES.GET_POPUP_DATA: {
            const tabUrl = message.url;
            const domain = DullSopperStorage.cleanDomain(tabUrl);
            const evaluation = await DullSopperStorage.evaluateSite(domain);
            const blocklist = await DullSopperStorage.getBlocklist();
            const whitelist = await DullSopperStorage.getWhitelist();
            const detectedShops = await DullSopperStorage.getDetectedShops();

            sendResponse({
              domain,
              evaluation,
              isBlocked: DullSopperStorage.isDomainInList(domain, blocklist),
              isWhitelisted: DullSopperStorage.isDomainInList(domain, whitelist),
              isDetected: !!detectedShops[domain],
              detectedInfo: detectedShops[domain] || null,
              totalBlocked: blocklist.length,
              totalWhitelisted: whitelist.length,
              totalDetected: Object.keys(detectedShops).length
            });
            break;
          }

          default:
            sendResponse({ error: 'Unknown action' });
            break;
        }
      } catch (err) {
        console.error('DullSopper: background error handling message', err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // Keep message channel open for async response
  });
})();
