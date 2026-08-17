# FEATURE SPECIFICATION & ARCHITECTURE: Tab 02 - `/builder`
# Project: "16.7 Million Colors"
# Brand: "Colors World by: aardevaas"
# Goal: Build an Awwwards-grade, high-utility Palette Builder & Scale Lab.

Hi Claude,

We are now building Tab 02 (`/builder` - Palette Builder & Scale Lab). This tab transforms collected single colors into functional, perceptually uniform color scale systems (1 to 10 steps max).

Please implement the `/builder` workspace according to the following architecture, UI/UX specification, and design standards:

---

## 1. Core Technical & Architectural Requirements

1. **Dock Ingestion & Primary Anchor Mechanics:**
   - Automatically ingest collected colors from the persistent **Floating Harmonic Dock**.
   - The first ingested color defaults as the **Primary Anchor**.
   - Users can star `[★]` any color swatch on the board to instantly swap the Primary Anchor.

2. **Perceptually Uniform OKLCH Scale Engine:**
   - All color scale calculations and smooth curve distributions must occur natively in the **OKLCH** color space using `culori` or `colord`.
   - Prevent perceptual dead-zones and muddy dark tones by maintaining smooth hue angle torsion across step interpolations.

3. **Step Count Control (Capped 1 to 10):**
   - Provide 3 quick-preset pills: **3 Steps** (Core Trio), **5 Steps** (Classic UI), and **10 Steps** (Full Tokens).
   - Include a custom numeric step input field **capped strictly between 1 and 10 steps max**.

---

## 2. Component Layout & Feature Suite

### A. Control & Curve Manipulator Panel
- **Step Selector:** Preset pills (`3`, `5`, `10`) + custom number input (Min: 1, Max: 10).
- **Smooth OKLCH Curve Handles:**
  * **Lightness Curve:** Controls distribution of light/dark across steps.
  * **Chroma Curve:** Adjusts vibrancy levels across shades.
  * **Hue Torsion:** Smoothly rotates hue angles across steps for warm, natural shadows.
- **Continuous Gradient Ribbon Scrubber:** A continuous OKLCH gradient bar allowing users to scrub and sample micro-shades on the fly.

### B. Interactive Palette & Scale Surface
- Renders the generated swatches in a silky, glassmorphic layout.
- Swatches feature subtle hover spring physics, OKLCH value readouts in `Geist Mono`, and 1-click quick copy.
- **Wide Gamut & CVD Badges:** Highlights whether steps push into `Display P3` / `Rec2020` and provides 1-click toggles for Protanopia, Deuteranopia, Tritanopia, and Achromatopsia simulations.

### C. Collapsible Contrast Matrix Heatmap (Non-Intrusive)
- Hidden inside a collapsible, glassmorphic accordion panel `[ View Contrast Matrix ]`.
- When opened, displays a clean APCA / WCAG $N \times N$ contrast matrix scoring every swatch against every other swatch in the scale.
- Hovering a cell highlights the corresponding swatches with a subtle glow line.

### D. Code Export Vault (GitHub Star Magnet)
Floating drawer with 1-click exports:
1. **Tailwind CSS v4 `@theme`:** Outputs formatted CSS tokens (`--color-primary-50` through `--color-primary-950`).
2. **Shadcn UI CSS Variables:** Automatically maps step indices to semantic roles (`--background`, `--surface`, `--border`, `--primary`, `--foreground`).
3. **Figma Tokens / W3C JSON:** Structured design token JSON.

---

## 3. Visual & Aesthetic Guidelines

- **Canvas Atmosphere:** Deep obsidian dark mode (#050508) with subtle ambient background glows and glassmorphism (`backdrop-blur-md`, 1px border `rgba(255,255,255,0.08)`).
- **Typography:** `Unbounded` for headers, `Plus Jakarta Sans` for UI text, `Geist Mono` for all color codes and contrast scores.
- **Branding:** Watermark credit: `Colors World by: aardevaas`.

---

## 4. Creative Freedom Directive for Claude

Maintain strict performance at 60+ FPS with buttery-smooth micro-interactions. Feel free to introduce creative polish such as animated spring curves, tactile slider responses, or subtle glass highlights that elevate this tool to Awwwards Site of the Day standards.

Please generate the modular React components, OKLCH scale math helpers, contrast heatmap logic, export generators, and responsive layout for Tab 02 (`/builder`).