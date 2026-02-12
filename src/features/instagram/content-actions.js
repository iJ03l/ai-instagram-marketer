// Instagram AI Comment Assistant - Actions & Interaction (Prod Grade)

(() => {
    'use strict';

    window.InstagramAssistant = window.InstagramAssistant || {};
    const utils = window.InstagramAssistant;
    const state = window.InstagramAssistant.state;


    // -------- typing (react-safe) --------

    utils.simulateTyping = async function (element, text) {
        if (!element) return false;

        // VERIFY: Already contains it?
        const startText = getComposerText(element).trim().toLowerCase();
        if (startText.includes(text.trim().toLowerCase().slice(0, 30))) return true;

        // Aggressive Focus Loop
        for (let i = 0; i < 3; i++) {
            window.focus();
            element.focus();
            element.click();
            await utils.sleep(100);
            if (document.activeElement === element) break;
        }

        const isCE = element.isContentEditable || element.getAttribute('contenteditable') === 'true';

        // 0) CLIPBOARD STRATEGY (Hybrid: Real Write + Synthetic Paste)
        try {
            await navigator.clipboard.writeText(text);
            element.focus();

            // Try A: Native Paste Command
            let pasted = false;
            if (document.execCommand('paste')) {
                await utils.sleep(80);
                if (checkVerify(element, text)) pasted = true;
            }

            // Try B: Synthetic Paste Event (The "React Hack")
            // If native paste failed or was blocked, force-feed the event.
            if (!pasted) {
                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: new DataTransfer()
                });
                pasteEvent.clipboardData.setData('text/plain', text);
                element.dispatchEvent(pasteEvent);

                // Often React needs an input event immediately after if it handled the paste
                await utils.sleep(50);
                if (checkVerify(element, text)) pasted = true;
            }

            if (pasted) return true;

        } catch (e) {
            console.warn('[Crixen] Clipboard/Synthetic paste failed', e);
        }

        const tryMethods = [
            // 1) execCommand (Standard)
            () => {
                if (!isCE) return false;
                document.execCommand('selectAll', false, null);
                return document.execCommand('insertText', false, text);
            },
            // 2) Event-based Replacement (Resilient)
            () => {
                element.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertReplacementText', data: text }));
                if (isCE) element.innerText = text;
                else element.value = text;
                element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: text }));
                return true;
            },
            // 3) Native setter (Textarea)
            () => {
                if (element.tagName !== 'TEXTAREA') return false;
                const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
                if (setter) setter.call(element, text);
                else element.value = text;
                element.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
                return true;
            },
            // 4) Fallback legacy
            () => {
                if (isCE) element.innerHTML = text;
                else element.value = text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        ];

        for (const method of tryMethods) {
            try {
                if (method()) {
                    await utils.sleep(150);
                    if (checkVerify(element, text)) return true;
                }
            } catch (e) { /* next */ }
        }

        return false;
    };

    function checkVerify(element, text) {
        const current = getComposerText(element).toLowerCase().replace(/[^a-z0-9]/g, '');
        const expected = text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25);
        return current.includes(expected);
    }

    function getComposerText(el) {
        if (!el) return '';
        if (el.tagName === 'TEXTAREA') return el.value || '';
        return el.textContent || '';
    }

    function normalizeForMatch(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, '') // remove punctuation, unicode-safe
            .trim();
    }

    async function waitForTextInContainer(container, text, timeoutMs = 6500) {
        const target = normalizeForMatch(text).slice(0, 120);
        if (!target) return false;

        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const current = normalizeForMatch(container?.innerText || '');
            if (current.includes(target)) return true;
            await utils.sleep(200);
        }
        return false;
    }

    async function ensurePostButtonEnabled(inputEl, container) {
        for (let i = 0; i < 20; i++) {
            const btn = utils.findPostButtonInContainer(container);
            if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
                btn.focus();
                return btn;
            }

            inputEl.focus();
            if (i % 2 === 0) {
                inputEl.dispatchEvent(new Event('blur', { bubbles: true }));
                await utils.sleep(50);
                inputEl.focus();
            }

            try {
                document.execCommand('insertText', false, ' ');
                await utils.sleep(30);
                document.execCommand('delete', false, null);
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            } catch {
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            }

            await utils.sleep(200);
        }
        return utils.findPostButtonInContainer(container);
    }

    async function verifyPosted({ dialogOrForm, comment }) {
        // Stricter verification:
        // 1) Wait for input to be clear
        // 2) Verify text appears in document EXCLUDING inputs

        const start = Date.now();
        while (Date.now() - start < 8500) {
            const input = await utils.waitForStrictInput(600, dialogOrForm);
            const val = getComposerText(input).trim();

            // If input is cleared, it's a strong success signal
            if (!val) {
                // Confirm it's actually in the doc now
                const appeared = await waitForTextInContainer(dialogOrForm, comment, 2000);
                if (appeared) return true;

                // If input is clear but we don't see the text yet, maybe it's still loading
                await utils.sleep(500);
                continue;
            }

            // If text is in doc but NOT only in input, it posted
            const onlyInInput = utils.isTextOnlyInInput(dialogOrForm, comment);
            if (!onlyInInput) {
                const docText = (dialogOrForm?.innerText || '').toLowerCase();
                const target = comment.trim().toLowerCase().slice(0, 50);
                if (docText.includes(target)) return true;
            }

            await utils.sleep(600);
        }

        return false;
    }

    utils.postCommentInModal = async function (comment, startUrl, providedInput = null) {
        utils.showToast('Posting...', 'info');

        let input = providedInput || (await utils.waitForStrictInput(6500));
        if (!input) {
            utils.showToast('Input not found. Click the box and try again.', 'warning');
            state.isProcessing = false;
            return false;
        }

        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await utils.sleep(250);

        input.focus();
        input.click();
        await utils.sleep(150);

        const typed = await utils.simulateTyping(input, comment);

        // If typed is false, it means we fell back to "Manual Paste Prompt" OR failed completely.
        // We should NOT proceed to auto-post.
        if (!typed) {
            // Toast is already shown by simulateTyping fallback
            state.isProcessing = false;
            return false;
        }

        await utils.sleep(350);

        const container = input.closest('form') || input.closest('div[role="dialog"]') || document.body;

        const beforeSnapshot = (container?.innerText || '').slice(0, 2000);
        const postBtn = await ensurePostButtonEnabled(input, container);

        if (!postBtn || postBtn.disabled) {
            utils.showToast('Post button not available', 'error');
            state.isProcessing = false;
            return false;
        }

        postBtn.click();

        let ok = await verifyPosted({ dialogOrForm: container, comment });

        // RETRY if not cleared (often happens on first click in React)
        if (!ok && !state.isAutoPilot) {
            utils.showToast('Retrying post...', 'info');
            input.focus();
            await utils.sleep(300);
            const retryBtn = await ensurePostButtonEnabled(input, container);
            retryBtn?.click();
            ok = await verifyPosted({ dialogOrForm: container, comment });
        }

        if (ok) {
            if (utils.isExtensionValid()) {
                chrome.runtime.sendMessage({ action: 'updateStats', statType: 'posted' }).catch(() => { });
            }

            utils.showToast('✅ Comment posted!', 'success');

            if (state.currentPost) state.currentPost.dataset.aiCommented = 'true';

            setTimeout(() => utils.closeModal(startUrl), 1200);

            state.isProcessing = false;
            return true;
        }

        utils.showToast('Post may not have sent. Check and retry.', 'warning');
        state.isProcessing = false;
        return false;
    };

    utils.handleGenerateClick = async function (post) {
        if (!utils.isExtensionValid()) {
            utils.showToast('Extension needs refresh', 'warning');
            return false;
        }

        // Strong single-flight lock
        if (state.isProcessing) {
            utils.showToast('Already processing...', 'warning');
            return false;
        }

        state.isProcessing = true;
        state.currentPost = post;

        const startUrl = window.location.href;

        try {
            utils.showToast('Analyzing + generating...', 'info');

            const postData = utils.extractPostContent?.(post);
            if (!postData?.text || postData.text.length < 8) {
                utils.showToast('No caption/context found. Skipping.', 'warning');
                post.dataset.aiCommented = 'skipped';
                state.isProcessing = false;
                return false;
            }

            await utils.loadSettings?.();
            const style = state.settings?.defaultStyle || 'friendly';

            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                postContent: postData.text,
                imageUrls: postData.images,
                style,
                customPrompt: state.settings?.customPrompt || '',
                platform: 'instagram',
                actionType: 'comment'
            });

            if (chrome.runtime.lastError) throw new Error('Extension context invalidated');

            if (!response?.success) {
                if (response?.code === 'AUTH_REQUIRED' || response?.error === 'AUTH_REQUIRED') {
                    utils.showAuthPrompt();
                } else if (response?.code === 'RATE_LIMITED') {
                    utils.showToast('Rate limited. Slow down a bit.', 'warning');
                } else {
                    utils.showToast(response?.error || 'Generation failed', 'error');
                }
                state.isProcessing = false;
                return false;
            }

            const comment = String(response.comment || '').trim();
            if (!comment) {
                utils.showToast('Empty comment received', 'error');
                state.isProcessing = false;
                return false;
            }

            // Evidence toast (v5)
            utils.showToast(`AI: "${comment.slice(0, 35)}..."`, 'success');

            if (utils.isExtensionValid()) {
                chrome.runtime.sendMessage({ action: 'updateStats', statType: 'generated', style }).catch(() => { });
            }

            utils.showToast('Opening comment box...', 'info');

            // FAST PATH: If an input is ALREADY visible in this post (inline), use it!
            const inlineInput = Array.from(post.querySelectorAll('textarea, [contenteditable="true"]'))
                .find(el => utils.isElementVisible(el));

            if (inlineInput) {
                utils.showToast('Using inline box...', 'info');
                return await utils.postCommentInModal(comment, startUrl, inlineInput);
            }

            const commentIcon = utils.findCommentIcon?.(post);
            if (!commentIcon) {
                utils.showToast('Comment icon not found', 'error');
                post.dataset.aiCommented = 'skipped';
                state.isProcessing = false;
                return false;
            }

            commentIcon.click();
            await utils.sleep(1000); // Wait longer for IG modal/animation

            // Prefer dialog input if it opened
            const dialogInput = await utils.waitForStrictInput(3500, document.querySelector('div[role="dialog"]'));
            const input = dialogInput || (await utils.waitForStrictInput(3000, post));

            if (!input) {
                utils.showToast('Comment input did not open', 'error');
                post.dataset.aiCommented = 'skipped';
                state.isProcessing = false;
                return false;
            }

            return await utils.postCommentInModal(comment, startUrl, input);
        } catch (e) {
            console.error('[Crixen IG] error', e);
            const msg = e?.message || String(e);
            if (/invalidat/i.test(msg)) utils.showToast('Extension updated. Refresh the page.', 'error');
            else utils.showToast(`Error: ${msg}`, 'error');
            state.isProcessing = false;
            return false;
        }
    };
})();