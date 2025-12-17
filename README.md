# bitpic.net

Your own avatar on bitcoin, forever.

## Overview

bitpic.net is a Bitcoin avatar service that allows users to store their avatars permanently on the Bitcoin blockchain. Built with Next.js 16, React 19, and Tailwind CSS v4.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4
- **Component System**: shadcn/ui (New York style)
- **Icons**: Lucide React
- **Linting**: Biome
- **Fonts**: Geist Sans & Geist Mono
- **Runtime**: Bun

## Design System

### Color Palette

The design uses a warm, Japanese minimalist aesthetic with:

- **Primary**: Warm amber/gold `hsl(35 92% 50%)`
- **Background (Light)**: Warm cream `hsl(40 20% 98%)`
- **Background (Dark)**: Charcoal `hsl(20 14.3% 4.1%)`
- **Border Radius**: Sharp corners `0.25rem`

### Typography

- **UI Text**: Geist Sans
- **Data/Code**: Geist Mono (paymails, addresses)

### Design Principles

1. Japanese minimalism aesthetic
2. No emojis
3. Sharp corners (rounded-sm)
4. Grayscale filter on images, remove on hover
5. Gold/amber used sparingly - only for brand moments
6. Wide margins, centered layouts (max-w-7xl)

## Project Structure

```
bitpic.net/
├── app/
│   ├── globals.css          # Theme configuration
│   ├── layout.tsx            # Root layout with metadata
│   └── page.tsx              # Home page with mock data
├── components/
│   ├── ui/                   # shadcn/ui primitives
│   │   ├── card.tsx
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── separator.tsx
│   │   └── skeleton.tsx
│   ├── header.tsx            # Sticky header with nav
│   ├── hero.tsx              # Hero section with upload
│   ├── avatar-card.tsx       # Avatar card component
│   ├── feed.tsx              # Feed with mempool/immutable
│   └── footer.tsx            # Simple footer
├── lib/
│   └── utils.ts              # Utility functions (cn)
└── public/
    └── avatar.svg            # Placeholder avatar
```

## Components

### Header

- Sticky header with backdrop blur
- Logo with avatar.svg + "bitpic" text
- Desktop navigation (About, API, GitHub)
- Search input with bottom-border style
- Mobile menu with hamburger icon

### Hero

- "v2.0 Beta" badge with amber styling
- Large headline with light font weight
- Upload CTA with dashed border
- Drag-and-drop support
- Hover state changes border to primary color

### AvatarCard

- 1:1 aspect ratio image
- Grayscale filter, removes on hover
- Hover shows copy button overlay
- Footer with truncated paymail and timestamp
- Border changes to primary on hover

### Feed

- **Mempool Section**: Pulsing amber dot, pending uploads
- **Separator**: Divides sections
- **Immutable Section**: Green dot, confirmed uploads
- Responsive grid: 2-6 columns based on screen size
- Skeleton loading states

### Footer

- Centered copyright text
- Mono font, muted color

## Getting Started

### Install Dependencies

```bash
bun install
```

### Development Server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
bun run build
```

### Lint

```bash
bun run lint
```

### Format

```bash
bun run format
```

## Configuration

### Tailwind Theme

Theme configuration is in `app/globals.css` using Tailwind v4's `@theme inline` directive. All colors, spacing, and typography are defined using CSS variables for easy theming and dark mode support.

### shadcn/ui

Configuration is in `components.json`:

- Style: New York
- Base color: Neutral
- CSS variables: Yes
- Components path: `@/components/ui`

## Mock Data

The application currently uses mock data in `app/page.tsx`:

- 12 confirmed avatars
- 2 unconfirmed avatars

Replace with real API calls when backend is ready.

## Accessibility

- Semantic HTML throughout
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus indicators on all interactive elements
- Screen reader friendly

## Browser Support

- Modern browsers with ES2017+ support
- Dark mode support via `prefers-color-scheme`
- Responsive design for mobile, tablet, and desktop

## License

Private project.
