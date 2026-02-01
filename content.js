// Instagram AI Comment Assistant - Content Script

(function () {
    'use strict';

    let currentPost = null;
    let settings = null;
    let isProcessing = false;

    init();

    function init() {
        console.log('AI Comment Assistant: Initializing...');
        loadSettings();
        observeDOM();
        setTimeout(injectButtons, 1000);
        setInterval(injectButtons, 1500);

        try {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'triggerGenerate') {
                    handleKeyboardShortcut();
                }
            });
        } catch (e) {
            // Context invalid
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
        if (!isExtensionValid()) return;
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve(); return;
                    }
                    settings = response?.settings || { defaultStyle: 'friendly' };
                    resolve();
                });
            } catch (e) { resolve(); }
        });
    }

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
        const posts = document.querySelectorAll('article');
        posts.forEach((post) => {
            if (post.dataset.aiCommentInjected && post.querySelector('.ai-comment-btn-glass')) return;

            const actionBar = findActionBar(post);
            if (actionBar) {
                const existingBtn = actionBar.querySelector('.ai-comment-btn-glass');
                if (existingBtn) existingBtn.remove();

                const btn = createButton();
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.marginLeft = '8px';
                container.appendChild(btn);

                actionBar.appendChild(container);

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.debug('AI Comment: Button clicked');
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

    // IMPROVED CONTENT EXTRACTION WITH IMAGE URLs FOR VISION
    function extractPostContent(post) {
        const parts = [];
        let imageUrls = [];

        // 1. Get Author
        const usernameEl = post.querySelector('header h2') ||
            post.querySelector('header a') ||
            post.querySelector('a[href^="/"][role="link"] span') ||
            post.querySelector('div > span > a > span');

        if (usernameEl) {
            const username = usernameEl.textContent?.trim();
            if (username && username.length < 50 && !username.includes('Sponsored')) {
                parts.push(`Author: @${username}`);
            }
        }

        // 2. Get Caption
        let caption = '';
        const h1 = post.querySelector('h1');
        if (h1) {
            caption = h1.textContent;
        }
        if (!caption || caption.length < 5) {
            const captionContainer = post.querySelector('div > ul > li > div > div > div > span');
            if (captionContainer) {
                caption = captionContainer.textContent;
            }
        }
        if (caption) {
            const cleaned = caption.replace(/Verified/g, '').trim();
            if (cleaned.length > 0) parts.push(`Caption: "${cleaned.substring(0, 800)}"`);
        }

        // 3. Get Image URLs (for Vision models) AND Alt Text
        const images = post.querySelectorAll('img');
        let imageDescriptions = [];

        images.forEach((img) => {
            const src = img.src;
            const alt = img.alt?.trim();

            // Capture image URLs (skip profile pics and small icons)
            if (src && !src.includes('profile') && !src.includes('s150x150')) {
                // Get the main post image (usually larger)
                const rect = img.getBoundingClientRect();
                if (rect.width > 200 && rect.height > 200) {
                    imageUrls.push(src);
                }
            }

            // Also capture alt text for non-vision fallback
            if (alt && alt.length > 5 &&
                !alt.includes('profile picture') &&
                !alt.includes('Photo by') &&
                !imageDescriptions.includes(alt)) {
                imageDescriptions.push(alt);
            }
        });

        if (imageDescriptions.length > 0) {
            parts.push(`Image Alt Text: ${imageDescriptions.join('. ')}`);
        }

        const textContent = parts.join('\n');
        console.log('AI Comment Extracted Content:\n', textContent);
        console.log('AI Comment Image URLs:', imageUrls);

        return {
            text: textContent || 'Instagram post',
            images: imageUrls.slice(0, 2) // Max 2 images for API
        };
    }

    function showToast(message, type = 'info') {
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
    }

    async function handleGenerateClick(post) {
        if (!isExtensionValid()) {
            showToast('Reloading needs refresh', 'warning');
            return;
        }

        if (isProcessing) {
            const lastClick = parseInt(post.dataset.lastClickTime || '0');
            const now = Date.now();
            if (now - lastClick > 10000) {
                isProcessing = false;
            } else {
                showToast('Generating... please wait', 'warning');
                return;
            }
        }

        const startUrl = window.location.href;

        currentPost = post;
        isProcessing = true;
        post.dataset.lastClickTime = Date.now().toString();

        showToast('🤖 Analyzing post & generating...', 'info');

        const postData = extractPostContent(post);

        if (!postData.text || postData.text.length < 10) {
            console.warn('AI Comment: Content extraction unreliable', postData);
        }

        await loadSettings();
        const style = settings?.defaultStyle || 'friendly';

        try {
            console.debug('AI Comment: Sending request with vision data...');
            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                postContent: postData.text,
                imageUrls: postData.images, // NEW: Send image URLs for vision
                style: style,
                customPrompt: settings?.customPrompt || ''
            });

            if (chrome.runtime.lastError) throw new Error('Extension context invalidated');

            if (!response || !response.success) {
                showToast(response?.error || 'Generation failed', 'error');
                isProcessing = false;
                return;
            }

            const comment = response.comment;

            if (!comment) {
                showToast('Empty comment received', 'error');
                isProcessing = false;
                return;
            }

            showToast('💬 Opening modal...', 'info');

            if (isExtensionValid()) {
                chrome.runtime.sendMessage({
                    action: 'updateStats',
                    statType: 'generated',
                    style: style
                });
            }

            const commentIcon = findCommentIcon(post);

            if (commentIcon) {
                commentIcon.click();
                setTimeout(() => {
                    postCommentInModal(comment, startUrl);
                }, 1000);
            } else {
                showToast('Comment icon not found', 'error');
                isProcessing = false;
            }

        } catch (error) {
            console.error('AI Comment:', error);
            showToast('Error: ' + error.message, 'error');
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
    }

    async function postCommentInModal(comment, startUrl) {
        showToast('Posting...', 'info');

        const input = await waitForStrictInput(5000);

        if (!input) {
            showToast('Input not found (Strict Mode)', 'error');
            isProcessing = false;
            return;
        }

        console.log('AI Comment: Found strict input:', input);

        input.focus();
        input.click();
        await sleep(150);

        if (input.tagName === 'TEXTAREA') {
            input.value = '';
        } else {
            input.innerHTML = '<br>';
        }

        await simulateTyping(input, comment);

        const currentVal = input.tagName === 'TEXTAREA' ? input.value : input.textContent;
        if (!currentVal || currentVal.trim() !== comment.trim()) {
            console.warn('AI Comment: Mismatch detected, forcing value...');
            input.focus();
            if (input.tagName === 'TEXTAREA') {
                input.value = comment;
            } else {
                input.innerText = comment;
            }
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            try {
                const textEvent = document.createEvent('TextEvent');
                textEvent.initTextEvent('textInput', true, true, null, comment, 9, "en-US");
                input.dispatchEvent(textEvent);
            } catch (e) { }
        }

        input.blur();
        await sleep(50);
        input.focus();
        await sleep(600);

        const container = input.closest('form') || input.closest('div[role="dialog"]') || document.body;
        let postBtn = null;
        let attempts = 0;
        const maxAttempts = 15;

        while (!postBtn && attempts < maxAttempts) {
            await sleep(300);
            postBtn = findPostButtonInContainer(container);
            attempts++;
            if (!postBtn) {
                input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ' ', bubbles: true }));
            }
        }

        if (postBtn) {
            if (postBtn.disabled || postBtn.style.opacity < '0.5') {
                input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: '.', bubbles: true }));
                setTimeout(() => {
                    input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', data: null, bubbles: true }));
                }, 50);
            }

            postBtn.click();

            if (isExtensionValid()) {
                chrome.runtime.sendMessage({ action: 'updateStats', statType: 'posted' });
            }
            showToast('✅ Comment posted!', 'success');
            setTimeout(() => closeModal(startUrl), 1500);

        } else {
            console.log('AI Comment: no post button found');
            showToast('Post button not found', 'warning');
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
                try {
                    inserted = document.execCommand('insertText', false, char);
                } catch (e) { }
            }

            if (!inserted) {
                if (element.tagName === 'TEXTAREA') {
                    element.value += char;
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                    if (nativeSetter) nativeSetter.call(element, element.value);
                } else {
                    element.textContent += char;
                }
            }

            const inputEvent = new InputEvent('input', {
                inputType: 'insertText',
                data: char,
                bubbles: true,
                cancelable: false,
                composed: true
            });
            element.dispatchEvent(inputEvent);

            element.dispatchEvent(new KeyboardEvent('keyup', keyEventParams));
            await sleep(5 + Math.random() * 10);
        }
        return true;
    }

    function findPostButtonInContainer(container) {
        const potentialButtons = container.querySelectorAll('[role="button"], button');
        for (const btn of potentialButtons) {
            const text = btn.textContent.trim().toLowerCase();
            if (text === 'post') return btn;
        }
        if (container !== document.body) {
            const globalBtns = document.querySelectorAll('div[role="dialog"] [role="button"], div[role="dialog"] button');
            for (const btn of globalBtns) {
                if (btn.textContent.trim().toLowerCase() === 'post') return btn;
            }
        }
        return null;
    }

    function closeModal(startUrl) {
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
    }

    function waitForStrictInput(timeout = 3000) {
        return new Promise((resolve) => {
            const check = () => {
                const dialogInputs = document.querySelectorAll('div[role="dialog"] textarea, div[role="dialog"] [contenteditable="true"][role="textbox"]');
                for (const el of dialogInputs) {
                    if (isElementVisible(el)) return el;
                }
                const allInputs = document.querySelectorAll('textarea, [contenteditable="true"][role="textbox"]');
                for (const el of allInputs) {
                    if (isElementVisible(el)) return el;
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
    }

    function isElementVisible(el) {
        if (!el) return false;
        if (el.offsetParent === null) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return true;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function handleKeyboardShortcut() {
        if (currentPost) handleGenerateClick(currentPost);
    }

})();
