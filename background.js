// Instagram AI Comment Assistant - Background Service Worker
// All models powered by NEAR AI Cloud (cloud.near.ai)

const NEAR_AI_ENDPOINT = 'https://cloud-api.near.ai/v1/chat/completions';
const API_TIMEOUT = 45000; // Increased for vision processing

const AI_MODELS = {
    'deepseek': {
        name: 'DeepSeek V3.1',
        model: 'deepseek-ai/DeepSeek-V3.1',
        description: '128K context • $1.05/M input • Cheapest',
        vision: false
    },
    'openai': {
        name: 'OpenAI GPT-5.2',
        model: 'openai/gpt-5.2',
        description: '400K context • $1.8/M input • Vision enabled',
        vision: true
    },
    'claude': {
        name: 'Claude Sonnet 4.5',
        model: 'anthropic/claude-sonnet-4-5',
        description: '200K context • $3/M input • Best vision',
        vision: true
    }
};

const COMMENT_STYLES = {
    friendly: {
        name: 'Friendly',
        prompt: 'Generate a warm, supportive, friendly comment. Include 1-2 relevant emojis. Keep it genuine.'
    },
    professional: {
        name: 'Professional',
        prompt: 'Generate a polished, business-appropriate comment. Be thoughtful. Minimal emojis.'
    },
    casual: {
        name: 'Casual',
        prompt: 'Generate a relaxed, conversational comment like talking to a friend.'
    },
    enthusiastic: {
        name: 'Enthusiastic',
        prompt: 'Generate an energetic, excited comment! Show enthusiasm. Use emojis!'
    },
    witty: {
        name: 'Witty',
        prompt: 'Generate a clever, witty comment with subtle humor. Be smart but not mean.'
    }
};

// Initialize
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['settings', 'stats'], (result) => {
        if (!result.settings) {
            chrome.storage.local.set({
                settings: {
                    selectedModel: 'deepseek',
                    apiKey: '',
                    defaultStyle: 'friendly',
                    customPrompt: ''
                }
            });
        }
        if (!result.stats) {
            chrome.storage.local.set({
                stats: {
                    generated: 0,
                    posted: 0,
                    byStyle: {}
                }
            });
        }
    });
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        try {
            switch (request.action) {
                case 'generateComment':
                    const comment = await generateComment(
                        request.postContent,
                        request.style,
                        request.customPrompt,
                        request.imageUrls // NEW: Pass image URLs
                    );
                    sendResponse({ success: true, comment });
                    break;

                case 'getSettings':
                    const settings = await getSettings();
                    sendResponse({ settings, models: AI_MODELS, styles: COMMENT_STYLES });
                    break;

                case 'saveSettings':
                    await chrome.storage.local.set({ settings: request.settings });
                    sendResponse({ success: true });
                    break;

                case 'getStats':
                    const stats = await getStats();
                    sendResponse({ stats });
                    break;

                case 'updateStats':
                    await updateStats(request.statType, request.style);
                    sendResponse({ success: true });
                    break;

                case 'testConnection':
                    const testResult = await testApiConnection(request.apiKey);
                    sendResponse(testResult);
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background error:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
});

async function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get('settings', (result) => {
            resolve(result.settings || {
                selectedModel: 'deepseek',
                apiKey: '',
                defaultStyle: 'friendly'
            });
        });
    });
}

async function getStats() {
    return new Promise((resolve) => {
        chrome.storage.local.get('stats', (result) => {
            resolve(result.stats || { generated: 0, posted: 0, byStyle: {} });
        });
    });
}

async function updateStats(statType, style) {
    const stats = await getStats();
    if (statType === 'generated') {
        stats.generated = (stats.generated || 0) + 1;
        if (style) {
            stats.byStyle = stats.byStyle || {};
            stats.byStyle[style] = (stats.byStyle[style] || 0) + 1;
        }
    } else if (statType === 'posted') {
        stats.posted = (stats.posted || 0) + 1;
    }
    await chrome.storage.local.set({ stats });
}

async function testApiConnection(apiKey) {
    const cleanedKey = apiKey ? apiKey.replace(/[<>\s]/g, '') : '';

    if (!cleanedKey) {
        return { success: false, error: 'No API key provided' };
    }

    try {
        const response = await fetch(NEAR_AI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanedKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-ai/DeepSeek-V3.1',
                messages: [{ role: 'user', content: 'Say OK' }],
                max_tokens: 5
            })
        });

        if (response.ok) {
            return { success: true, message: 'API connection successful!' };
        } else {
            const text = await response.text();
            let errorMsg = `HTTP ${response.status}`;
            try {
                const data = JSON.parse(text);
                errorMsg = data.error?.message || errorMsg;
            } catch (e) { }
            return { success: false, error: errorMsg };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function generateComment(postContent, style, customPrompt = '', imageUrls = []) {
    const settings = await getSettings();
    const modelKey = settings.selectedModel || 'deepseek';
    const modelConfig = AI_MODELS[modelKey];

    // Clean API key
    let apiKey = settings.apiKey ? settings.apiKey.replace(/[<>\s]/g, '') : '';

    if (!apiKey) {
        throw new Error('No API key. Get one at cloud.near.ai - Check extension settings.');
    }

    if (!modelConfig) {
        throw new Error('Invalid model selected');
    }

    const stylePrompt = style === 'custom' && customPrompt
        ? customPrompt
        : COMMENT_STYLES[style]?.prompt || COMMENT_STYLES.friendly.prompt;

    const globalInstructions = settings.instructions ? `\nAdditional Instructions: ${settings.instructions}` : '';

    // Determine if we should use vision
    const useVision = modelConfig.vision && imageUrls && imageUrls.length > 0;

    const systemPrompt = `You are an Instagram comment assistant. Generate a relevant and engaging comment.

ABSOLUTE RULES:
- NEVER ask the user for images, uploads, or more information.
- NEVER say you cannot see the image or need more context.
- ALWAYS generate a comment based on whatever context is provided.
- If visual details are missing, use the caption/author info creatively.
- Length: Natural for the context.
- Do NOT summarize the post.
- Be casual and human, not robotic.
- React directly to what's described or shown.
${useVision ? '- If you can see the image: reference specific visual elements or text in it.' : ''}
- No hashtags unless asked.
- No emoji overload.
- No generic praise ("Great shot!", "Nice!"). Be specific.
- Do NOT use em dashes (—).

Style: ${stylePrompt}${globalInstructions}`;

    // Build user message content
    let userMessageContent;

    if (useVision) {
        // Vision-enabled format: array of text and image_url objects
        console.log('AI Comment: Using VISION mode with', imageUrls.length, 'image(s)');

        userMessageContent = [
            {
                type: 'text',
                text: `Context (Author & Caption):
${postContent}

Task: Look at the image carefully. Read any text, memes, quotes, or messages visible in it. Write a comment that reacts specifically to what you see.`
            }
        ];

        // Add images
        for (const url of imageUrls) {
            userMessageContent.push({
                type: 'image_url',
                image_url: {
                    url: url,
                    detail: 'auto' // Let the model decide resolution
                }
            });
        }
    } else {
        // Text-only format
        userMessageContent = `Context (Author & Caption & Image tags):
${postContent}

Task: Write a comment. Matches the context/vibe.`;
    }

    console.log('Calling NEAR AI Cloud:', modelConfig.model, useVision ? '(Vision)' : '(Text-only)');

    try {
        const response = await fetchWithTimeout(NEAR_AI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelConfig.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessageContent }
                ],
                max_tokens: 200,
                temperature: 0.8
            })
        }, API_TIMEOUT);

        console.log('NEAR AI status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('NEAR AI Raw Error:', errorText);

            let errorMessage = `API Error ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error?.message || errorMessage;
            } catch (e) {
                if (response.status === 401) errorMessage = 'Invalid API Key. Check settings.';
                if (response.status === 429) errorMessage = 'Rate limit exceeded.';
                if (response.status === 500) errorMessage = 'NEAR AI Server Error.';
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('NEAR AI response:', data);

        const comment = data.choices?.[0]?.message?.content?.trim();

        if (!comment) {
            throw new Error('Empty response from AI');
        }

        return comment.replace(/^["']|["']$/g, '').trim();

    } catch (error) {
        console.error('Generation error:', error);
        throw error;
    }
}

async function fetchWithTimeout(url, options, timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
}
