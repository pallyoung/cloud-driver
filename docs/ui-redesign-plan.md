# UI Redesign Plan

## 1. Direction

Project positioning for the redesign:

- Product mood: `Archive Ops Console`
- Core traits: `clear structure`, `risk-aware`, `quietly professional`, `high information density without clutter`
- Experience goal: users should immediately understand `where they are`, `what is selected`, `what can be done`, and `what is risky`

This is intentionally **not**:

- a generic SaaS dashboard
- an IDE clone
- a glossy glassmorphism concept page
- a dark-mode-only admin console

## 2. Design Principles

1. Navigation first
- The shell must make hierarchy obvious: app nav, root nav, current directory, active workspace.

2. State must be visible
- `read-only`, `editable`, `preview`, `failed`, `ready`, `unsaved` need consistent visual language.

3. One surface, one responsibility
- Left: structure
- Center: current level browsing
- Right: preview/edit/details

4. Warm but precise
- Keep the warm archival tone, but sharpen borders, spacing rhythm, and hierarchy.

5. Interaction over decoration
- Motion exists to explain state changes, not to entertain.

## 3. Visual System

### 3.1 Color Tokens

Primary palette:

- `app`: `#F3EEE6`
- `canvas`: `#FCFAF6`
- `surface`: `#F6F0E6`
- `surface-alt`: `#FFFDFC`
- `ink-strong`: `#16212B`
- `ink`: `#243240`
- `muted`: `#63707B`
- `line`: `#D8D0C4`
- `line-strong`: `#C5B8A5`
- `accent`: `#0E6D67`
- `accent-soft`: `#D9EFEB`
- `info`: `#2F6EA6`
- `success`: `#2E7D32`
- `warning`: `#B7791F`
- `danger`: `#B42318`
- `ember`: `#B86837`

Rules:

- `accent` is the only primary interaction color.
- Risk colors are only used for actual semantic states.
- Background separation should mostly come from surface layering and border contrast, not heavy shadows.

### 3.2 Typography

- Display: `Space Grotesk`
- Body: `IBM Plex Sans`
- Technical/meta text: `IBM Plex Mono`

Usage:

- Page title: large, tight, high-contrast
- Section eyebrow: small uppercase tracking label
- Body copy: 14–16px with generous line-height
- Technical metadata: mono, smaller, lower contrast

### 3.3 Radius & Shadow

- Shell containers: `28px`
- Cards/panels: `20px`
- Buttons/inputs: `12px`
- Menus/dialog internals: `16px`

Shadow scale:

- Shell: deep but soft
- Panel: subtle
- Context menu / modal: strongest elevation
- Regular cards: mostly border-defined

## 4. Interaction System

### 4.1 Navigation

App shell hierarchy:

1. Global sidebar
2. Page-level header
3. Explorer structure rail
4. Current directory list
5. Workspace panel

Rules:

- Object actions do not live in the top toolbar.
- Right click and `...` menus are primary for file/folder operations.
- Breadcrumbs and root state must remain visible at all times.

### 4.2 Motion

Motion tokens:

- hover/press: `150–180ms`
- panel transitions: `180–220ms`
- menus/dialogs: `180–200ms`
- easing: `ease-out` for entry, `ease-in` for exit

Only animate:

- `opacity`
- `transform`
- lightweight background/border transitions

Avoid:

- animated layout shifts
- long decorative transitions
- over-animating data-heavy regions

### 4.3 Status Language

Status chip system:

- neutral: structure / download / no-preview
- accent: preview / active context
- success: ready / completed / editable-in-sync
- warning: read-only / queued / processing / unsaved
- danger: failed / destructive

## 5. Page Strategy

### 5.1 App Shell

Goal:

- Make the product feel like one coherent console, not a set of unrelated pages.

Changes:

- Stronger shell framing
- More intentional sidebar brand block
- Better active nav styling
- Cleaner main surface with layered background treatment

### 5.2 Explorer

Target layout:

- Left: `Roots & Tree`
- Center: `Current Directory`
- Right: `Workspace`

Key changes:

- Stronger separation between navigation rail and browsing area
- Toolbar reduced to search + create/upload/refresh
- Current directory rows become more legible and stateful
- Workspace becomes more editorial and less “misc panel”

### 5.3 Overview

Target:

- Operational home page

Changes:

- Denser metric cards
- Better recent activity structure
- Provider status card with clearer health tone

### 5.4 Jobs

Target:

- Real task center, not a generic list

Changes:

- Strong filter strip
- More structured task cards
- Clearer status progression styling
- Better action emphasis for `Download`, `Retry`, `Ready`

### 5.5 Settings

Target:

- Readable configuration surface

Changes:

- Modular cards
- Better distinction between immutable runtime info and status info
- Improved readability of long paths

## 6. First Implementation Scope

This first implementation round includes:

1. global design tokens
2. shell + sidebar redesign
3. Explorer visual redesign
4. keeping current functionality and test flow intact

This round does **not** yet include:

- large interaction model changes beyond Explorer
- bulk operations
- mobile-specific structural redesign
- deep Jobs / Settings refactor

## 7. Acceptance Criteria

The redesign is successful when:

- Explorer reads clearly at first glance
- selected item and current path are unmistakable
- action entry points are obvious but not noisy
- all pages feel like part of the same product
- E2E flows still pass without changing functional expectations

## 8. Implementation Order

Phase 1:

- `apps/web/tailwind.config.ts`
- `apps/web/src/index.css`
- `apps/web/src/app/layouts/app-shell.tsx`
- `apps/web/src/components/navigation/sidebar.tsx`

Phase 2:

- `apps/web/src/pages/explorer/page.tsx`
- `apps/web/src/components/files/folder-tree.tsx`
- `apps/web/src/components/files/file-actions-menu.tsx`
- `apps/web/src/components/files/file-workspace-panel.tsx`

Phase 3:

- `apps/web/src/pages/overview/page.tsx`
- `apps/web/src/pages/jobs/page.tsx`
- `apps/web/src/pages/settings/page.tsx`

Phase 4:

- polish
- responsive refinements
- interaction cleanup
- screenshot review with Playwright
