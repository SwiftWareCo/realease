# CLAUDE.md - Project Context & Guidelines

## ⚠️ MANDATORY: Read This First

**ALWAYS check and read this file before starting any work on this project.** This file contains critical context, conventions, and guidelines that must be followed.

## Project Overview

**Realty** is a Next.js-based real estate application with a Convex backend. This document provides context and guidelines for working with this codebase.

## Tech Stack

- **Framework**: Next.js 16.1.2 (App Router)
- **Runtime**: React 19.2.3
- **Language**: TypeScript 5
- **Backend**: Convex 1.31.5
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Dark Mode**: next-themes
- **Package Manager**: pnpm
- **Fonts**: Geist Sans & Geist Mono (via `next/font`)

## Project Structure

```
realty/
├── app/                    # Next.js App Router directory
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   ├── globals.css        # Global styles
│   ├── components/        # React components (including shadcn)
│   │   └── ui/           # shadcn/ui components
│   ├── providers/         # React context providers
│   │   ├── ConvexClientProvider.tsx
│   │   └── ThemeProvider.tsx
│   └── dashboard/         # Dashboard pages
├── convex/                # Convex backend functions
│   ├── _generated/       # Auto-generated Convex types
│   └── *.ts              # Convex queries, mutations, actions
├── public/               # Static assets
└── package.json          # Dependencies and scripts
```

## Core Principles

### Single Responsibility Principle (SRP)

- **Each file should handle only one concern**
- Components should be focused and do one thing well
- Separate business logic from UI components
- Keep Convex functions focused on specific operations

### File Organization

- Create new files when needed to maintain SRP
- Group related functionality in directories
- Use descriptive, specific file names

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow Next.js App Router conventions
- Use functional components with hooks
- Prefer named exports for components
- Use `'use client'` directive only when necessary (client-side hooks, event handlers)

### Convex Integration

- Convex functions are in `/convex` directory
- Use `query` for read operations
- Use `mutation` for write operations
- Use `action` for external API calls or complex operations
- Always validate arguments with Convex validators (`v`)
- Import types from `convex/_generated/api`

### UI Components

- **Use shadcn/ui components** for all UI elements
- Install new shadcn components using: `npx shadcn@latest add [component-name]`
- Components are located in `app/components/ui/`
- Follow shadcn patterns and conventions

### Styling

- Use Tailwind CSS utility classes
- **Dark mode is enabled via next-themes** - use `dark:` variants
- ThemeProvider wraps the app in `app/providers/ThemeProvider.tsx`
- Follow existing color scheme (uses CSS variables from shadcn)
- Use responsive design utilities (`sm:`, `md:`, etc.)

### Sidebar

- Sidebar component is located in `app/components/Sidebar.tsx`
- Currently includes Dashboard navigation link
- Sidebar is integrated into the root layout
- Use sidebar navigation for main app routes

### Environment Variables

- Convex URL: `NEXT_PUBLIC_CONVEX_URL` (required)
- Store in `.env.local` (not committed)

## Common Patterns

### Convex Client Setup

The Convex client is provided via `ConvexClientProvider` in the root layout:

```typescript
// app/providers/ConvexClientProvider.tsx
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
```

### Using Convex in Components

```typescript
'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

// Query
const data = useQuery(api.myFunctions.myQuery);

// Mutation
const mutation = useMutation(api.myFunctions.myMutation);
```

### Creating Convex Functions

```typescript
// convex/myFunctions.ts
import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const myQuery = query({
  args: { id: v.id('tableName') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

## Development Workflow

### Running the Project

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Start Convex dev server (in separate terminal)
npx convex dev
```

### Building

```bash
pnpm build
pnpm start
```

### Linting

```bash
pnpm lint
```

## Important Notes

1. **⚠️ MANDATORY: Always check this file first** before making any changes or starting work
2. **Use shadcn/ui components** - don't create custom UI components unless absolutely necessary
3. **Dark mode support** - ensure all components work in both light and dark modes
4. **Follow SRP** - create new files when functionality grows
5. **Type safety** - leverage TypeScript and Convex's generated types
6. **Client vs Server** - be mindful of 'use client' boundaries
7. **Convex functions** - must be in `/convex` directory to be deployed
8. **Sidebar navigation** - add new routes to the sidebar component

## File Naming Conventions

- Components: PascalCase (e.g., `UserProfile.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Convex functions: camelCase (e.g., `getUserProfile.ts`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS.ts`)

## Next Steps

When working on this project:

1. Read this file to understand context
2. Check existing code patterns before creating new ones
3. Maintain SRP - split files when needed
4. Test Convex functions locally with `npx convex dev`
5. Use TypeScript types from `convex/_generated/api`
