// auth-bridge.js - Runs on Dashboard pages
// Acts as the messenger between website and extension background

const Logger = window.CrixenLogger;

Logger.info('Auth Bridge Loaded');

// Tell the website the extension is ready
window.postMessage({
    type: 'CRIXEN_EXTENSION_READY',
    extensionId: chrome.runtime.id
}, '*');

// Listen for auth messages FROM the website
window.addEventListener('message', async (event) => {
    // Security: Only accept from same origin
    if (event.origin !== window.location.origin) return;

    const { type, payload } = event.data;

    switch (type) {
        case 'CRIXEN_AUTH_LOGIN':
            Logger.info('Received login credentials');

            // Forward to extension background
            chrome.runtime.sendMessage({
                action: 'auth:login',
                token: payload.token,
                user: payload.user,
                expiresAt: payload.expiresAt
            }, (response) => {
                const success = response?.success || false;
                if (!success) Logger.error('Extension login failed', chrome.runtime.lastError?.message);

                // Send confirmation back to website
                window.postMessage({
                    type: 'CRIXEN_AUTH_LOGIN_ACK',
                    success: success,
                    error: chrome.runtime.lastError?.message
                }, '*');
            });
            break;

        case 'CRIXEN_AUTH_LOGOUT':
            Logger.info('Received logout signal');

            chrome.runtime.sendMessage({
                action: 'auth:logout'
            }, (response) => {
                Logger.info('Extension logout successful');
                window.postMessage({
                    type: 'CRIXEN_AUTH_LOGOUT_ACK',
                    success: true
                }, '*');
            });
            break;

        case 'CRIXEN_AUTH_REFRESH':
            Logger.info('Token refresh request');

            chrome.runtime.sendMessage({
                action: 'auth:refresh',
                token: payload.token,
                expiresAt: payload.expiresAt
            }, (response) => {
                window.postMessage({
                    type: 'CRIXEN_AUTH_REFRESH_ACK',
                    success: response?.success || false
                }, '*');
            });
            break;

        case 'CRIXEN_CHECK_EXTENSION':
            Logger.info('Check request received');
            window.postMessage({
                type: 'CRIXEN_EXTENSION_READY',
                extensionId: chrome.runtime.id
            }, '*');
            break;
    }
});

// Periodically check if extension background is alive
let healthCheckInterval = setInterval(() => {
    try {
        if (!chrome.runtime?.id) {
            clearInterval(healthCheckInterval);
            return;
        }
        chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
            if (chrome.runtime.lastError) {
                Logger.info('Background connected but error:', chrome.runtime.lastError);
                // Don't stop check, background might be restarting
            }
        });
    } catch (e) {
        Logger.info('Extension context invalidated');
        clearInterval(healthCheckInterval);
    }
}, 30000); // Every 30s
