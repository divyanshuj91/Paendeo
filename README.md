# Paendeo: AI Token Tracker & Desktop Companion

Paendeo is a desktop companion and browser utility designed to monitor and manage interaction with AI platforms. It consists of two components:
1. An **Electron Desktop App** that renders a transparent overlay desktop pet (Panda) reacting to system keystrokes.
2. A **Chrome Extension** that injects the pet directly onto AI platform pages (ChatGPT, Claude, Gemini, Grok), tracks real-time API token usage in a floating HUD, and optimizes prompts using a resilient fallback middleware.

---

## System Architecture

```mermaid
graph TD
    subgraph Browser (Chrome Extension)
        A[Content Script: content.js] -->|Intercepts Submit| B[Background SW: background.js]
        B -->|LLM API Request| C[OpenAI / Anthropic / Gemini]
        B -->|Returns Upgraded Prompt| A
        A -->|Injects DOM / Tracks Tokens| D[Live HUD UI]
    end
    subgraph Desktop (Electron App)
        E[Main Process: main.js] -->|Global Keystrokes| F[Renderer Process: renderer.js]
        F -->|Triggers Animations| G[Transparent Desktop Pet]
    end
```

---

## Features

### Real-Time Token Tracking & HUD
- Monitors character and word counts on active AI platform chats to estimate token consumption.
- Displays conversation token counts, daily limits, and warning levels inside a customizable floating HUD.

### Resilient Prompt-Optimization Middleware
- Intercepts prompt submissions on ChatGPT, Claude, Gemini, and Grok.
- Passes draft prompts through a sequential fallback pipeline (`gpt-4o` -> `claude-3-5-sonnet` -> `gemini-2.5-flash` -> `gpt-4o-mini`) using a 10-second timeout per call to ensure reliability.
- Uses a 150ms state synchronization delay to guarantee compatibility with React/Angular components on target platforms.
- Falls back to the raw prompt if all pipeline endpoints fail.

### Interactive Desktop Pet
- Renders transparent overlays on both the desktop and within browser tabs.
- Features multi-state sprite animations (idle, walk, run, float, sleep, knead) that react to user activity and typing speed.
- Supports cosmetic customization (Classic, Cyber, Ghost, and Gold skins).

---

## How to Launch

### Prerequisites
- Node.js (v16 or higher)
- npm (installed automatically with Node.js)

### 1. Setting Up the Project
Clone the repository and install the dependencies:
```bash
git clone https://github.com/divyanshuj91/Paendeo.git
cd Paendeo
npm install
```

### 2. Configuring API Keys (Environment Variables)
To use the prompt optimizer, configure your API keys in the root directory:
1. Create a `.env` file in the root folder:
   ```env
   OPENAI_API_KEY=your_openai_key
   GEMINI_API_KEY=your_gemini_key
   ANTHROPIC_API_KEY=your_anthropic_key
   ```
2. When starting the application, the build script will automatically compile these keys into `extension/env.js` for the Chrome extension background worker. Both `.env` and `extension/env.js` are ignored by Git.

### 3. Launching the Electron App
Start the desktop companion:
```bash
npm start
```

### 4. Installing the Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `extension` folder located inside the Paendeo directory (`Paendeo/extension`).
5. Open the extension popup in your toolbar to configure/verify your keys and optimizer settings.
6. Refresh any open ChatGPT, Claude, or Gemini tabs to activate the injection scripts.

---

## How to Contribute

To maintain codebase security and repository integrity, please adhere strictly to the following workflow.

### Repository Security Guidelines
1. **No Direct Commits**: Pushes directly to the `main` branch are restricted. All contributions must be submitted via Pull Request (PR).
2. **No Force Pushing**: Force pushes (`git push --force` or `git push -f`) to upstream branches are blocked by branch protection rules.

### Contribution Workflow
1. **Fork the Repository**: Fork the repository to your own GitHub account and clone it locally.
2. **Create a Branch**: Create a dedicated feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Coding Standards**:
   - Keep code modular and decouple layout components from rendering cycles.
   - Maintain configuration values in designated configs at the top of files.
   - Run the sprite sheet cleaning script (`python scripts/clean_sprites.py`) when updating graphics.
4. **Submit a PR**: Push commits to your fork and open a Pull Request from your branch to the upstream repository's `main` branch.
