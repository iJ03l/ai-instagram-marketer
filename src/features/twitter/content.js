// Crixen - Twitter Entry Point

(function () {
    'use strict';

    window.CrixenTwitter = window.CrixenTwitter || {};
    const utils = window.CrixenTwitter;

    // Init
    init();

    function init() {
        console.log('Crixen: Twitter Initialized');
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
        // Inject FAB for creating new posts
        if (!document.getElementById('crixen-fab-post')) {
            const fab = createFab();
            fab.onclick = (e) => {
                e.stopPropagation();
                utils.handleCreatePost();
            };
            document.body.appendChild(fab);
        }

        // Find tweets
        const tweets = document.querySelectorAll('article[data-testid="tweet"]');

        tweets.forEach(tweet => {
            if (tweet.dataset.crixenProcessed) return;

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

                tweet.dataset.crixenProcessed = 'true';
            }
        });
    }

    function createFab() {
        const btn = document.createElement('div');
        btn.id = 'crixen-fab-post';
        btn.innerHTML = '✨ AI Post';
        btn.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 30px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
            z-index: 9999;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transition: transform 0.2s, background 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';
        return btn;
    }

    function createButton(text) {
        const btn = document.createElement('div');
        btn.innerText = `🤖 ${text}`; // Robot emoji okay in page injection
        btn.style.cssText = 'color: #1d9bf0; font-weight: bold; font-size: 13px; cursor: pointer; margin-left: 12px; display: inline-flex; align-items: center;';
        btn.className = 'crixen-ai-btn';
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
            const state = window.CrixenTwitter.state || {};
            sendResponse({
                isRunning: state.isAutoPilot || false,
                limit: state.autoLimit || 20,
                count: state.autoCount || 0
            });
        }
    });

})();
