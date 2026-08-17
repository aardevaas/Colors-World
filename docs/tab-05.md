# FEATURE SPECIFICATION & ARCHITECTURE: Tab 05 - `/typography`
# Project: "16.7 Million Colors"
# Brand: "Colors World by: aardevaas"
# Goal: Build an Awwwards-grade, interactive typography & color pairing lab, optical legibility engine, and fluid CSS scale generator.

Hi Claude,

We are now building Tab 05 (`/typography` - Typography & Color Pairing Lab). This tab allows designers and developers to test color palettes directly on web typography, audit optical legibility, manipulate variable font axes, calculate fluid CSS clamp() math, and export high-res type specimens.

Please implement the `/typography` workspace according to the following architecture, UI/UX specification, and design standards:

---

## 1. Core Architecture & Font Ingestion Engine

1. **3-Way Zero-Cost Font Ingestion Pipeline:**
   - **Local System Font Access API:** Implement `window.queryLocalFonts()` allowing users to safely scan and test their installed Mac Font Book or Windows system fonts directly inside the browser ($0 hosting/server cost, zero copyright risk).
   - **Google Fonts API Integration:** Dynamic SIL Open Font loading via CDN.
   - **Fontshare CDN Integration:** Direct loading for high-end commercial-grade free fonts (`Cabinet Grotesk`, `Switzer`, `Satoshi`, `Clash Display`).

2. **Dock-to-Role Mapping:**
   - Ingests active color palettes from previous tabs and maps them to semantic typography roles:
     * `--type-display` (Headings)
     * `--type-body` (Paragraphs)
     * `--type-accent` (Links, Badges, Drop caps)
     * `--type-bg` (Background Canvas)
     * `--type-selection` (Text selection / highlight color)

---

## 2. Font Presets & Typographic Scale Mathematics

1. **Short-Named Font Pair Presets:**
   - **Neo-Tech:** `Unbounded` + `Plus Jakarta Sans` + `Geist Mono`
   - **Editorial:** `Playfair Display` + `Switzer` + `JetBrains Mono`
   - **Swiss:** `Cabinet Grotesk` + `Inter` + `Fira Code`
   - **Brutalist:** `Clash Display` + `Satoshi` + `Space Mono`
   - **Local:** Direct pipeline from user's installed Mac Font Book

2. **Complete 8-Ratio Typographic Scale Selector:**
   - Allow users to switch between 8 mathematical scale ratios:
     1. `1.067` (Minor Second - Compact tables/mobile)
     2. `1.125` (Major Second - Clean UI)
     3. `1.200` (Minor Third - Balanced web app)
     4. `1.250` (Major Third - Gold standard default)
     5. `1.333` (Perfect Fourth - Classic editorial)
     6. `1.414` (Augmented Fourth - High header contrast)
     7. `1.500` (Perfect Fifth - Hero marketing)
     8. `1.618` (Golden Ratio - Cinematic jumps)

---

## 3. Interactive Feature Suite & Modules

### Module A: Parametric & Variable Font Axis Controller
- Live parametric controls for Font Size, Line Height (leading), Letter Spacing (tracking), and Paragraph Gap.
- **Variable Font Axis Controller:** Collapsible slider panel for variable font axes:
  * **Weight (`wght`):** 100 to 900
  * **Width (`wdth`):** Condensed to Expanded
  * **Slant/Italic (`slnt`):** 0° to 12°
  * **Optical Size (`opsz`):** Dynamic glyph shape optimization.

### Module B: Optical Legibility & Font-Weight Contrast Audit
- Real-time legibility score calculated using **Font Size + Font Weight + OKLCH Lightness Difference**.
- **1-Click `[Auto-Fix Text Weight]` Action:** If thin text fails optical readability, clicking `[Auto-Fix]` shifts either the font weight up or adjusts the OKLCH lightness threshold to guarantee crisp legibility.
- **Live Text Selection Tester:** Interactive widget allowing users to test custom text selection colors (`::selection`) in real time.

### Module C: Fluid CSS `clamp()` Engine
- Real-time generator outputting responsive CSS clamp functions combining viewports and rems:
  `--font-h1: clamp(2.25rem, 5vw + 1rem, 4.5rem);`
- 1-click copy for custom CSS variables or Tailwind v4 token blocks.

### Module D: Specimen Views & Interactive Glyph Sheet
- **3 Layout Views:**
  1. *Magazine Article:* Hero headline, pull quote, drop caps, multi-column body text.
  2. *Doc & Code Block:* Inline code, syntax-highlighted code block, callouts.
  3. *Atomic Hierarchy Ladder:* Vertical ladder displaying H1 through Caption with exact rem/px readouts.
- **Interactive Glyph Sheet:** Collapsible modal displaying the selected font's full character map (Uppercase, Lowercase, Numerals, Symbols, Ligatures) styled in the active OKLCH palette.

### Module E: High-Res Specimen Export
- 1-click `"Export Type Specimen"` captures the layout as a crisp PNG (`html2canvas` / `modern-screenshot`).
- **Watermark Rule:** Place the watermark credit (`Colors World by: aardevaas`) on a **dedicated semi-transparent footer bar below the specimen frame** so it looks premium by default while remaining easy to crop out.

---

## 4. Visual & Aesthetic Guidelines

- **Background:** Deep obsidian dark mode (`#050508`) with subtle glassmorphism (`backdrop-blur-md`, 1px border `rgba(255,255,255,0.08)`).
- **Typography:** `Unbounded` for headings, `Plus Jakarta Sans` for UI text, `Geist Mono` for technical readouts and CSS code.

---

## 5. Creative Freedom Directive for Claude

You have full creative freedom to add smooth spring slider physics, tactile typography controls, or interactive preview features that elevate this tab to Awwwards Site of the Year standard.

Please generate the modular React components, local font scanning logic, optical legibility math, fluid clamp calculators, and layout for Tab 05 (`/typography`).