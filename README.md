# Chill AI 🌌

> **The Vibe-First IDE.** An AI-native, browser-based coding environment designed for the modern "vibe coder".

Chill AI is a futuristic Integrated Development Environment (IDE) that runs entirely in your browser. It combines a stunning glassmorphism UI with a powerful autonomous AI agent capable of planning, coding, debugging, and managing files directly within a virtual filesystem.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![Gemini](https://img.shields.io/badge/Powered%20by-Gemini-8e44ad.svg)

## ✨ Key Features

### 🧠 Autonomous AI Agent
- **Planning & Execution:** The agent doesn't just chat; it creates a step-by-step plan, executes terminal commands, edits files, and verifies its work.
- **Tool Use:** Capable of reading/writing files, running Git commands, linting code, and searching the project.
- **Visual Patch Review:** AI code changes are presented as interactive patches. You can "Keep" or "Reject" specific changes directly in the editor.

### 🎨 Innovative UI/UX
- **Glassmorphism Design:** Beautiful translucent panels, aurora backgrounds, and smooth animations.
- **Ambient Context:** "Neural Link" status indicators, dynamic usage analytics, and a "Vibe" aesthetic.
- **Theme Support:** Toggle between Neon Dark and Calm Light modes.

### 🛠️ Full-Featured Editor
- **Monaco Engine:** Powered by VS Code's editor engine with syntax highlighting, code folding, and minimap.
- **Ghost Text:** Inline AI code completions (Ghost Text) as you type.
- **Smart Lenses:** One-click actions to Generate Tests, Add Docs, or Refactor functions directly above the code.
- **Linting:** Integrated **Ruff** (via WASM) for ultra-fast Python linting and basic JS/TS syntax checking.

### 🗄️ Browser-Based Engineering
- **Virtual Filesystem:** Uses `LightningFS` to simulate a Node.js-like filesystem in memory.
- **Isomorphic Git:** Full Git client in the browser. Clone, commit, push, pull, and diff without a backend.
- **RAG (Retrieval Augmented Generation):** Runs a local Vector Search worker to index your code for semantic AI context.
- **Live Preview:** Instant HTML/JS/CSS preview pane.

---

## 🚀 Getting Started

### Prerequisites
- A **Google Gemini API Key** (or OpenAI Key).
- A modern web browser (Chrome/Edge/Firefox).

### Installation

1. **Clone the repository** (or download the source):
   ```bash
   git clone https://github.com/your-username/chill-ai.git
   cd chill-ai
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open in Browser**:
   Navigate to `http://localhost:5173` (or the port shown in your terminal).

### Configuration

1. Click the **Settings (⚙️)** icon in the sidebar or menu bar.
2. Under **Model Profiles**, select the default profile.
3. Enter your **API Key** (Gemini or OpenAI).
4. (Optional) Toggle "Ghost Text" or configure specific languages.

---

## 🏗️ Architecture

Chill AI is built on a "Serverless IDE" architecture:

*   **Frontend Framework:** React 19 + TypeScript + Tailwind CSS.
*   **State Management:** `Zustand` with persistence for file tree, chat history, and UI state.
*   **Code Editing:** `react-monaco-editor`.
*   **File System:** `@isomorphic-git/lightning-fs` (IndexedDB backed).
*   **Version Control:** `isomorphic-git`.
*   **Web Workers:**
    *   `ragWorkerCode.ts`: Handles tokenization and cosine similarity for semantic search without blocking the UI.
    *   `lintWorkerCode.ts`: Runs `@astral-sh/ruff-wasm-web` for high-performance Python linting.

---

## 🤖 How to "Vibe Code"

1.  **Create a Project:** Click "New Project" on the landing page.
2.  **Open the Agent:** Switch the AI Panel to **Agent** mode.
3.  **State your Goal:** E.g., *"Create a Snake game in Python"* or *"Refactor this component to use Hooks."*
4.  **Watch it Work:**
    *   The Agent creates a **Plan**.
    *   It **Thinks** about the next step.
    *   It **Executes** tools (writing files, checking status).
    *   It proposes **Patches**.
5.  **Review:** Click "View Patches" in the sidebar to accept or reject the AI's code.

---

## 🎹 Keyboard Shortcuts

| Shortcut | Action |
|:---|:---|
| `Cmd + B` | Toggle Sidebar |
| `Cmd + J` | Toggle Terminal |
| `Cmd + L` | Toggle AI Panel |
| `Cmd + P` | Spotlight / Command Palette |
| `Cmd + S` | Save File |
| `Cmd + ,` | Settings |
| `Cmd + K` | Inline Edit (in editor) |

---

## 📦 Dependencies

*   `@google/genai`: Generative AI SDK.
*   `monaco-editor`: The code editor.
*   `isomorphic-git`: Git implementation.
*   `lucide-react`: Iconography.
*   `framer-motion` (implied via CSS animations): Transitions.
*   `showdown`: Markdown rendering for preview.

---

## 📄 License

MIT License. Built for the vibes.
