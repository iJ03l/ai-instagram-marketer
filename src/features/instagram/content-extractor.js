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
            post.querySelector('div > span > a > span') ||
            // Fallback for Reels: Find the first link that looks like a username
            Array.from(post.querySelectorAll('a')).find(a =>
                a.href.includes('/') &&
                a.innerText.length > 2 &&
                !a.href.includes('/explore/') &&
                // Allow /reels/ only if it follows a username (e.g. /user/reels/)
                (!a.href.includes('/reels/') || a.href.match(/\/[^\/]+\/reels\/?$/)) &&
                !a.innerText.includes('Follow')
            );

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

        // Fallback: Check the first <li> in the comment section (common structure)
        if (!caption || caption.length < 5) {
            const possibleCaption = post.querySelector('div > ul > li > div > div > div > span') ||
                post.querySelector('ul li span._aacl') ||
                post.querySelector('ul > li:first-child span') ||
                // Reels specific: div[dir="auto"] often holds the caption
                post.querySelector('div[dir="auto"] > span') ||
                // Another common Reels caption container pattern
                post.querySelector('.x1g9anri span');

            if (possibleCaption) {
                caption = possibleCaption.textContent;
            }
        }

        // Fallback 2: Look for text content near the username
        if (!caption && parts.length > 0) {
            const authorLine = parts[0]; // "Author: @username"
            const username = authorLine.split('@')[1];
            if (username) {
                // Find all spans having text
                const spans = post.querySelectorAll('span');
                for (const span of spans) {
                    // If span is long enough and seemingly near the top, might be caption
                    // This is "best effort"
                    if (span.textContent.length > 20 && !span.textContent.includes(username)) {
                        // potential caption
                    }
                }
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

        // if (imageDescriptions.length > 0) {
        //     parts.push(`Image Alt Text: ${imageDescriptions.join('. ')}`);
        // }

        if (parts.length === 0) {
            console.warn('AI Comment: No caption or image alt text found.');
            return null;
        }

        const textContent = parts.join('\n');
        console.log('AI Comment Extracted Content:\n', textContent);
        console.log('AI Comment Image URLs:', imageUrls);

        return {
            text: textContent,
            images: imageUrls.slice(0, 2) // Max 2 images for API
        };
    };

})();
