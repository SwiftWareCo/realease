# Realty

A modern real estate application built with Next.js, Convex, and shadcn/ui.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Backend**: [Convex](https://convex.dev) - Real-time backend as a service
- **UI Components**: [shadcn/ui](https://ui.shadcn.com) - Re-usable components
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **Dark Mode**: [next-themes](https://github.com/pacocoursey/next-themes)
- **Icons**: [Lucide React](https://lucide.dev)
- **Language**: TypeScript
- **Package Manager**: pnpm

## Features

- 🎨 Modern UI with shadcn/ui components
- 🌙 Dark mode support with next-themes
- 📱 Responsive design
- ⚡ Real-time data with Convex
- 🎯 Type-safe with TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (or npm/yarn)
- Convex account (for backend)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd realty
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Add your NEXT_PUBLIC_CONVEX_URL to .env.local
```

4. Start the Convex development server (in a separate terminal):
```bash
npx convex dev
```

5. Start the development server:
```bash
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
realty/
├── app/                    # Next.js App Router
│   ├── components/        # React components
│   │   └── Sidebar.tsx   # Navigation sidebar
│   ├── providers/         # Context providers
│   │   ├── ConvexClientProvider.tsx
│   │   └── ThemeProvider.tsx
│   ├── dashboard/         # Dashboard pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Home page
├── components/            # shadcn/ui components
│   └── ui/               # UI component library
├── convex/               # Convex backend functions
├── lib/                  # Utility functions
└── public/               # Static assets
```

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

### Adding shadcn Components

To add new shadcn/ui components:

```bash
npx shadcn@latest add [component-name]
```

### Convex Functions

Convex functions are located in the `/convex` directory. See the [Convex documentation](https://docs.convex.dev) for more information.

## Important Notes

- **Always check CLAUDE.md** before starting work - it contains project guidelines and conventions
- Use shadcn/ui components for all UI elements
- Ensure all components support dark mode
- Follow the Single Responsibility Principle (SRP)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Convex Documentation](https://docs.convex.dev) - Learn about Convex backend
- [shadcn/ui Documentation](https://ui.shadcn.com) - Browse available components
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Learn Tailwind CSS

## Deployment

### Deploy to Vercel

The easiest way to deploy your Next.js app is using the [Vercel Platform](https://vercel.com):

1. Push your code to GitHub
2. Import your repository on Vercel
3. Add your environment variables
4. Deploy!

### Convex Deployment

Convex automatically deploys when you push your functions. Make sure to configure your production deployment URL in your environment variables.

## Contributing

Please read `CLAUDE.md` before contributing. It contains important guidelines and conventions for this project.
