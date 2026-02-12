// Instagram AI Comment Assistant - Content Extractor (Prod Grade)

(() => {
    'use strict';

    window.InstagramAssistant = window.InstagramAssistant || {};
    const utils = window.InstagramAssistant;

    function cleanText(s) {
        return String(s || '')
            .replace(/\s+/g, ' ')
            .replace(/Verified/g, '')
            .trim();
    }

    utils.extractPostContent = function (post) {
        const parts = [];
        const imageUrls = [];

        // Author (best effort)
        const usernameEl =
            post.querySelector('header h2') ||
            post.querySelector('header a') ||
            post.querySelector('a[href^="/"][role="link"] span') ||
            Array.from(post.querySelectorAll('a')).find((a) => {
                const t = (a.innerText || '').trim();
                if (t.length < 2 || t.length > 40) return false;
                if (/follow/i.test(t)) return false;
                const href = a.getAttribute('href') || '';
                if (!href.startsWith('/')) return false;
                if (href.includes('/explore/')) return false;
                return true;
            });

        const username = cleanText(usernameEl?.textContent);
        if (username && !/sponsored/i.test(username)) parts.push(`Author: @${username}`);

        // Caption
        let caption = '';

        const h1 = post.querySelector('h1');
        if (h1) caption = cleanText(h1.textContent);

        if (!caption || caption.length < 5) {
            const possible =
                post.querySelector('div > ul > li > div > div > div > span') ||
                post.querySelector('ul > li:first-child span') ||
                post.querySelector('div[dir="auto"] > span') ||
                post.querySelector('span[dir="auto"]');
            caption = cleanText(possible?.textContent);
        }

        if (caption) parts.push(`Caption: "${caption.substring(0, 900)}"`);

        // Media URLs (vision models) + alt text fallback (optional)
        const imgs = post.querySelectorAll('img');
        const alts = [];

        imgs.forEach((img) => {
            const src = img.currentSrc || img.src;
            const alt = cleanText(img.alt);

            const rect = img.getBoundingClientRect();
            const isBig = rect.width > 220 && rect.height > 220;

            if (src && isBig && !src.includes('profile') && !src.includes('s150x150')) {
                if (!imageUrls.includes(src)) imageUrls.push(src);
            }

            if (alt && alt.length > 10 && !/profile picture/i.test(alt) && !/photo by/i.test(alt)) {
                if (!alts.includes(alt)) alts.push(alt);
            }
        });

        // If no caption, include alt text to keep “specificity” possible
        if (!caption && alts.length) {
            parts.push(`Image context: ${alts.slice(0, 2).join(' | ')}`);
        }

        if (!parts.length) return null;

        return {
            text: parts.join('\n'),
            images: imageUrls.slice(0, 2)
        };
    };
})();