# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TestPilot.AI is an automated testing platform that uses GitHub Copilot SDK to analyze web applications and generate Playwright test suites. Users provide a URL, the system crawls the page, and AI generates test strategies, Page Object Models (POMs), and test specs.

## Common Commands

```bash
# Development
pnpm dev                    # Start Next.js dev server (http://localhost:3000)
pnpm build                  # Build for production
pnpm start                  # Start production server

# Quality Checks
pnpm lint                   # Run ESLint (Next.js config with TypeScript rules)
pnpm test                   # Run all Vitest tests
pnpm test <test-file>       # Run specific test file
pnpm test -- -t <test-name> # Run specific test by name
```

## GitHub Copilot Authentication Required

This application requires GitHub Copilot CLI authentication to function:
```bash
npm install -g @github/copilot-cli
npm install -g @github/copilot
copilot auth login
```

## Architecture

### Agent Flow (Core Pipeline)

1. **User Input** → Frontend sends URL to `POST /api/agent`
2. **Page Fetching** → `src/lib/parser.ts` fetches and parses HTML using Cheerio
3. **Context Building** → Extracts title, description, links, forms, and detects dynamic pages
4. **AI Generation** → GitHub Copilot SDK (using GPT-4.1) processes context with `qa-system-prompt.md`
5. **Response Parsing** → `src/lib/mdParser.ts` extracts code blocks from markdown
6. **Validation** → `src/lib/validator.ts` validates TypeScript using Compiler API
7. **Results Display** → Frontend renders strategy and code with ZIP export

### Key Modules

**Backend (`src/app/api/agent/route.ts`)**
- Entry point for all agent requests
- Manages CopilotClient lifecycle (createSession, sendAndWait, destroy)
- Builds context summary from parsed page info
- Returns structured JSON with data, progress, validation, and context

**Parser (`src/lib/parser.ts`)**
- `fetchAndParse(url)`: Fetches URL and returns PageInfo
- `parseHtml(html, baseUrl)`: Extracts metadata, same-origin links, forms, and detects dynamic pages
- Dynamic detection heuristic: checks for `__NEXT_DATA__`, script count > 6, or minimal content

**Markdown Parser (`src/lib/mdParser.ts`)**
- `extractFilesFromMarkdown(markdown)`: Extracts code blocks with `**File:**` markers
- Supports TypeScript, JavaScript, and JSON files
- Returns `CodeFile[]` with filename, language, and content

**Validator (`src/lib/validator.ts`)**
- `validateTypeScriptFiles(files)`: Uses TypeScript Compiler API for syntax/type checking
- Creates virtual file system for in-memory validation
- Returns `ValidationResult[]` grouped by file

**Metrics (`src/lib/metrics.ts`)**
- In-memory counters (e.g., `isDynamicScans`)
- Optional persistence with `METRICS_PERSIST=1` environment variable

### Frontend Components

**`src/app/page.tsx`**
- Main client component with state management
- `parseAgentResponse()`: Parses PROGRESS blocks and extracts code files
- Sequential status messages during analysis (🔍 → ⚙️ → ✅)
- ZIP export with JSZip including generated package.json

**Dashboard Components**
- `StrategyView.tsx`: Displays test strategy markdown with React Markdown + GFM
- `CodeViewer.tsx`: Tabbed code viewer with sidebar, dark mode, fullscreen, copy per-file
- `Sidebar.tsx`: Shows file count and navigation
- `HeaderBar.tsx`: Action bar for download

**UI Components**
- Uses shadcn/ui patterns from `@/components/ui/`
- Radix UI primitives (Tabs, Slot)
- Tailwind CSS v4 with `cn()` utility for class merging
- Lucide React icons

## File Organization

```
src/
├── app/                      # Next.js App Router
│   ├── api/agent/            # Backend API (route.ts, prompts/)
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Main client page
│   └── globals.css           # Tailwind styles
├── components/
│   ├── dashboard/            # Analysis results (StrategyView, CodeViewer)
│   ├── landing/              # Hero and features
│   ├── layout/               # Header, Footer
│   ├── providers/            # ToastProvider context
│   └── ui/                   # shadcn/ui primitives
└── lib/
    ├── parser.ts             # HTML parsing (Cheerio)
    ├── mdParser.ts           # Markdown code block extraction
    ├── validator.ts          # TypeScript Compiler API validation
    ├── metrics.ts            # In-memory metrics
    └── utils.ts              # cn() utility
```

## Code Style

- **Components**: PascalCase - `HeroSection.tsx`, `StrategyView.tsx`
- **Functions**: camelCase - `parseHtml()`, `fetchAndParse()`
- **Interfaces**: PascalCase - `PageInfo`, `FormInput`, `CodeFile`
- **Client components**: Add `'use client'` directive
- **Props**: Define interface above component with `ComponentNameProps` pattern
- **Error handling**: `catch (error: unknown)` with type guard `error instanceof Error`
- **Imports**: Use `@/` alias for absolute imports
- **Styling**: Tailwind CSS with `cn()` utility for class merging

## Agent Response Format

The AI prompt (`src/app/api/agent/prompts/qa-system-prompt.md`) expects:

1. **PROGRESS block** (optional):
   ```
   ```PROGRESS
   Step 1: Crawling...
   Step 2: Analyzing...
   ```
   ```

2. **Code blocks** with file markers:
   ```
   **File:** pages/login.page.ts
   ```typescript
   export class LoginPage { ... }
   ```
   ```

The frontend `parseAgentResponse()` extracts both and returns `{ summary, files, progress }`.

## Testing

- Vitest for unit tests
- Test files: `*.test.ts` alongside source files
- Pattern: `describe` + `it` with `expect`
- Avoid network dependencies - use local HTML strings/fixtures
- Example in `src/lib/parser.test.ts`

## Special Considerations

1. **Timeout**: API route has `maxDuration = 60` for Copilot processing
2. **Dynamic Detection**: Metrics track `isDynamicScans` for future MCP integration
3. **Validation**: All generated TypeScript is validated before returning to client
4. **Error Handling**: CopilotClient cleanup in finally blocks
5. **Spanish Comments**: Some files have Spanish comments (preserve existing patterns)

## Roadmap Phases

- **Phase 1**: MVP Core (completed)
- **Phase 2**: UI/UX Overhaul & Artifact Validation (in progress)
- **Phase 3**: Playwright MCP Integration for dynamic exploration (planned)
- **Phase 4**: New features and modern UI design (planned)

See `docs/plan-phases.md` for detailed status.
