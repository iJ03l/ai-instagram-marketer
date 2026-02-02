// Instagram AI Comment Assistant - Actions & Interaction

(function () {
    'use strict';

    window.InstagramAssistant = window.InstagramAssistant || {};

    // Shortcuts to utils and state
    const utils = window.InstagramAssistant;
    const state = window.InstagramAssistant.state;

    // --- TYPING SIMULATION ---
    window.InstagramAssistant.simulateTyping = async function (element, text) {
        window.focus();
        element.focus();
        await utils.sleep(50);

        // Method 1: execCommand 'insertText' (Standard for ContentEditable)
        // We do NOT clear innerHTML manually, as it breaks React's tracking.
        // Instead we select all and replace.
        let success = false;
        if (element.contentEditable === 'true' || element.getAttribute('contenteditable') === 'true') {
            try {
                // Ensure focus is really on the element
                if (document.activeElement !== element) {
                    element.focus();
                }

                // Select all content first
                document.execCommand('selectAll', false, null);
                // Then insert text (replaces selection)
                if (document.execCommand('insertText', false, text)) {
                    success = true;
                }
            } catch (e) {
                console.log('AI Comment: execCommand failed', e);
            }
        }

        // Verification after Method 1
        let currentVal = element.tagName === 'TEXTAREA' ? element.value : element.textContent;
        if (success && currentVal && currentVal.length > 0) {
            element.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }

        console.log('AI Comment: Method 1 failed or empty, trying Method 2 (Direct + Events)');

        // Method 2: Direct Manipulation with robust event sequence
        if (element.tagName === 'TEXTAREA') {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (nativeSetter) {
                nativeSetter.call(element, text);
            } else {
                element.value = text;
            }
        } else {
            element.textContent = text;
        }

        // Fire events to notify frameworks (React, etc)
        const events = [
            new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }),
            new Event('input', { bubbles: true }),
            new Event('change', { bubbles: true }),
            new KeyboardEvent('keydown', { bubbles: true, key: 'a' }),
            new KeyboardEvent('keyup', { bubbles: true, key: 'a' }),
            new Event('blur', { bubbles: true }),
            new Event('focus', { bubbles: true }) // refocus to ensure active state
        ];

        for (const evt of events) {
            element.dispatchEvent(evt);
        }

        // Final fallback: Clipboard if still empty?
        // Usually Direct + Events is enough. 
        // We just ensure we wait a bit for React to process.
        await utils.sleep(100);
        return true;
    };

    window.InstagramAssistant.postCommentInModal = async function (comment, startUrl) {
        utils.showToast('Posting...', 'info');

        const input = await utils.waitForStrictInput(5000);

        if (!input) {
            utils.showToast('Input not found (Strict Mode)', 'error');
            state.isProcessing = false;
            return;
        }

        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await utils.sleep(300); // Wait for scroll
        input.focus();
        input.click();
        await utils.sleep(150);

        console.log('AI Comment: Found strict input:', input);

        await utils.simulateTyping(input, comment);

        input.blur();
        await utils.sleep(50);
        input.focus();
        await utils.sleep(600);

        const container = input.closest('form') || input.closest('div[role="dialog"]') || document.body;
        let postBtn = null;
        let attempts = 0;
        const maxAttempts = 15;

        while (!postBtn && attempts < maxAttempts) {
            await utils.sleep(300);
            postBtn = utils.findPostButtonInContainer(container);
            attempts++;
            if (!postBtn) {
                input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ' ', bubbles: true }));
            }
        }

        if (postBtn) {
            if (postBtn.disabled || postBtn.style.opacity < '0.5') {
                // If button is still disabled, it means the input events didn't register.
                // Try one more distinct input event sequence that usually wakes up React.
                console.warn('AI Comment: Post button disabled, trying to wake React...');
                input.focus();
                document.execCommand('insertText', false, ' ');
                await utils.sleep(50);
                document.execCommand('delete'); // Undo the space
                await utils.sleep(50);
            }

            // Double check
            if (postBtn.disabled) {
                console.error('AI Comment: Failed to enable post button');
                utils.showToast('Failed to insert text correctly', 'error');
                state.isProcessing = false;
                return;
            }

            postBtn.click();

            if (utils.isExtensionValid()) {
                chrome.runtime.sendMessage({ action: 'updateStats', statType: 'posted' });
            }
            utils.showToast('✅ Comment posted!', 'success');

            // Mark as commented for Auto-Pilot
            if (state.currentPost) {
                state.currentPost.dataset.aiCommented = 'true';
            }

            setTimeout(() => utils.closeModal(startUrl), 1500);

        } else {
            console.log('AI Comment: no post button found');
            utils.showToast('Post button not found', 'warning');
        }

        state.isProcessing = false;
    };

    window.InstagramAssistant.handleGenerateClick = async function (post) {
        if (!utils.isExtensionValid()) {
            utils.showToast('Reloading needs refresh', 'warning');
            return;
        }

        if (state.isProcessing) {
            const lastClick = parseInt(post.dataset.lastClickTime || '0');
            const now = Date.now();
            if (now - lastClick > 10000) {
                state.isProcessing = false;
            } else {
                utils.showToast('Generating... please wait', 'warning');
                return;
            }
        }

        const startUrl = window.location.href;

        state.currentPost = post;
        state.isProcessing = true;
        post.dataset.lastClickTime = Date.now().toString();

        utils.showToast('🤖 Analyzing post & generating...', 'info');

        const postData = utils.extractPostContent(post);

        if (!postData.text || postData.text.length < 10) {
            console.warn('AI Comment: Content extraction unreliable', postData);
        }

        await utils.loadSettings();
        const style = state.settings?.defaultStyle || 'friendly';

        try {
            console.debug('AI Comment: Sending request with vision data...');
            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                postContent: postData.text,
                imageUrls: postData.images, // NEW: Send image URLs for vision
                style: style,
                customPrompt: state.settings?.customPrompt || ''
            });

            if (chrome.runtime.lastError) throw new Error('Extension context invalidated');

            if (!response || !response.success) {
                utils.showToast(response?.error || 'Generation failed', 'error');
                state.isProcessing = false;
                return;
            }

            const comment = response.comment;

            if (!comment) {
                utils.showToast('Empty comment received', 'error');
                state.isProcessing = false;
                return;
            }

            utils.showToast('💬 Opening modal...', 'info');

            if (utils.isExtensionValid()) {
                chrome.runtime.sendMessage({
                    action: 'updateStats',
                    statType: 'generated',
                    style: style
                });
            }

            const commentIcon = utils.findCommentIcon(post);

            if (commentIcon) {
                commentIcon.click();
                setTimeout(() => {
                    utils.postCommentInModal(comment, startUrl);
                }, 1000);
            } else {
                utils.showToast('Comment icon not found', 'error');
                state.isProcessing = false;
            }

        } catch (error) {
            console.error('AI Comment:', error);
            if (error.message.includes('validat')) { // Matches 'invalidated' or 'context invalid'
                utils.showToast('Extension updated: Please REFRESH page!', 'error');
            } else {
                utils.showToast('Error: ' + error.message, 'error');
            }
            state.isProcessing = false;
        }
    };

})();
