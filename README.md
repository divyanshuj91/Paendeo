# Developer Guide

This document explains how to launch the application locally and details the guidelines for contributing to this repository.

---

##  How to Launch

Follow these steps to set up and run the application on your local machine:

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) (installed automatically with Node.js)

### Installation
1. Clone the repository to your local machine.
2. Navigate to the project root directory in your terminal and install the dependencies:
   ```bash
   npm install
   ```

### Running the Application
Start the application by running:
   ```bash
   npm start
   ```


---

## Features

### Resilient Prompt-Optimization Middleware
The Chrome extension includes an automatic prompt-enhancement feature that silently intercepts raw inputs on ChatGPT, Claude, Gemini, and Grok. When a user submits a prompt, the extension:
1. Intercepts the submit action and triggers a visual kneading animation on the pet.
2. Sends the prompt through a sequential, resilient API fallback pipeline (`gpt-4o` ➔ `claude-3-5-sonnet` ➔ `gemini-2.5-flash` ➔ `gpt-4o-mini`).
3. Enforces a 10-second timeout per API call. If a model fails, hits a rate limit, or lacks a configured key, the script instantly falls back to the next tier in the pipeline.
4. Uses a 150ms state synchronization delay to ensure React/Angular components update their internal states before submitting the final optimized prompt.
5. Falls back to sending the original user input if all nodes in the pipeline fail, ensuring user workflow is never blocked.

### Secure Environment Variables
API keys are handled securely to prevent exposure in public version control:
- Create a `.env` file in the root directory specifying your keys (e.g. `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`).
- Run `npm start` to trigger the build script (`scripts/inject-env.js`) which generates `extension/env.js` containing these keys.
- Both `.env` and `extension/env.js` are ignored by Git.
- Keys can also be entered or overridden directly in the extension settings popup.

---

## How to Contribute

We welcome contributions! To maintain security and repository integrity, please adhere strictly to the following contribution workflow.

> [!IMPORTANT]
> **Repository Security Guidelines**:
> 1. **No Direct Commits**: Developers must fork and clone the repository. Direct pushes to the `main` branch are restricted.
> 2. **Pull Requests Only**: All features, patches, and bug fixes must be submitted via a Pull Request (PR) for review.
> 3. **No Force Pushing**: Force pushes (`git push --force` or `git push -f`) to the upstream repository branches are strictly prohibited.

### Contribution Workflow

1. **Fork and Clone**:
   Fork the repository to your own GitHub account, then clone your fork locally:
   ```bash
   git clone https://github.com/your-username/Paendeo.git
   ```

2. **Branching**:
   Create a dedicated branch for your change:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Coding Standards**:
   - Keep code modular and decouple layout components from rendering cycles.
   - Maintain configuration values in designated configs at the top of files.
   - Clean custom sprite sheet grids of background artifacts using the cleaning script.

4. **Submission**:
   - Push commits to your fork:
     ```bash
     git push origin feature/your-feature-name
     ```
   - Open a **Pull Request (PR)** from your fork's feature branch to this upstream repository's `main` branch. 
   - Direct force-commits or force-pushes targeting remote branches on this repository are blocked by repository rules.
