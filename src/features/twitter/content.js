// SMITH ai - Twitter Entry Point

(function () {
    'use strict';

    window.SmithTwitter = window.SmithTwitter || {};
    const utils = window.SmithTwitter;

    // Init
    init();

    function init() {
        console.log('SMITH ai: Twitter Initialized');
        utils.loadSettings();
        observeDOM();

        // Periodic check for lost injections (React re-renders)
        setInterval(injectButtons, 2000);
    }

    function observeDOM() {
        const observer = new MutationObserver((mutations) => {
            let shouldInject = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) shouldInject = true;
            }
            if (shouldInject) injectButtons();
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function injectButtons() {
        // Find tweets
        const tweets = document.querySelectorAll('article[data-testid="tweet"]');

        tweets.forEach(tweet => {
            if (tweet.dataset.smithProcessed) return;

            const actionsBar = tweet.querySelector('[role="group"]');
            if (actionsBar) {
                // Add Reply Button
                const replyBtn = createButton('Reply');
                replyBtn.onclick = (e) => {
                    e.stopPropagation();
                    utils.handleReply(tweet);
                };
                actionsBar.appendChild(replyBtn);

                // Add Quote Button
                const quoteBtn = createButton('Quote');
                quoteBtn.onclick = (e) => {
                    e.stopPropagation();
                    utils.handleQuote(tweet);
                };
                actionsBar.appendChild(quoteBtn);

                tweet.dataset.smithProcessed = 'true';
            }
        });
    }

    function createButton(text) {
        const btn = document.createElement('div');
        btn.innerText = `🤖 ${text}`; // Robot emoji okay in page injection
        btn.style.cssText = 'color: #1d9bf0; font-weight: bold; font-size: 13px; cursor: pointer; margin-left: 12px; display: inline-flex; align-items: center;';
        btn.className = 'smith-ai-btn';
        return btn;
    }

    // Messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'startAutoPilot') {
            if (utils.startAutoPilot) utils.startAutoPilot(request.limit);
            sendResponse({ success: true });
        } else if (request.action === 'stopAutoPilot') {
            if (utils.stopAutoPilot) utils.stopAutoPilot();
            sendResponse({ success: true });
        } else if (request.action === 'getAutoStatus') {
            const state = window.SmithTwitter.state || {};
            sendResponse({
                isRunning: state.isAutoPilot || false,
                limit: state.autoLimit || 20,
                count: state.autoCount || 0
            });
        }
    });

})();
