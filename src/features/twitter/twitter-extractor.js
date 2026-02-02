// SMITH ai - Twitter Content Extractor

(function () {
    'use strict';

    window.SmithTwitter = window.SmithTwitter || {};

    window.SmithTwitter.extractTweetContent = function (tweetElement) {
        const parts = [];

        // 1. Author
        const userElement = tweetElement.querySelector('[data-testid="User-Name"]');
        if (userElement) {
            // Usually contains Name and @handle
            const text = userElement.textContent;
            parts.push(`Author: ${text}`);
        }

        // 2. Tweet Text
        const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
        if (textElement) {
            const text = textElement.textContent;
            parts.push(`Tweet: "${text}"`);
        }

        // 3. Images (Vision Support) or Quote Tweets
        const photos = tweetElement.querySelectorAll('[data-testid="tweetPhoto"] img');
        const imageUrls = [];
        photos.forEach(img => {
            if (img.src) imageUrls.push(img.src);
        });

        // Check for Quoted Status
        const quote = tweetElement.querySelector('[role="link"][href*="/status/"]');
        // Note: Quoted tweets are complex, basic extraction for now.

        const content = parts.join('\n');
        return {
            text: content || 'Empty Tweet',
            images: imageUrls.slice(0, 2)
        };
    };

})();
