// Instagram AI Comment Assistant - Main Entry Point (Prod Grade)

(() => {
    'use strict';

    window.InstagramAssistant = window.InstagramAssistant || {};
    const utils = window.InstagramAssistant;
    const state = utils.state || {};

    const LOG_PREFIX = '[Crixen IG]';

    init().catch((e) => console.error(LOG_PREFIX, 'init failed', e));

    async function init() {
        console.log(LOG_PREFIX, 'Initializing...');

        await utils.loadSettings?.();

        // Observe DOM changes and inject deterministically
        utils.startInjectionObserver?.();

        // First pass inject
        utils.injectButtonsIntoVisiblePosts?.();

        // Lightweight periodic safety pass (not every 1.5s)
        setInterval(() => {
            try {
                utils.injectButtonsIntoVisiblePosts?.();
            } catch { }
        }, 6000);
    }

    // Message Handler for Popup/Background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        (async () => {
            try {
                if (!request || typeof request !== 'object') {
                    sendResponse({ success: false, error: 'Invalid request' });
                    return;
                }

                if (request.action === 'triggerGenerate') {
                    await utils.triggerOnCurrentPost?.();
                    sendResponse({ success: true });
                    return;
                }

                if (request.action === 'startAutoPilot') {
                    await utils.startAutoPilot?.(request.limit);
                    sendResponse({ success: true });
                    return;
                }

                if (request.action === 'stopAutoPilot') {
                    utils.stopAutoPilot?.();
                    sendResponse({ success: true });
                    return;
                }

                if (request.action === 'getAutoStatus') {
                    sendResponse({
                        success: true,
                        isRunning: !!state.isAutoPilot,
                        limit: state.autoLimit,
                        count: state.autoCount,
                        phase: state.autoPhase || 'idle'
                    });
                    return;
                }

                sendResponse({ success: false, error: 'Unknown action' });
            } catch (e) {
                sendResponse({ success: false, error: e?.message || String(e) });
            }
        })();

        return true;
    });
})();