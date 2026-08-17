# FEATURE SPECIFICATION & ARCHITECTURE: Tab 04 - `/visualizer`
# Project: "16.7 Million Colors"
# Brand: "Colors World by: aardevaas"
# Goal: Build an Awwwards-grade, interactive UI component visualizer, accessibility audit engine, and live code exporter.

Hi Claude,

We are now building Tab 04 (`/visualizer` - The Live UI & Accessibility Lab). This tab allows designers and developers to test color palettes on bespoke, production-ready React UI templates in real time, audit WCAG contrast compliance, and export Tailwind v4 / Shadcn code.

Please implement the `/visualizer` workspace according to the following architecture, UI/UX specification, and design standards:

---

## 1. Core Workflow & Ergonomics

1. **Layout Structure:**
   - **Top Control Bar:** Template Selector, Dark/Light Mode Flip, Color Vision Deficiency (CVD) Filters, Export PNG button.
   - **Center Stage:** A clean, glassmorphic viewport framing the selected UI Template with interactive drag-and-drop color targets.
   - **Right Inspector Drawer:** WCAG/APCA Contrast Matrix, 1-Click "Auto-Fix Contrast" button, and live Tailwind v4 / Shadcn Code Exporter.
   - **Bottom Floating Dock:** Ingests active color palettes from previous tabs. Dragging any color swatch onto a UI section swaps its semantic variable in real time.

2. **Automatic & Manual Semantic Mapping:**
   - Palettes automatically map to UI roles based on OKLCH lightness (`--background`, `--surface`, `--primary`, `--text`, `--accent`, `--border`).
   - Users can manually override any role by dragging a color swatch directly onto the UI mockup or using a simple dropdown.

---

## 2. Bespoke Live UI Component Templates (Built-in)

Implement 4 bespoke, pixel-perfect UI templates built natively in React + Tailwind:

1. **SaaS Application Dashboard:** Navigation sidebar, analytical card charts, status badges, metric counters, and primary action buttons.
2. **E-Commerce Showcase Card:** Product image card, star ratings, price badge, variant color picker, and `[Add to Cart]` button.
3. **Editorial Landing Page Hero:** Bold `Unbounded` header, glassmorphic CTA buttons, tag pills, and hero content block.
4. **Mobile App Screen Frame:** Styled mobile interface with header, navigation bar, interactive toggle switches, and list cards.

*Feature Requirement:* Include a **1-Click Dark/Light Mode Flip** that smoothly toggles contrast roles without breaking the core brand hue.

---

## 3. Real-Time Accessibility Audit & Auto-Fix Engine

1. **Live Contrast Overlay Badges:**
   - Non-intrusive, glassmorphic micro-badges overlay text and button elements, showing real-time WCAG 2.1 compliance ratios (e.g., `4.5:1 [AA Pass]` or `2.1:1 [Fail]`).

2. **1-Click "Auto-Fix Contrast" Action:**
   - If a contrast score fails WCAG AA standards, clicking `[Auto-Fix]` automatically shifts the OKLCH lightness of the text or background to meet the 4.5:1 ratio while preserving the exact Hue angle and Chroma.

3. **Color Vision Deficiency (CVD) Simulator:**
   - SVG filter overlay toggles allowing users to instantly simulate how the UI looks under *Protanopia, Deuteranopia, Tritanopia,* and *Achromatopsia*.

---

## 4. Developer Code Vault & Dedicated Export Bar

1. **Tailwind CSS v4 & Shadcn Exporter:**
   - Live side-drawer showing ready-to-copy CSS variables formatted for Tailwind v4 (`@theme`) and Shadcn UI (`--primary`, `--background`, etc.).

2. **Dedicated Export Canvas & Cropping-Friendly Watermark:**
   - 1-click `"Export UI Showcase"` captures the active mockup as a high-res PNG.
   - **Watermark Rule:** Place the official watermark credit (`Colors World by: aardevaas`) on a **dedicated, semi-transparent footer bar below the mockup frame** (outside the main UI container). This ensures it looks premium by default while remaining effortless for users to crop out if desired.

---

## 5. Visual & Aesthetic Guidelines

- **Background:** Deep obsidian dark mode (`#050508`) with subtle ambient glows.
- **Typography:** `Unbounded` for headings, `Plus Jakarta Sans` for UI text, `Geist Mono` for all contrast scores and code outputs.
- **Performance:** 60 FPS transitions using CSS custom variables for instant color updates.

---

## 6. Creative Freedom Directive for Claude

You have full creative freedom to refine micro-interactions, add smooth spring transitions, or polish the CSS variable injection engine to deliver an Awwwards-level developer experience.

Please generate the modular React components, accessibility math helpers, SVG color filters, and export logic for Tab 04 (`/visualizer`).