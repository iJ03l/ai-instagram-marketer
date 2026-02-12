// Crixen - Twitter Utilities (Prod Grade)

(() => {
    'use strict';

    window.CrixenTwitter = window.CrixenTwitter || {};
    const utils = window.CrixenTwitter;

    utils.state = utils.state || {
        currentTweet: null,
        settings: null,
        isProcessing: false,
        handledTweets: new Set(),

        // autopilot
        isAutoPilot: false,
        autoLimit: 20,
        autoCount: 0,
        autoPhase: 'idle',
        autoAbortController: null,

        // internal
        lastInjectAt: 0
    };

    const state = utils.state;

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
                    state.settings = response?.settings || { defaultStyle: 'witty', customPrompt: '' };
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
        document.querySelectorAll('.crixen-toast-message').forEach((el) => el.remove());

        const toast = document.createElement('div');
        toast.className = 'crixen-toast-message';
        toast.textContent = message;

        const bg =
            type === 'error' ? '#ff3b30' :
                type === 'success' ? '#34c759' :
                    type === 'warning' ? '#ff9f0a' : '#1d9bf0';

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
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            fontWeight: '800',
            boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
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
            toast.style.transform = 'translateX(-50%) translateY(14px)';
            setTimeout(() => toast.remove(), 240);
        }, 3500);
    };

    utils.showAuthPrompt = function () {
        document.querySelectorAll('.crixen-auth-prompt').forEach((el) => el.remove());

        const toast = document.createElement('div');
        toast.className = 'crixen-auth-prompt';
        toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-weight:800;">Login required to use Crixen</span>
        <button id="crixen-twitter-login-btn" style="
          background:white;color:#1d9bf0;border:none;padding:6px 12px;border-radius:12px;
          font-weight:900;cursor:pointer;font-size:13px;
        ">Login</button>
      </div>
    `;

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1d9bf0',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '999px',
            zIndex: '2147483647',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            fontWeight: '700',
            boxShadow: '0 8px 20px rgba(0,0,0,0.22)'
        });

        document.body.appendChild(toast);

        toast.querySelector('#crixen-twitter-login-btn')?.addEventListener('click', () => {
            window.open('https://crixen.xyz', '_blank');
            toast.remove();
        });

        setTimeout(() => toast.remove(), 9000);
    };

    // Helper to find current user handle (e.g. "@username")
    utils.getCurrentUserHandle = function () {
        const switcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
        const handleEl = switcher?.querySelector('div[dir="ltr"] > span');
        const handle = handleEl?.textContent?.trim();
        if (handle && handle.startsWith('@')) return handle.toLowerCase();

        // Fallback: search profile link
        const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
        const href = profileLink?.getAttribute('href');
        if (href) {
            const h = href.replace('/', '').toLowerCase();
            return `@${h}`;
        }
        return null;
    };

    // Pick best visible tweet for autopilot
    utils.pickBestVisibleTweet = function () {
        const tweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        const scored = [];

        for (const t of tweets) {
            if (!utils.isElementVisible(t)) continue;

            // Generate a semi-stable ID for the tweet
            const text = t.querySelector('[data-testid="tweetText"]')?.textContent || '';
            const author = t.querySelector('[data-testid="User-Name"]')?.textContent || '';
            const tweetId = `${author}:${text.slice(0, 60)}`;

            if (state.handledTweets.has(tweetId)) continue;
            if (t.dataset.crixenAutopilot === 'done') continue;
            if (t.dataset.crixenAutopilot === 'skipped') continue;

            // Skip ads/promos
            if (/ad/i.test(t.innerText) && /promoted/i.test(t.innerText)) {
                t.dataset.crixenAutopilot = 'skipped';
                continue;
            }

            const r = t.getBoundingClientRect();
            const centerDist = Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2);
            scored.push({ t, score: centerDist });
        }

        scored.sort((a, b) => a.score - b.score);
        return scored[0]?.t || null;
    };

    // Custom Modal for Post Creation
    utils.showPostModal = function () {
        return new Promise((resolve) => {
            // Cleanup existing
            document.querySelectorAll('.crixen-post-modal').forEach((el) => el.remove());

            // Overlay
            const overlay = document.createElement('div');
            overlay.className = 'crixen-post-modal';
            Object.assign(overlay.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                zIndex: '9999999',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            });

            // Container
            const container = document.createElement('div');
            Object.assign(container.style, {
                background: 'rgba(25, 25, 25, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '24px',
                width: '400px',
                maxWidth: '90vw',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                color: 'white'
            });

            // Title
            const title = document.createElement('h2');
            title.textContent = '✨ Create with AI';
            Object.assign(title.style, {
                margin: '0',
                fontSize: '20px',
                fontWeight: '800',
                background: 'linear-gradient(45deg, #fff, #888)',
                '-webkit-background-clip': 'text',
                '-webkit-text-fill-color': 'transparent'
            });

            // Topic Input
            const labelTopic = document.createElement('div');
            labelTopic.textContent = 'Topic / Vibe';
            labelTopic.style.fontSize = '13px';
            labelTopic.style.color = '#888';
            labelTopic.style.fontWeight = '600';

            const inputTopic = document.createElement('textarea');
            inputTopic.placeholder = 'e.g., "AI agents in fintech", "GM builders", "hot take on crypto"...';
            Object.assign(inputTopic.style, {
                width: '100%',
                height: '80px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '12px',
                color: 'white',
                fontSize: '14px',
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box' // Fix padding issue
            });
            inputTopic.onfocus = () => (inputTopic.style.borderColor = '#1d9bf0');
            inputTopic.onblur = () => (inputTopic.style.borderColor = 'rgba(255,255,255,0.1)');

            // Mode Selector
            const labelMode = document.createElement('div');
            labelMode.textContent = 'Format';
            labelMode.style.fontSize = '13px';
            labelMode.style.color = '#888';
            labelMode.style.marginTop = '4px';
            labelMode.style.fontWeight = '600';

            const modeContainer = document.createElement('div');
            Object.assign(modeContainer.style, {
                display: 'flex',
                gap: '8px',
                background: 'rgba(255,255,255,0.05)',
                padding: '4px',
                borderRadius: '12px'
            });

            const modes = [
                { id: 'post', label: 'Post' },
                { id: 'thread', label: 'Thread' },
                { id: 'longform', label: 'Longform' }
            ];

            let currentMode = 'post';

            modes.forEach((m) => {
                const btn = document.createElement('div');
                btn.textContent = m.label;
                Object.assign(btn.style, {
                    flex: '1',
                    textAlign: 'center',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    userSelect: 'none'
                });

                if (m.id === currentMode) {
                    btn.style.background = '#1d9bf0';
                    btn.style.color = 'white';
                } else {
                    btn.style.color = '#888';
                }

                btn.onclick = () => {
                    currentMode = m.id;
                    Array.from(modeContainer.children).forEach((child, idx) => {
                        if (modes[idx].id === currentMode) {
                            child.style.background = '#1d9bf0';
                            child.style.color = 'white';
                        } else {
                            child.style.background = 'transparent';
                            child.style.color = '#888';
                        }
                    });
                };

                modeContainer.appendChild(btn);
            });

            // Buttons
            const btnContainer = document.createElement('div');
            Object.assign(btnContainer.style, {
                display: 'flex',
                gap: '12px',
                marginTop: '10px'
            });

            const btnCancel = document.createElement('button');
            btnCancel.textContent = 'Cancel';
            Object.assign(btnCancel.style, {
                flex: '1',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '14px'
            });
            btnCancel.onmouseenter = () => (btnCancel.style.background = 'rgba(255,255,255,0.1)');
            btnCancel.onmouseleave = () => (btnCancel.style.background = 'rgba(255,255,255,0.05)');
            btnCancel.onclick = () => close(null);

            const btnGenerate = document.createElement('button');
            btnGenerate.textContent = 'Generate';
            Object.assign(btnGenerate.style, {
                flex: '2',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: '#1d9bf0',
                color: 'white',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '14px'
            });
            btnGenerate.onmouseenter = () => (btnGenerate.style.background = '#1a8cd8');
            btnGenerate.onmouseleave = () => (btnGenerate.style.background = '#1d9bf0');
            btnGenerate.onclick = () => {
                const topic = inputTopic.value.trim();
                if (!topic) {
                    inputTopic.style.borderColor = '#ff3b30';
                    inputTopic.focus();
                    return;
                }
                close({ topic, mode: currentMode });
            };

            // Assemble
            container.appendChild(title);
            container.appendChild(labelTopic);
            container.appendChild(inputTopic);
            container.appendChild(labelMode);
            container.appendChild(modeContainer);
            container.appendChild(btnContainer);
            overlay.appendChild(container);

            document.body.appendChild(overlay);
            inputTopic.focus();

            // Close handler
            function close(result) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.2s ease';
                setTimeout(() => overlay.remove(), 200);
                resolve(result);
            }

            // Click outside to close
            overlay.onclick = (e) => {
                if (e.target === overlay) close(null);
            };

            // Enter key to submit (if not holding shift)
            inputTopic.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    btnGenerate.click();
                }
                if (e.key === 'Escape') {
                    close(null);
                }
            };
        });
    };

})();