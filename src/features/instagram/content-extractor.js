// Instagram AI Comment Assistant - Content Extractor

(function () {
    'use strict';

    window.InstagramAssistant = window.InstagramAssistant || {};

    // IMPROVED CONTENT EXTRACTION WITH IMAGE URLs FOR VISION
    window.InstagramAssistant.extractPostContent = function (post) {
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
    };

})();
