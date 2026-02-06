// Instagram AI Comment Assistant - Utils & Shared State

(function () {
    'use strict';

    // Initialize Global Namespace
    window.InstagramAssistant = window.InstagramAssistant || {};

    // Shared State
    window.InstagramAssistant.state = {
        currentPost: null,
        settings: null,
        isProcessing: false,
        isAutoPilot: false,
        autoLimit: 20,
        autoCount: 0
    };

    // --- UTILITIES ---

    window.InstagramAssistant.isExtensionValid = function () {
        try {
            chrome.runtime.id;
            return true;
        } catch {
            return false;
        }
    };

    window.InstagramAssistant.loadSettings = async function () {
        if (!window.InstagramAssistant.isExtensionValid()) return;
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve(); return;
                    }
                    window.InstagramAssistant.state.settings = response?.settings || { defaultStyle: 'friendly' };
                    resolve();
                });
            } catch (e) { resolve(); }
        });
    };

    window.InstagramAssistant.showToast = function (message, type = 'info') {
        const existing = document.querySelectorAll('.ai-toast-message');
        existing.forEach(el => el.remove());

        const toast = document.createElement('div');
        toast.className = 'ai-toast-message';
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = type === 'error' ? '#ff3b30' : (type === 'success' ? '#34c759' : '#007aff');
        toast.style.color = 'white';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '24px';
        toast.style.zIndex = '10000';
        toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '500';
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.3s ease';

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    window.InstagramAssistant.showAuthPrompt = function () {
        const existing = document.querySelectorAll('.ai-auth-prompt');
        existing.forEach(el => el.remove());

        const toast = document.createElement('div');
        toast.className = 'ai-auth-prompt';
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span>🔒 Login required to use Crixen</span>
                <button id="crixen-login-btn" style="
                    background: white; 
                    color: #007aff; 
                    border: none; 
                    padding: 6px 12px; 
                    border-radius: 12px; 
                    font-weight: 600; 
                    cursor: pointer;
                    font-size: 13px;
                ">Login</button>
            </div>
        `;

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#007aff',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '24px',
            zIndex: '10000',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            opacity: '0',
            transition: 'all 0.3s ease'
        });

        document.body.appendChild(toast);

        document.getElementById('crixen-login-btn').addEventListener('click', () => {
            window.open('https://crixen.xyz', '_blank');
            toast.remove();
        });

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
        });

        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(20px)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 8000); // Longer timeout for action
    };

    window.InstagramAssistant.sleep = function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    window.InstagramAssistant.isElementVisible = function (el) {
        if (!el) return false;
        if (el.offsetParent === null) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return true;
    };

    window.InstagramAssistant.waitForStrictInput = function (timeout = 3000) {
        return new Promise((resolve) => {
            const check = () => {
                const dialogInputs = document.querySelectorAll('div[role="dialog"] textarea, div[role="dialog"] [contenteditable="true"][role="textbox"]');
                for (const el of dialogInputs) {
                    if (window.InstagramAssistant.isElementVisible(el)) return el;
                }
                const allInputs = document.querySelectorAll('textarea, [contenteditable="true"][role="textbox"]');
                for (const el of allInputs) {
                    if (window.InstagramAssistant.isElementVisible(el)) return el;
                }
                return null;
            };

            const existing = check();
            if (existing) {
                resolve(existing);
                return;
            }

            const observer = new MutationObserver(() => {
                const el = check();
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(check());
            }, timeout);
        });
    };

    window.InstagramAssistant.findPostButtonInContainer = function (container) {
        const potentialButtons = container.querySelectorAll('[role="button"], button');
        for (const btn of potentialButtons) {
            const text = btn.textContent.trim().toLowerCase();
            if (text === 'post' && window.InstagramAssistant.isElementVisible(btn) && !btn.disabled) return btn;
        }
        // Second pass: accept disabled if no enabled found (to try enabling it)
        for (const btn of potentialButtons) {
            const text = btn.textContent.trim().toLowerCase();
            if (text === 'post' && window.InstagramAssistant.isElementVisible(btn)) return btn;
        }

        if (container !== document.body) {
            const globalBtns = document.querySelectorAll('div[role="dialog"] [role="button"], div[role="dialog"] button');
            for (const btn of globalBtns) {
                if (btn.textContent.trim().toLowerCase() === 'post' && window.InstagramAssistant.isElementVisible(btn)) return btn;
            }
        }
        return null;
    };

    window.InstagramAssistant.findActionBar = function (post) {
        const svgs = post.querySelectorAll('svg');
        for (const svg of svgs) {
            if (svg.getAttribute('aria-label') === 'Like' || svg.getAttribute('aria-label') === 'Comment') {
                return svg.closest('section') || svg.closest('div[role="button"]')?.parentElement?.parentElement;
            }
        }
        return post.querySelector('section._aamu') || post.querySelector('div.x1bedvcd');
    };

    window.InstagramAssistant.createButton = function () {
        const btn = document.createElement('div');
        btn.innerHTML = 'AI Comment';
        btn.className = 'ai-comment-btn-glass';
        btn.setAttribute('role', 'button');
        return btn;
    };

    window.InstagramAssistant.closeModal = function (startUrl) {
        console.log('AI Comment: Closing modal...');
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true, view: window });
        document.dispatchEvent(escEvent);

        setTimeout(() => {
            const closeBtn = document.querySelector('[aria-label="Close"]') ||
                document.querySelector('svg[aria-label="Close"]')?.closest('[role="button"]');
            if (closeBtn) {
                if (typeof closeBtn.click === 'function') closeBtn.click();
                else closeBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
            }
        }, 200);

        setTimeout(() => {
            if (startUrl && window.location.href !== startUrl) {
                if (window.history.length > 1) window.history.back();
            }
        }, 500);
    };

    window.InstagramAssistant.findCommentIcon = function (post) {
        const selectors = [
            'svg[aria-label="Comment"]',
            'svg[aria-label="comment"]',
            '[aria-label="Comment"]',
            '[aria-label="comment"]'
        ];
        for (const selector of selectors) {
            const icon = post.querySelector(selector);
            if (icon) {
                const clickable = icon.closest('button') || icon.closest('div[role="button"]') || icon.closest('span') || icon.parentElement;
                if (clickable) return clickable;
            }
        }
        const svgs = post.querySelectorAll('svg');
        for (const svg of svgs) {
            const parent = svg.parentElement;
            if (parent && parent.tagName !== 'BUTTON') {
                const rect = svg.getBoundingClientRect();
                if (rect.width >= 20 && rect.width <= 32) {
                    const clickable = svg.closest('button') || svg.closest('div[role="button"]');
                    if (clickable) return clickable;
                }
            }
        }
        return null;
    };

})();
