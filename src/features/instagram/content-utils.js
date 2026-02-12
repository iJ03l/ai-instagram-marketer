// Instagram AI Comment Assistant - Utils & Shared State (Prod Grade)

(() => {
    'use strict';

    window.InstagramAssistant = window.InstagramAssistant || {};

    const utils = window.InstagramAssistant;

    utils.state = utils.state || {
        currentPost: null,
        settings: null,
        isProcessing: false,

        // autopilot
        isAutoPilot: false,
        autoLimit: 20,
        autoCount: 0,
        autoPhase: 'idle',
        autoAbortController: null,

        // misc
        lastGeneratedAt: 0
    };

    const state = utils.state;

    // ---------- Core helpers ----------

    utils.isExtensionValid = function () {
        try {
            chrome.runtime.id;
            return true;
        } catch {
            return false;
        }
    };

    utils.loadSettings = async function () {
        if (!utils.isExtensionValid()) return;
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
                    if (chrome.runtime.lastError) return resolve();
                    state.settings = response?.settings || { defaultStyle: 'friendly', customPrompt: '' };
                    resolve();
                });
            } catch {
                resolve();
            }
        });
    };

    utils.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    utils.isElementVisible = function (el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;
        if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        return true;
    };

    utils.showToast = function (message, type = 'info') {
        const existing = document.querySelectorAll('.ai-toast-message');
        existing.forEach((el) => el.remove());

        const toast = document.createElement('div');
        toast.className = 'ai-toast-message';
        toast.textContent = message;

        const bg =
            type === 'error' ? '#ff3b30' :
                type === 'success' ? '#34c759' :
                    type === 'warning' ? '#ff9f0a' : '#007aff';

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: bg,
            color: 'white',
            padding: '12px 18px',
            borderRadius: '999px',
            zIndex: '2147483647',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
            opacity: '0',
            transition: 'all 220ms ease'
        });

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(16px)';
            setTimeout(() => toast.remove(), 250);
        }, 3500);
    };

    utils.showAuthPrompt = function () {
        const existing = document.querySelectorAll('.ai-auth-prompt');
        existing.forEach((el) => el.remove());

        const box = document.createElement('div');
        box.className = 'ai-auth-prompt';
        box.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-weight:700;">Login required to use Crixen</span>
        <button id="crixen-login-btn" style="
          background:#fff;color:#007aff;border:none;
          padding:6px 12px;border-radius:12px;font-weight:800;
          cursor:pointer;font-size:13px;
        ">Login</button>
      </div>
    `;

        Object.assign(box.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#007aff',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '999px',
            zIndex: '2147483647',
            fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif',
            fontSize: '14px',
            boxShadow: '0 10px 24px rgba(0,0,0,0.22)',
            opacity: '0',
            transition: 'all 220ms ease'
        });

        document.body.appendChild(box);

        box.querySelector('#crixen-login-btn')?.addEventListener('click', () => {
            window.open('https://crixen.xyz', '_blank');
            box.remove();
        });

        requestAnimationFrame(() => {
            box.style.opacity = '1';
            box.style.transform = 'translateX(-50%) translateY(-10px)';
        });

        setTimeout(() => box.remove(), 9000);
    };

    // ---------- Injection (prod-grade) ----------

    utils.startInjectionObserver = function () {
        if (state._injectObserverStarted) return;
        state._injectObserverStarted = true;

        let scheduled = false;

        const schedule = () => {
            if (scheduled) return;
            scheduled = true;
            setTimeout(() => {
                scheduled = false;
                utils.injectButtonsIntoVisiblePosts();
            }, 250);
        };

        const mo = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.addedNodes?.length) {
                    schedule();
                    return;
                }
            }
        });

        mo.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });
    };

    utils.injectButtonsIntoVisiblePosts = function () {
        // Look at likely containers
        const nodes = document.querySelectorAll('article, main, div[role="dialog"]');

        for (const post of nodes) {
            // only inject when visible-ish to reduce DOM churn
            if (!utils.isElementVisible(post)) continue;

            const actionBar = utils.findActionBar?.(post);
            if (!actionBar) continue;

            const existingBtn = actionBar.querySelector('.ai-comment-btn-glass');
            if (existingBtn) continue;

            const btn = utils.createButton?.();
            if (!btn) continue;

            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'center';

            const isVertical = actionBar.offsetHeight > actionBar.offsetWidth * 2;
            if (isVertical) {
                wrapper.style.marginTop = '12px';
                wrapper.style.flexDirection = 'column';
                btn.classList.add('reels-mode');
            } else {
                wrapper.style.marginLeft = '8px';
            }

            wrapper.appendChild(btn);
            actionBar.appendChild(wrapper);

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                btn.blur();
                utils.handleGenerateClick?.(post);
            });
        }
    };

    utils.createButton = function () {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-comment-btn-glass';
        btn.textContent = 'AI Comment';
        Object.assign(btn.style, {
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'rgba(0,0,0,0.35)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '999px',
            fontWeight: '800',
            fontSize: '12px',
            letterSpacing: '0.2px'
        });
        return btn;
    };

    // ---------- DOM target helpers ----------

    utils.findActionBar = function (post) {
        // Prefer a container that includes Like/Comment icons.
        const svgs = post.querySelectorAll('svg[aria-label]');
        for (const svg of svgs) {
            const label = svg.getAttribute('aria-label');
            if (label === 'Like' || label === 'Comment' || label === 'Share') {
                const btn = svg.closest('[role="button"],button');
                if (!btn) continue;

                let parent = btn.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    const count = parent.querySelectorAll('svg[aria-label="Like"], svg[aria-label="Comment"], svg[aria-label="Share"]').length;
                    if (count >= 2) return parent;
                    parent = parent.parentElement;
                }
                return btn.parentElement?.parentElement || btn.parentElement || null;
            }
        }
        return post.querySelector('section') || null;
    };

    utils.findCommentIcon = function (post) {
        const selectors = ['svg[aria-label="Comment"]', '[aria-label="Comment"]'];
        for (const sel of selectors) {
            const icon = post.querySelector(sel);
            if (!icon) continue;
            return icon.closest('button,div[role="button"]') || icon;
        }
        return null;
    };

    utils.waitFor = async function (fn, { timeoutMs = 5000, intervalMs = 100 } = {}) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const val = fn();
            if (val) return val;
            await utils.sleep(intervalMs);
        }
        return null;
    };

    utils.waitForStrictInput = async function (timeout = 5000, preferredContainer = null) {
        const find = () => {
            // 1) Try preferred container first (most specific)
            if (preferredContainer) {
                const within = preferredContainer.querySelectorAll('textarea, [contenteditable="true"]');
                for (const el of within) {
                    if (utils.isElementVisible(el)) return el;
                }
            }

            // 2) Try active element (if user already clicked in)
            const active = document.activeElement;
            if (active) {
                const tag = active.tagName?.toLowerCase();
                if (tag === 'textarea' || active.getAttribute('contenteditable') === 'true' || active.isContentEditable) {
                    // Ensure it's not a generic button or irrelevant element
                    if (utils.isElementVisible(active)) return active;
                }
            }

            // 3) Try modal/dialog
            const inDialogs = document.querySelectorAll('div[role="dialog"] textarea, div[role="dialog"] [contenteditable="true"]');
            for (const el of inDialogs) if (utils.isElementVisible(el)) return el;

            // 4) Try generic fallback
            const all = document.querySelectorAll('article textarea, article [contenteditable="true"], main textarea, main [contenteditable="true"]');
            for (const el of all) if (utils.isElementVisible(el)) return el;

            return null;
        };

        const existing = find();
        if (existing) return existing;

        return utils.waitFor(find, { timeoutMs: timeout, intervalMs: 120 });
    };

    utils.isTextOnlyInInput = function (container, text) {
        if (!container || !text) return false;
        const target = text.trim().toLowerCase().slice(0, 100);
        if (!target) return false;

        const inputs = Array.from(container.querySelectorAll('textarea, [contenteditable="true"]'));
        const docText = (container.innerText || '').toLowerCase();

        // Find all occurrences of target in docText
        let docMatches = 0;
        let pos = docText.indexOf(target);
        while (pos !== -1) {
            docMatches++;
            pos = docText.indexOf(target, pos + target.length);
        }

        // Subtract matches found inside inputs
        let inputMatches = 0;
        for (const input of inputs) {
            const val = (input.value || input.textContent || '').toLowerCase();
            if (val.includes(target)) inputMatches++;
        }

        // If docMatches matches inputMatches, the text is ONLY in the inputs
        return docMatches > 0 && docMatches <= inputMatches;
    };

    utils.findPostButtonInContainer = function (container) {
        const within = container || document.body;
        const candidates = within.querySelectorAll('button,[role="button"]');
        for (const btn of candidates) {
            const t = (btn.textContent || '').trim().toLowerCase();
            if (t === 'post' && utils.isElementVisible(btn)) return btn;
        }
        // fallback: dialog-wide
        const dialogBtns = document.querySelectorAll('div[role="dialog"] button, div[role="dialog"] [role="button"]');
        for (const btn of dialogBtns) {
            const t = (btn.textContent || '').trim().toLowerCase();
            if (t === 'post' && utils.isElementVisible(btn)) return btn;
        }
        return null;
    };

    utils.closeModal = function (startUrl) {
        // best effort close
        const esc = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
            view: window
        });
        document.dispatchEvent(esc);

        setTimeout(() => {
            const closeBtn =
                document.querySelector('[aria-label="Close"]') ||
                document.querySelector('svg[aria-label="Close"]')?.closest('[role="button"],button');
            closeBtn?.click?.();
        }, 200);

        setTimeout(() => {
            if (startUrl && window.location.href !== startUrl && window.history.length > 1) {
                window.history.back();
            }
        }, 650);
    };

    // Used by popup keyboard shortcut
    utils.triggerOnCurrentPost = async function () {
        if (state.currentPost) {
            await utils.handleGenerateClick?.(state.currentPost);
            return;
        }
        // pick best visible post
        const post = utils.pickBestVisiblePost?.();
        if (post) await utils.handleGenerateClick?.(post);
        else utils.showToast('No post found in view', 'warning');
    };

    utils.pickBestVisiblePost = function () {
        const posts = Array.from(document.querySelectorAll('article'));
        const scored = [];

        for (const p of posts) {
            if (!utils.isElementVisible(p)) continue;
            const r = p.getBoundingClientRect();
            const centerDist = Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2);
            const already = p.dataset.aiCommented;
            if (already === 'true') continue;
            scored.push({ p, score: centerDist });
        }

        scored.sort((a, b) => a.score - b.score);
        return scored[0]?.p || null;
    };
})();