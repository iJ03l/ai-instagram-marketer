// Instagram AI Comment Assistant - Background Service Worker
// All models powered by NEAR AI Cloud (cloud.near.ai)

const NEAR_AI_ENDPOINT = 'https://cloud-api.near.ai/v1/chat/completions';
const API_TIMEOUT = 30000;

const AI_MODELS = {
    'deepseek': {
        name: 'DeepSeek V3.1',
        model: 'deepseek-ai/DeepSeek-V3.1',
        description: '128K context • $1.05/M input • Cheapest'
    },
    'openai': {
        name: 'OpenAI GPT-5.2',
        model: 'openai/gpt-5.2',
        description: '400K context • $1.8/M input • Deep reasoning'
    },
    'claude': {
        name: 'Claude Sonnet 4.5',
        model: 'anthropic/claude-sonnet-4-5',
        description: '200K context • $3/M input • Best quality'
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
                        request.customPrompt
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
    // Clean key
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

async function generateComment(postContent, style, customPrompt = '') {
    const settings = await getSettings();
    const modelKey = settings.selectedModel || 'deepseek';
    const modelConfig = AI_MODELS[modelKey];

    // Clean API key (remove < > and whitespace)
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

    const systemPrompt = `You are an Instagram comment assistant. Your goal is to generate a relevant and engaging comment.

CRITICAL RULES:
- Length: Natural and appropriate for the context (can be short or long).
- Do NOT summarize the post.
- Do NOT sound like a bot. Be casual and human.
- React directly to the visual element or the sentiment.
- No hashtags unless asked.
- No emoji overload.
- No generic praise ("Great shot!", "Nice!"). Be specific to the content.
- Do NOT use em dashes (—).

Style: ${stylePrompt}${globalInstructions}`;

    const userPrompt = `Context (Author & Caption & Image tags):
${postContent}

Task: Write a comment. Matches the context/vibe.`;

    console.log('Calling NEAR AI Cloud:', modelConfig.model);

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
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 150,
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
