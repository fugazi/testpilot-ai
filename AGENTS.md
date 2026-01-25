# AGENTS.md

This file provides guidelines for agentic coding systems working in this repository.

## Build & Test Commands

```bash
# Development
pnpm dev                    # Start Next.js dev server (http://localhost:3000)
pnpm build                  # Build for production
pnpm start                  # Start production server

# Quality Checks
pnpm lint                   # Run ESLint (Next.js config with TypeScript rules)
pnpm test                   # Run all Vitest tests

# Running Single Tests
pnpm test <test-file>       # Run specific test file
pnpm test -- <pattern>      # Run tests matching pattern
pnpm test -- -t <test-name> # Run specific test by name
```

## Code Style Guidelines

### Import Organization
- Type imports: `import type { Metadata } from "next"`
- Absolute imports use `@/` alias: `import { Component } from '@/components/ui/button'`
- Named exports preferred over default exports
- Group external imports first, then internal imports
- Use `React.useMemo`, `React.useCallback` for explicit React hook usage

### TypeScript Conventions
- **Strict mode enabled** - All types must be properly defined
- **Interfaces for public APIs**, type aliases for internal use
- **Error handling**: Use `unknown` instead of `any`, then type guard: `error instanceof Error ? error.message : String(error)`
- **Props interfaces**: Define above component with `ComponentNameProps` pattern
- **Explicit typing**: Avoid `any`; use `unknown` when type is truly unknown
- **Path aliases**: `@/*` maps to `./src/*` (configured in tsconfig.json)

### Naming Conventions
- **Components**: PascalCase - `HeroSection.tsx`, `StrategyView.tsx`
- **Functions**: camelCase - `parseHtml()`, `fetchAndParse()`
- **Variables**: camelCase - `const pageInfo`, `const isLoading`
- **Constants**: UPPER_SNAKE_CASE - `QA_SYSTEM_PROMPT_CACHE`
- **Files**: kebab-case - `hero-section.tsx`, `md-parser.ts`
- **Interfaces**: PascalCase - `PageInfo`, `FormInput`, `HeroSectionProps`

### React Patterns
- **Client components**: Add `'use client'` directive at top of file
- **Functional components** with TypeScript
- **Props destructuring**: Define interface, then destructure in function signature
- **Hooks**: Use `React.useRef` for refs, proper cleanup in `useEffect` return
- **State management**: `useState` with explicit typing: `useState<string | null>(null)`
- **Event handlers**: Type as `React.FormEvent`, `React.ChangeEvent`, etc.
- **Conditional rendering**: Use early returns and ternary operators

### Error Handling
```typescript
// Standard pattern
try {
  await someOperation();
} catch (error: unknown) {
  console.error('Error context:', error);
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: message }, { status: 500 });
}
```

### Component Structure
```typescript
'use client';

import React from 'react';
import { Icon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComponentProps {
  // Props defined here
}

export function ComponentName({ prop1, prop2, className }: ComponentProps) {
  return (
    <div className={cn('base-classes', className)}>
      {/* Component content */}
    </div>
  );
}
```

### Styling & UI
- **Tailwind CSS v4** with inline theming
- **shadcn/ui components** from `@/components/ui/` (Radix primitives)
- **Class merging**: Use `cn()` utility: `cn('base-classes', className)` from `@/lib/utils`
- **Variants**: Use `class-variance-authority` for component variants
- **Icons**: Lucide React from `lucide-react`
- **Responsive**: Mobile-first with `md:`, `lg:` breakpoints
- **Dark mode**: Automatic via Tailwind CSS custom variant

### API Routes (Next.js App Router)
```typescript
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';  // For dynamic routes
export const maxDuration = 60;           // Set execution timeout

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Validate input
    if (!body.field) {
      return NextResponse.json({ error: 'Field required' }, { status: 400 });
    }
    // Process
    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### Testing (Vitest)
- **Test files**: `*.test.ts` alongside source files (e.g., `parser.test.ts`)
- **Pattern**: `describe` + `it` with `expect`
- **Avoid network dependencies**: Use local test data/fixtures
- **Local HTML strings** for parser testing
```typescript
import { describe, it, expect } from 'vitest';
import { parseHtml } from './parser';

describe('parser.parseHtml', () => {
  it('should parse basic fields', () => {
    const html = '<!doctype html><html>...</html>';
    const result = parseHtml(html, 'https://example.com');
    expect(result.title).toBe('Expected');
  });
});
```

### File Organization
```
src/
├── app/              # Next.js App Router
│   ├── api/          # API routes (server-side)
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Main page
├── components/       # React components
│   ├── dashboard/    # Dashboard-specific components
│   ├── landing/      # Landing page components
│   ├── layout/       # Layout components (Header, Footer)
│   ├── providers/    # Context providers
│   └── ui/           # Reusable UI primitives (shadcn/ui)
└── lib/              # Business logic & utilities
```

### Code Comments
- Use JSDoc for public functions and interfaces
- Spanish comments are present in some files (preserve existing patterns)
- Keep comments concise and focused on "why", not "what"
- Document complex logic and heuristics

### Additional Notes
- **Package manager**: `pnpm` (workspace configured)
- **Node version**: ^20.x
- **Browser API**: Use native fetch (Node.js 18+), no node-fetch
- **Validation**: TypeScript Compiler API for syntax/type checking
- **Authentication**: GitHub Copilot SDK requires CLI authentication
- **Deployment**: Vercel-friendly (Next.js standard)
