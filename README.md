# Instagram AI Comment Assistant

A Chrome extension that adds AI-powered comment generation to Instagram posts using NEAR AI Cloud.

![Version](https://img.shields.io/badge/version-1.0.0-black)
![Manifest](https://img.shields.io/badge/manifest-v3-green)

## ✨ Features

- 🤖 **AI Comment Generation** - Generate contextual comments for any Instagram post
- 🎨 **Multiple Styles** - Friendly, Professional, Casual, Enthusiastic, Marketing, or Custom
- 🔌 **3 AI Models** via NEAR AI Cloud:
  - **DeepSeek V3.1** - 128K context, $1.05/M input (Cheapest)
  - **OpenAI GPT-5.2** - 400K context, $1.8/M input (Deep reasoning)
  - **Claude Sonnet 4.5** - 200K context, $3/M input (Best for coding)
- ⌨️ **Keyboard Shortcut** - Press `Ctrl+Shift+G` to generate instantly
- 📊 **Usage Statistics** - Track your generated and posted comments
- 🌙 **Dark Theme** - Sleek, Instagram-matching design

## 📦 Installation

### Step 1: Download the Extension

1. Download or clone this repository
2. Extract the files to a folder on your computer

### Step 2: Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `instagram-ai-comment-assistant` folder

### Step 3: Get Your NEAR AI API Key

1. Visit [cloud.near.ai](https://cloud.near.ai/)
2. Sign up or log in
3. Generate an API key
4. Copy the key

### Step 4: Configure the Extension

1. Click the extension icon in Chrome toolbar
2. Paste your NEAR AI API key
3. Choose your preferred AI model
4. Select your default comment style
5. Click **Save Settings**

## 🚀 Quick Start

1. Go to [instagram.com](https://www.instagram.com)
2. Find any post with an **AI Comment** button
3. Click the button or press `Ctrl+Shift+G`
4. Review the generated comment in the preview modal
5. Edit if needed, then click **Insert Comment**
6. Click Instagram's Post button to submit

## 🤖 AI Models (via NEAR AI Cloud)

| Model | Context | Input Cost | Best For |
|-------|---------|------------|----------|
| **DeepSeek V3.1** | 128K | $1.05/M tokens | Cheapest, great quality |
| **OpenAI GPT-5.2** | 400K | $1.8/M tokens | Deep reasoning, large context |
| **Claude Sonnet 4.5** | 200K | $3/M tokens | Coding, creative tasks |

All models use the same NEAR AI Cloud API key!

## 🎨 Comment Styles

| Style | Description |
|-------|-------------|
| 😊 **Friendly** | Warm, supportive comments with emojis |
| 💼 **Professional** | Business-appropriate, polished comments |
| 🎯 **Casual** | Relaxed, conversational tone |
| 🎉 **Enthusiastic** | High-energy, excited comments |
| 📈 **Marketing** | Engaging, connection-building comments |
| ✏️ **Custom** | Your own prompt instructions |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+G` | Generate comment for visible post |
| `Escape` | Close preview modal |

**Mac users**: Use `Cmd+Shift+G` instead

## 🔧 Troubleshooting

### "No API key configured" Error
- Open extension settings (click extension icon)
- Make sure you've entered your NEAR AI Cloud API key
- Click Save Settings

### Button Not Appearing on Posts
- Refresh the Instagram page
- Make sure you're on instagram.com (not an embedded view)
- Check that the extension is enabled in `chrome://extensions/`

### API Errors
- Verify your API key is correct and active at [cloud.near.ai](https://cloud.near.ai/)
- Check your account has available credits
- Try switching to a different AI model

### Comment Not Inserting
- Instagram's DOM changes frequently
- If insert fails, the comment will be copied to clipboard
- Paste manually with `Ctrl+V` in the comment field

## 📁 File Structure

```
instagram-ai-comment-assistant/
├── manifest.json      # Extension configuration
├── background.js      # Service worker for NEAR AI API calls
├── content.js         # Instagram DOM manipulation
├── popup.html         # Settings popup
├── popup.js           # Settings logic
├── popup.css          # Settings styles
├── modal.css          # Preview modal styles
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # This file
```

## 🔒 Privacy & Security

- Your API key is stored locally in Chrome storage
- All requests go through NEAR AI Cloud (anonymized)
- No data is sent to any other servers
- Comments are only inserted when you explicitly click "Insert Comment"
- No automated posting or commenting

## 📄 License

MIT License - Feel free to modify and distribute.

---

Made with ❤️ for the Instagram community | Powered by [NEAR AI Cloud](https://cloud.near.ai/)
