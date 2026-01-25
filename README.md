# 🚀 TestPilot.AI

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![GitHub Copilot SDK](https://img.shields.io/badge/Copilot_SDK-24292e?style=for-the-badge&logo=github&logoColor=white)](https://github.com/features/copilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<div align="center">
  <img src="./public/testpilot-ai-banner.jpg" alt="TestPilot.AI Banner" width="1200" />
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