# Crixen Extension

**The Ultimate Social Media AI Agent.**

Crixen is your autonomous partner for digital growth. It organizes your Notion workspace, manages your social media strategy, and engages with your audience on Instagram and X (Twitter) — all powered by advanced AI models via NEAR AI Cloud.

![Crixen Banner](assets/icons/icon128.png)

## Features

### Instagram
-   **Smart Comments**: Context-aware comments based on post image and caption.
-   **Auto-Pilot**: Automatically scrolls and interacts with posts to grow your engagement.
-   **Vision Support**: "Sees" the images to write relevant comments.

### X (Twitter)
-   **Smart Replies**: Generate witty or professional replies to tweets.
-   **Auto-Threader**: Turn ideas into viral threads (Coming Soon).
-   **Quote Repost**: Add value to existing conversations.

### Notion
-   **Strategy Capture**: Scrape brand strategies from Notion tables with one click.
-   **Content Calendar**: Automatically fill your social media schedule.
-   **Strategy Generator**: Create brand strategies directly in your workspace.
-   **Cloud Sync**: Captured strategies sync to your Crixen account.

### NOVA Integration (Active on Mainnet)
-   **Encrypted Storage**: Strategies stored with zero-knowledge encryption via **NOVA SDK**.
-   **IPFS Backed**: Content pinned to decentralized storage (Pinata).
-   **Platform-Managed Security**: Strategies secured via platform's mainnet account, requiring no user wallet setup.
-   **Cross-Device Sync**: Access strategies from dashboard or any device.

## Installation

1.  Clone this repository.
2.  Run `./build.sh` (optional, for zip).
3.  Open Chrome and go to `chrome://extensions`.
4.  Enable **Developer Mode** (top right).
5.  Click **Load Unpacked**.
6.  Select the project directory.

## Authentication

Crixen uses seamless authentication with the [Crixen Dashboard](https://crixen.xyz).

1.  **Log In**: Go to the Crixen Dashboard and log in.
2.  **Sync**: The extension automatically detects your session.
3.  **Start**: Open the extension popup—you're ready to go!

## Configuration

-   **AI Models**: Select your preferred model (DeepSeek, GPT-5.2, Claude) in the extension settings.
-   **Persona**: Choose your default persona (Friendly, Professional, Witty, etc.).
-   **Brand Voice**: Define your brand's tone and style for consistent messaging.
-   **API**: Using Production API (`api.crixen.xyz`).

## Usage

-   **Instagram**: Look for the "AI Comment" button on posts, or use the Auto-Pilot feature in the popup.
-   **X (Twitter)**: Use the "Smart Reply" button on tweets or Auto-Pilot.
-   **Notion**: 
    1. Open a Notion page with a strategy table.
    2. Click "Capture Strategies" in the popup.
    3. Strategies are saved locally and synced to your account.

## Data Storage

| Tier | Strategy Storage | Sync |
|------|-----------------|------|
| Starter | Local only | Browser storage |
| Pro | NOVA Encrypted | Cloud sync |
| Agency | NOVA Encrypted | Cloud sync + team sharing |

## Permissions

This extension requires the following permissions:
-   `storage`: Save settings and cached strategies locally.
-   `tabs`: Detect current platform and inject content scripts.
-   `host_permissions`: Access Instagram, Twitter, Notion, and API endpoints.

## License

MIT
