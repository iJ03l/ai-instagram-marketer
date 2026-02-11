// Instagram AI Comment Assistant - Main Entry Point

(function () {
    'use strict';

    // Ensure namespace exists (should be created by utils)
    window.InstagramAssistant = window.InstagramAssistant || {};
    const utils = window.InstagramAssistant;
    const state = utils.state || {}; // Fallback if utils not loaded yet (should not happen with manifest order)

    init();

    function init() {
        console.log('AI Comment Assistant: Initializing...');
        if (utils.loadSettings) utils.loadSettings();
        observeDOM();
        setTimeout(injectButtons, 1000);
        setInterval(injectButtons, 1500);
    }

    // New Message Handler for Popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'triggerGenerate') {
            handleKeyboardShortcut();
        } else if (request.action === 'startAutoPilot') {
            if (utils.startAutoPilot) utils.startAutoPilot(request.limit);
            sendResponse({ success: true });
        } else if (request.action === 'stopAutoPilot') {
            if (utils.stopAutoPilot) utils.stopAutoPilot();
            sendResponse({ success: true });
        } else if (request.action === 'getAutoStatus') {
            sendResponse({ isRunning: state.isAutoPilot, limit: state.autoLimit, count: state.autoCount });
        }
    });

    function observeDOM() {
        let timeout;
        const observer = new MutationObserver((mutations) => {
            let shouldInject = false;
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) shouldInject = true;
            });
            if (shouldInject) {
                clearTimeout(timeout);
                timeout = setTimeout(injectButtons, 300);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function injectButtons() {
        // Target articles (feed), main (Reels viewer), and dialogs (Reels modal)
        const posts = document.querySelectorAll('article, main, div[role="dialog"]');
        posts.forEach((post) => {
            if (post.dataset.aiCommentInjected && post.querySelector('.ai-comment-btn-glass')) return;

            const actionBar = utils.findActionBar ? utils.findActionBar(post) : null;
            if (actionBar) {
                const existingBtn = actionBar.querySelector('.ai-comment-btn-glass');
                if (existingBtn) existingBtn.remove();

                const btn = utils.createButton ? utils.createButton() : null;
                if (!btn) return;

                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';

                // Check if we are in a vertical stack (Reels)
                const isVertical = actionBar.offsetHeight > actionBar.offsetWidth * 2; // rough heuristic
                if (isVertical) {
                    container.style.marginTop = '12px';
                    container.style.flexDirection = 'column';
                    // Make button smaller/circular for Reels if needed, or just standard
                    // For now, keep standard but ensure it doesn't break layout
                    btn.classList.add('reels-mode');
                } else {
                    container.style.marginLeft = '8px';
                }

                container.appendChild(btn);

                actionBar.appendChild(container);

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Crucial: Blur the button so it doesn't steal focus back from the modal
                    btn.blur();
                    console.debug('AI Comment: Button clicked');
                    if (utils.handleGenerateClick) utils.handleGenerateClick(post);
                });

                post.dataset.aiCommentInjected = 'true';
            }
        });
    }

    function handleKeyboardShortcut() {
        if (state.currentPost && utils.handleGenerateClick) {
            utils.handleGenerateClick(state.currentPost);
        }
    }

})();
