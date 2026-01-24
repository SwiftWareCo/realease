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
│   │   ├── ui/           # shadcn/ui components
│   │   ├── leads/        # Lead-related components
│   │   └── demo/         # Demo components
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
- **Forms**: use `react-hook-form` for client forms unless there's a strong reason not to
- **Purity**: avoid impure functions during render (e.g., `Date.now`, `Math.random`) and keep render output idempotent
- **Modal state**: reset form/state on open (not on close) to avoid exit-animation flashes
- **Dialogs/Modals**: keep them mounted and control open state via props; avoid `{open && <Dialog/>}` patterns that unmount and break exit animations

### Convex Integration

- Convex functions are in `/convex` directory
- Use `query` for read operations (deterministic, reactive, cached)
- Use `mutation` for write operations (deterministic, fast, reactive)
- Use `action` for external API calls, scheduling, or complex operations (non-deterministic, can call mutations/queries)
- **Important**: Actions can schedule (`ctx.scheduler`), mutations cannot
- Always validate arguments with Convex validators (`v`)
- Import types from `convex/_generated/api`
- **File structure**: Convex maps file paths to API paths:
  - `convex/leads/queries.ts` → `api.leads.queries.*`
  - `convex/leads/mutations.ts` → `api.leads.mutations.*`
  - `convex/leads/actions.ts` → `api.leads.actions.*`
- Run `npx convex dev` to regenerate API types after adding new files

### UI Components

- **Use shadcn/ui components** for all UI elements
- Install new shadcn components using: `npx shadcn@latest add [component-name]`
- Components are located in `app/components/ui/`
- Follow shadcn patterns and conventions
- **User feedback**: add Sonner toast notifications for user-triggered actions (create/update/delete/submit) and surface failures with error toasts

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

- **Next.js Environment Variables** (stored in `.env.local`):
  - `NEXT_PUBLIC_CONVEX_URL` (required) - Convex deployment URL
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (required for Clerk client)
  - `CLERK_SECRET_KEY` (required for Clerk server)
- **Convex Environment Variables** (must be set in Convex Dashboard):
  - `OPENROUTER_API_KEY` (required for AI lead analysis) - Set in Convex Dashboard → Settings → Environment Variables
  - `CLERK_JWT_ISSUER_DOMAIN` (required for Clerk auth) - use the Convex JWT template issuer domain from Clerk
  - `CLERK_WEBHOOK_SECRET` (required for Clerk webhooks) - from Clerk webhook signing secret
  - Any other environment variables used by Convex functions must be added to the Convex Dashboard, not `.env.local`

**Important**: Convex functions run in the Convex cloud, not in your Next.js app. Environment variables used by Convex actions/mutations must be configured in the Convex Dashboard, not in `.env.local`.

## Authentication (Clerk + Convex)

- **Middleware**: use `proxy.ts` (Next.js 16) with `clerkMiddleware` and the standard matcher.
- **Client auth state**: use `useConvexAuth` and `<Authenticated>/<Unauthenticated>` from `convex/react` (not Clerk UI helpers) when gating Convex data.
- **User sync**: Clerk webhooks POST to `convex/http.ts` and upsert/delete in the `users` table.

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

**⚠️ IMPORTANT: Always use `pnpm` (not npm or yarn)**

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Start Convex dev server (in separate terminal)
# This regenerates API types and deploys functions
npx convex dev
```

### Building

```bash
pnpm build
pnpm start
```

### Linting

```bash
# Type checking
pnpm run lint:types

# ESLint
pnpm run lint:eslint
```

## Important Notes

1. **⚠️ MANDATORY: Always check this file first** before making any changes or starting work
2. **Use `pnpm` exclusively** - never use `npm` or `yarn` commands
3. **Use shadcn/ui components** - don't create custom UI components unless absolutely necessary
4. **Dark mode support** - ensure all components work in both light and dark modes
5. **Follow SRP** - create new files when functionality grows
6. **Type safety** - leverage TypeScript and Convex's generated types
7. **Client vs Server** - be mindful of 'use client' boundaries
8. **Convex functions** - must be in `/convex` directory to be deployed
9. **Convex API regeneration** - run `npx convex dev` after adding new Convex files
10. **Sidebar navigation** - add new routes to the sidebar component
11. **Drag-and-drop** - Uses `@dnd-kit` for Kanban board interactions

## File Naming Conventions

- Components: PascalCase (e.g., `UserProfile.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Convex functions: camelCase (e.g., `getUserProfile.ts`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS.ts`)

## Implementation Details

### Leads Management

- **Kanban Board**: Drag-and-drop interface using `@dnd-kit` for status management
- **Table View**: Traditional table view with filtering
- **Status Flow**: New → Contacted → Qualified
- **Real-time Updates**: Convex queries provide reactive updates

### Convex Function Organization

```
convex/leads/
  ├── lead.schema.ts    # Schema definition (exported table)
  ├── queries.ts        # Read operations (getAllLeads, etc.)
  ├── mutations.ts      # Write operations (updateLeadStatus, insertLead)
  └── actions.ts        # Complex operations (submitLeadForm with scheduling)
```

### Actions vs Mutations

- **Actions** (`actions.ts`): Use when you need to:
  - Schedule future work (`ctx.scheduler.runAfter`)
  - Call external APIs
  - Orchestrate multiple operations
- **Mutations** (`mutations.ts`): Use for simple database writes
  - Direct database operations only
  - Fast and reactive
  - Cannot schedule or call external APIs

## Next Steps

When working on this project:

1. Read this file to understand context
2. Check existing code patterns before creating new ones
3. Maintain SRP - split files when needed
4. Test Convex functions locally with `npx convex dev`
5. Use TypeScript types from `convex/_generated/api`
6. Always use `pnpm` for package management
