# 🚀 TestPilot.AI

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![GitHub Copilot SDK](https://img.shields.io/badge/Copilot_SDK-24292e?style=for-the-badge&logo=github&logoColor=white)](https://github.com/features/copilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<div align="center">
  <img src="https://raw.githubusercontent.com/fugazi/testpilot-ai/main/public/testpilot-ai-banner.jpg " alt="TestPilot.AI Banner" width="1200" />
  <h3>Automated Testing Platform powered by GitHub Copilot</h3>
  <p>Analyze web applications and generate comprehensive Playwright test suites in seconds.</p>
</div>

---

## 📖 Overview

**TestPilot.AI** is an AI-driven platform designed to accelerate quality assurance. By leveraging the **GitHub Copilot SDK**, it crawls target URLs, identifies critical user flows, and automatically generates high-quality Playwright test strategies and code artifacts.

It's not just a code generator; it's an intelligent QA companion that understands site structures and produces valid Page Object Models (POMs) and test specs tailored to the application's unique ecosystem.

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🔍 URL Analysis** | GitHub Copilot Client extracts title, description, internal links, accessibility tree and form structures. |
| **🤖 AI-Powered Artifacts** | Generates detailed test strategies and Playwright code using GitHub Copilot SDK. |
| **⚒️ Smart Validation** | Automatically validates generated code for syntax and type errors via the TypeScript Compiler API. |
| **📦 ZIP Packaging** | Download the entire Playwright test suite, including `package.json` and POMs, in a single ZIP file. |
| **🌓 Modern Dashboard** | Advanced UI with Strategy View, Code Viewer (with syntax highlighting), and Dark Mode support. |
| **📊 Real-time Progress** | Visual feedback during the analysis process with sequential state indicators using GitHub Copilot SDK. |

## 🛠️ Tech Stack

- **Frontend**: [Next.js 16 (App Router)](https://nextjs.org/), [React 19](https://react.dev/)
- **AI Engine**: [GitHub Copilot SDK](https://github.com/features/copilot)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/)
- **Parsing**: [Cheerio](https://cheerio.js.org/)
- **Utilities**: [JSZip](https://stuk.github.io/jszip/), [React Markdown](https://github.com/remarkjs/react-markdown)
- **Validation**: [TypeScript Compiler API](https://www.typescriptlang.org/docs/handbook/compiler-api.html)
- **Testing**: [Vitest](https://vitest.dev/)

## 📂 Project Structure

```text
src/
├── app/                  # Next.js App Router (pages & API)
│   ├── api/agent/        # Core agent logic and backend endpoints
│   └── globals.css       # Global styles (Tailwind 4)
├── components/           # UI Component Library
│   ├── dashboard/        # Analysis results, CodeViewer, StrategyView
│   ├── landing/          # Hero and landing page sections
│   ├── layout/           # Header, Footer, and navigation
│   └── ui/               # Reusable Radix/Shadcn primitives
├── lib/                  # Business logic & utilities
│   ├── mdParser.ts       # Markdown parsing for AI responses
│   ├── parser.ts         # Web crawler and scraper logic
│   ├── validator.ts      # TypeScript syntax validation
│   └── metrics.ts        # Performance and usage tracking
└── docs/                 # Project documentation and roadmap
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `^20.x` or later.
- **Package Manager**: `pnpm` (recommended).
- **GitHub Copilot**: Access to GitHub Copilot (the agent uses the SDK which requires authentication).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/fugazi/testpilot-ai.git
   cd testpilot-ai
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Install the GitHub Copilot CLI and the Copilot extension:
   *Installing the [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli) is necessary to authenticate your Copilot session.*
   ```bash
   # Install the GitHub Copilot CLI
   npm install -g @github/copilot-cli

   # Install the Copilot extension
   npm install -g @github/copilot
   ```

4. Authenticate with GitHub:
   *An active GitHub Copilot subscription is required to use the GitHub Copilot SDK.*
   ```bash
   gh auth login
   ```

### Running the Project

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run unit tests
pnpm test

# Run linting
pnpm lint
```

## ⚙️ How it Works

1. **Input**: User provides a URL (e.g., `https://example.com`).
2. **Crawl**: The system performs a server-side fetch and analyzes the HTML to understand forms, buttons, and links.
3. **Agent**: The data is sent to the GitHub Copilot Agent with a specialized [QA Prompt](src/app/api/agent/prompts/qa-system-prompt.md).
4. **Validation**: The AI's response is parsed, and any code blocks are validated for syntax correctness.
5. **Output**: The user receives a structured Test Strategy and a set of Playwright files ready to use.

## 🗺️ Roadmap & Phases

Check the current progress in our [Plan Phases](docs/plan-phases.md) document:
- ✅ **Phase 1**: MVP Core & Basic Agent integration.
- 🚧 **Phase 2**: UI/UX Overhaul & Artifact Validation (Current).
- 📅 **Phase 3**: Playwright MCP Integration for dynamic exploration.

## 🏠 Tester details
* Name: `Douglas Urrea Ocampo`
* Country: `Colombia`
* City: `Medellin`
* E-mail: `douglas@douglasfugazi.co`
* LinkedIn: [https://www.linkedin.com/in/douglasfugazi](https://www.linkedin.com/in/douglasfugazi)
* Contact: [https://douglasfugazi.co](https://douglasfugazi.co)

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<p align="center">Made with ❤️ by Douglas Urrea Ocampo for the QA Community</p>
