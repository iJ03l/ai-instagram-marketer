// Instagram AI Comment Assistant - Content Script

(function () {
    'use strict';

    let currentPost = null;
    let settings = null;
    let isProcessing = false;
    let extensionValid = true;

    init();

    function init() {
        console.log('AI Comment Assistant: Initializing...');
        loadSettings();
        observeDOM();
        setTimeout(injectButtons, 1000);

        try {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'triggerGenerate') {
                    handleKeyboardShortcut();
                }
            });
        } catch (e) {
            extensionValid = false;
            console.error('AI Comment: Extension context invalid', e);
        }
    }

    function isExtensionValid() {
        try {
            chrome.runtime.id;
            return true;
        } catch {
            return false;
        }
    }

    async function loadSettings() {
        try {
            return new Promise((resolve) => {
                if (!isExtensionValid()) {
                    resolve();
                    return;
                }
                chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
                    settings = response?.settings || { defaultStyle: 'friendly' };
                    resolve();
                });
            });
        } catch (e) {
            console.log('AI Comment: Settings load failed (context invalid)');
        }
    }

    function observeDOM() {
        const observer = new MutationObserver((mutations) => {
            let shouldInject = false;
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    shouldInject = true;
                }
            });
            if (shouldInject) {
                injectButtons();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function injectButtons() {
        const posts = document.querySelectorAll('article');

        posts.forEach((post) => {
            if (post.dataset.aiCommentInjected) return;

            const actionBar = findActionBar(post);

            if (actionBar) {
                const btn = createButton();
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.marginLeft = '8px';
                container.appendChild(btn);

                actionBar.appendChild(container); // Add to end of action bar

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleGenerateClick(post);
                });

                post.dataset.aiCommentInjected = 'true';
            }
        });
    }

    function findActionBar(post) {
        const svgs = post.querySelectorAll('svg');
        for (const svg of svgs) {
            if (svg.getAttribute('aria-label') === 'Like' || svg.getAttribute('aria-label') === 'Comment') {
                return svg.closest('section') || svg.closest('div[role="button"]')?.parentElement?.parentElement;
            }
        }
        return post.querySelector('section._aamu') || post.querySelector('div.x1bedvcd');
    }

    function createButton() {
        const btn = document.createElement('div');
        btn.innerHTML = 'AI Comment';
        btn.className = 'ai-comment-btn-glass';
        btn.setAttribute('role', 'button');
        return btn;
    }

    function extractPostContent(post) {
        const parts = [];

        // 1. Get username
        const usernameEl = post.querySelector('a[href^="/"] span') ||
            post.querySelector('header a') ||
            post.querySelector('span[style*="font-weight: 600"]');

        if (usernameEl) {
            const username = usernameEl.textContent?.trim();
            if (username && username.length < 50) {
                parts.push(`@${username}`);
            }
        }

        // 2. Get caption
        const captionEl = post.querySelector('h1') ||
            post.querySelector('li._a9zf span') ||
            post.querySelector('span[dir="auto"]');

        if (captionEl) {
            const text = captionEl.textContent?.trim();
            if (text && text.length > 5) {
                parts.push(text.substring(0, 500));
            }
        }

        // 3. Get image alt text
        const images = post.querySelectorAll('img[alt]');
        images.forEach((img) => {
            const alt = img.alt?.trim();
            if (alt && alt.length > 10 && !alt.includes('profile') && !alt.includes('Photo by')) {
                parts.push(alt.substring(0, 200));
            }
        });

        const content = parts.join(' - ');
        console.log('AI Comment Extracted Content:', content);

        return content || 'Instagram post';
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
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
    }

    async function handleGenerateClick(post) {
        if (!isExtensionValid()) {
            showToast('Extension reloaded. Refresh the page.', 'warning');
            return;
        }

        if (isProcessing) {
            showToast('Generating...', 'warning');
            return;
        }

        currentPost = post;
        isProcessing = true;
        showToast('🤖 Generating comment...', 'info');

        const postContent = extractPostContent(post);

        if (!postContent || postContent.length < 5) {
            showToast('Could not read post', 'error');
            isProcessing = false;
            return;
        }

        await loadSettings();
        const style = settings?.defaultStyle || 'friendly';

        try {
            console.log('AI Comment: Sending request to generate...');
            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                postContent: postContent,
                style: style,
                customPrompt: settings?.customPrompt || ''
            });

            console.log('AI Comment: Response received:', response);

            if (!response || !response.success) {
                showToast(response?.error || 'Generation failed - check API key', 'error');
                isProcessing = false;
                return;
            }

            const comment = response.comment;
            console.log('AI Comment: Generated:', comment);

            if (!comment || comment.length < 2) {
                showToast('Empty comment received', 'error');
                isProcessing = false;
                return;
            }

            showToast('💬 Opening comment modal...', 'info');

            if (isExtensionValid()) {
                chrome.runtime.sendMessage({
                    action: 'updateStats',
                    statType: 'generated',
                    style: style
                });
            }

            // Find and click the comment icon to open modal
            const commentIcon = findCommentIcon(post);

            if (commentIcon) {
                commentIcon.click();

                // Wait for modal to open, then post
                setTimeout(() => {
                    postCommentInModal(comment);
                }, 1000);
            } else {
                showToast('Comment icon not found', 'error');
                isProcessing = false;
            }

        } catch (error) {
            console.error('AI Comment:', error);
            showToast(error.message || 'Error', 'error');
            isProcessing = false;
        }
    }

    function findCommentIcon(post) {
        const selectors = [
            'svg[aria-label="Comment"]',
            'svg[aria-label="comment"]',
            '[aria-label="Comment"]',
            '[aria-label="comment"]'
        ];

        for (const selector of selectors) {
            const icon = post.querySelector(selector);
            if (icon) {
                const clickable = icon.closest('button') ||
                    icon.closest('div[role="button"]') ||
                    icon.closest('span') ||
                    icon.parentElement;
                if (clickable) return clickable;
            }
        }

        const svgs = post.querySelectorAll('svg');
        for (const svg of svgs) {
            const parent = svg.parentElement;
            if (parent && parent.tagName !== 'BUTTON') {
                const rect = svg.getBoundingClientRect();
                if (rect.width >= 20 && rect.width <= 30) {
                    const clickable = svg.closest('button') || svg.closest('div[role="button"]') || parent;
                    const section = clickable.closest('section');
                    if (section) return clickable;
                }
            }
        }

        return null;
    }

    async function postCommentInModal(comment) {
        showToast('Posting comment...', 'info');

        // Wait for comment input in the modal
        const input = await waitForElement('textarea', 5000);

        if (!input) {
            showToast('Comment field not found', 'error');
            isProcessing = false;
            return;
        }

        // Focus and clear
        input.focus();
        input.click();
        await sleep(100);
        input.value = '';

        // Method 1: Simulate typing (most reliable for Instagram/React)
        await simulateTyping(input, comment);

        // Method 2: Fallback to native setter
        if (input.value !== comment) {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 'value'
            )?.set;

            if (nativeSetter) {
                nativeSetter.call(input, comment);
            } else {
                input.value = comment;
            }

            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Blur and refocus to trigger validation
        input.blur();
        await sleep(50);
        input.focus();

        await sleep(500);

        // Retry finding and clicking Post button
        let postBtn = null;
        let attempts = 0;
        const maxAttempts = 15;

        while (!postBtn && attempts < maxAttempts) {
            await sleep(300);
            postBtn = findPostButton();
            attempts++;

            if (!postBtn) {
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        if (postBtn) {
            // Check if disabled - sometimes it's a div without disabled attr but style changes
            if (postBtn.disabled || postBtn.style.opacity < '0.5') {
                showToast('Post button disabled - typing failed?', 'warning');
                // Try one last force update
                input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ' ', bubbles: true }));
            }

            postBtn.click();

            if (isExtensionValid()) {
                chrome.runtime.sendMessage({
                    action: 'updateStats',
                    statType: 'posted'
                });
            }
            showToast('✅ Comment posted!', 'success');
            setTimeout(() => closeModal(), 1500);

        } else {
            console.log('AI Comment: Could not find Post button. DOM state:', document.body.innerHTML.substring(0, 500));
            showToast('Post button not found (Click manually)', 'warning');
        }

        isProcessing = false;
    }

    async function simulateTyping(element, text) {
        element.focus();

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const keyEventParams = { key: char, code: `Key${char.toUpperCase()}`, bubbles: true };

            element.dispatchEvent(new KeyboardEvent('keydown', keyEventParams));
            element.dispatchEvent(new KeyboardEvent('keypress', keyEventParams));

            let inserted = false;
            if (document.execCommand) {
                try { inserted = document.execCommand('insertText', false, char); } catch (e) { }
            }

            if (!inserted) {
                element.value += char;
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                if (nativeSetter) nativeSetter.call(element, element.value);
            }

            element.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keyup', keyEventParams));

            await sleep(5 + Math.random() * 10);
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function findPostButton() {
        // Look for buttons OR divs with role="button" that have text "Post"
        const potentialButtons = document.querySelectorAll('div[role="dialog"] [role="button"], div[role="dialog"] button, form button');

        for (const btn of potentialButtons) {
            const text = btn.textContent.trim().toLowerCase();
            if (text === 'post') {
                return btn;
            }
        }
        return null; // Fallback
    }

    function closeModal() {
        // Method 1: Click Close button if found
        const closeBtn = document.querySelector('[aria-label="Close"]') ||
            document.querySelector('svg[aria-label="Close"]')?.parentElement;
        if (closeBtn) {
            closeBtn.click();
        }

        // Method 2: Simulate Escape key (works for most Instagram modals)
        const escEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
            view: window
        });
        document.dispatchEvent(escEvent);

        // Method 3: Click outside (backdrop)
        const backdrop = document.querySelector('div[role="presentation"] > div > div');
        if (backdrop) {
            // Try clicking the backdrop
            backdrop.click();
        }
    }

    function waitForElement(selector, timeout = 3000) {
        return new Promise((resolve) => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                return;
            }

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }, timeout);
        });
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function handleKeyboardShortcut() {
        // Placeholder
    }

})();
