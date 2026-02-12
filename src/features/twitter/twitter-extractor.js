// Crixen - Twitter Content Extractor (Prod Grade)

(() => {
    'use strict';

    window.CrixenTwitter = window.CrixenTwitter || {};
    const utils = window.CrixenTwitter;

    function clean(s) {
        return String(s || '').replace(/\s+/g, ' ').trim();
    }

    utils.extractTweetContent = function (tweetElement) {
        const parts = [];
        const imageUrls = [];

        // Author
        const userElement = tweetElement.querySelector('[data-testid="User-Name"]');
        const authorText = clean(userElement?.textContent);
        if (authorText) parts.push(`Author: ${authorText}`);

        // Tweet text
        const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
        const text = clean(textElement?.textContent);
        if (text) parts.push(`Tweet: "${text}"`);

        // Quoted tweet (best-effort)
        const quoted = tweetElement.querySelector('article [data-testid="tweetText"]');
        const quotedText = clean(quoted?.textContent);
        if (quotedText && quotedText !== text) parts.push(`Quoted: "${quotedText}"`);

        // Images
        tweetElement.querySelectorAll('[data-testid="tweetPhoto"] img').forEach((img) => {
            const src = img.currentSrc || img.src;
            if (src && !imageUrls.includes(src)) imageUrls.push(src);
        });

        const content = parts.join('\n');
        return {
            text: content || 'Empty Tweet',
            images: imageUrls.slice(0, 2)
        };
    };
})();