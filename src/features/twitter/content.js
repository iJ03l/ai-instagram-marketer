// Crixen - Twitter/X Entry Point (Prod Grade)

(() => {
    'use strict';

    window.CrixenTwitter = window.CrixenTwitter || {};
    const utils = window.CrixenTwitter;

    init();

    function init() {
        console.log('[CRIXEN][X] Initialized');

        utils.loadSettings?.();

        observeDOM();
        injectButtons();

        // Safety pass (React re-renders)
        setInterval(() => {
            try { injectButtons(); } catch { }
        }, 5000);
    }

    function observeDOM() {
        let scheduled = false;
        const schedule = () => {
            if (scheduled) return;
            scheduled = true;
            setTimeout(() => {
                scheduled = false;
                injectButtons();
            }, 250);
        };

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.addedNodes?.length) {
                    schedule();
                    return;
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function injectButtons() {
        // FAB for create post/thread/longform
        if (!document.getElementById('crixen-fab-post')) {
            const fab = createFab();
            fab.addEventListener('click', (e) => {
                e.stopPropagation();
                utils.handleCreatePost?.();
            });
            document.body.appendChild(fab);
        }

        // Inject on tweets
        const tweets = document.querySelectorAll('article[data-testid="tweet"]');
        tweets.forEach((tweet) => {
            if (!utils.isElementVisible?.(tweet)) return;

            const actionsBar = tweet.querySelector('[role="group"]');
            if (!actionsBar) return;

            // avoid duplicates
            if (actionsBar.querySelector('[data-crixen="reply"]')) return;

            const replyBtn = createActionBtn('Reply', 'reply');
            replyBtn.onclick = (e) => {
                e.stopPropagation();
                utils.handleReply?.(tweet);
            };

            const quoteBtn = createActionBtn('Quote', 'quote');
            quoteBtn.onclick = (e) => {
                e.stopPropagation();
                utils.handleQuote?.(tweet);
            };

            actionsBar.appendChild(replyBtn);
            actionsBar.appendChild(quoteBtn);
        });

        // Inject in Composer Toolbar (Main & Dialog)
        const composerToolbars = document.querySelectorAll('[data-testid="toolBar"]');
        composerToolbars.forEach((toolbar) => {
            if (!utils.isElementVisible?.(toolbar)) return;
            if (toolbar.querySelector('[data-crixen="composer-btn"]')) return;

            // Find valid insertion point (usually before the tweet button or character count)
            const firstChild = toolbar.firstChild;

            const btn = document.createElement('div');
            btn.setAttribute('data-crixen', 'composer-btn');
            btn.textContent = '✨ AI';
            btn.style.cssText = `
                color: #1d9bf0;
                font-weight: 700;
                font-size: 13px;
                cursor: pointer;
                padding: 4px 10px;
                margin-right: 12px;
                border-radius: 999px;
                border: 1px solid rgba(29, 155, 240, 0.3);
                display: flex;
                align-items: center;
                user-select: none;
                transition: background 0.2s ease;
            `;
            btn.onmouseenter = () => (btn.style.background = 'rgba(29, 155, 240, 0.1)');
            btn.onmouseleave = () => (btn.style.background = 'transparent');

            btn.onclick = (e) => {
                e.stopPropagation();
                utils.handleCreatePost?.();
            };

            if (firstChild) {
                toolbar.insertBefore(btn, firstChild);
            } else {
                toolbar.appendChild(btn);
            }
        });
    }

    function createFab() {
        const btn = document.createElement('div');
        btn.id = 'crixen-fab-post';
        btn.textContent = '✨ AI Post';
        btn.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 28px;
      background: rgba(0,0,0,0.72);
      color: white;
      padding: 12px 16px;
      border-radius: 12px;
      font-weight: 900;
      font-size: 14px;
      cursor: pointer;
      z-index: 999999;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 10px 24px rgba(0,0,0,0.26);
      transition: transform 0.2s ease, background 0.2s ease;
      user-select: none;
    `;
        btn.onmouseenter = () => (btn.style.transform = 'translateY(-2px)');
        btn.onmouseleave = () => (btn.style.transform = 'translateY(0)');
        return btn;
    }

    function createActionBtn(label, kind) {
        const btn = document.createElement('div');
        btn.setAttribute('data-crixen', kind);
        btn.textContent = `🤖 ${label}`;
        btn.style.cssText = `
      color: #1d9bf0;
      font-weight: 900;
      font-size: 13px;
      cursor: pointer;
      margin-left: 12px;
      display: inline-flex;
      align-items: center;
      user-select: none;
    `;
        return btn;
    }

    // popup messaging
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'startAutoPilot') {
            utils.startAutoPilot?.(request.limit);
            sendResponse({ success: true });
        } else if (request.action === 'stopAutoPilot') {
            utils.stopAutoPilot?.();
            sendResponse({ success: true });
        } else if (request.action === 'getAutoStatus') {
            const s = window.CrixenTwitter.state || {};
            sendResponse({
                success: true,
                isRunning: !!s.isAutoPilot,
                limit: s.autoLimit || 20,
                count: s.autoCount || 0,
                phase: s.autoPhase || 'idle'
            });
        }
    });
})();