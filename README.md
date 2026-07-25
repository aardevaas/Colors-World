<div align="center">

  <br />

  <h1>16.7 MILLION COLORS</h1>
  <p><strong>The ultimate Awwwards-grade color workspace, spatial moodboard & typography engine.</strong></p>
  <p><i>Colors World by: aardevaas</i></p>

  <br />

  <p>
    <a href="https://16.7millioncolors.com"><img src="https://img.shields.io/badge/🚀_LAUNCH_LIVE_STUDIO-050508?style=for-the-badge&logoColor=white&border=FF007A" alt="Launch Live Web App"></a>
    <a href="https://github.com/aardevaas/16.7-million-colors/stargazers"><img src="https://img.shields.io/github/stars/aardevaas/16.7-million-colors?style=for-the-badge&color=8A2BE2&logo=github" alt="GitHub Stars"></a>
    <a href="https://github.com/aardevaas/16.7-million-colors/network/members"><img src="https://img.shields.io/github/forks/aardevaas/16.7-million-colors?style=for-the-badge&color=00F5FF&logo=github" alt="GitHub Forks"></a>
    <img src="https://img.shields.io/badge/OKLCH-Native_Math-00FF88?style=for-the-badge" alt="OKLCH Native">
    <img src="https://img.shields.io/badge/Tailwind-v4_Ready-38BDF8?style=for-the-badge" alt="Tailwind v4">
  </p>

  <br />

  <p>
    <a href="#-a-letter-from-the-founder">A Letter from the Founder</a> •
    <a href="#-the-guided-workspace-tour">Workspace Tour</a> •
    <a href="#-developer-code-vault">Code Vault</a> •
    <a href="#-join-the-movement--contribute">Contribute</a> •
    <a href="#-the-open-source-manifesto">Manifesto</a>
  </p>

  <br />

  <img src="https://raw.githubusercontent.com/aardevaas/16.7-million-colors/main/public/preview-banner.png" alt="16.7 Million Colors Studio Preview" width="100%" style="border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 20px 50px rgba(0,0,0,0.8);">

  <br />
  <br />

</div>

---

## 💌 A Letter from the Founder

> *"Every time I kick off a new project, I find myself opening 10 different browser tabs—one for picking swatches, another for generating scale shades, a third for extracting colors from reference photos, one to test UI contrast, and yet another just to check if my typography is readable.*
>
> *It was fragmented, clunky, and exhausting. It pulled me out of my creative flow every single time.*
>
> *The open-source community has given me the foundation for almost everything I’ve ever built. I reached a point where I wanted to stop complaining about broken design workflows and build the studio I always dreamed existed—an all-in-one, Awwwards-grade, zero-cost workspace—and hand it straight back to the community that built me.*
>
> *No paywalls. No subscriptions. No ads. No backend data harvesting. Just raw, high-performance, beautiful color engineering—100% free, forever."*
>
> **— aardevaas**

---

## 🔮 What Makes 16.7 Million Colors Different?

Most web color tools still rely on sRGB or HSL math invented decades ago—causing jarring brightness spikes and muddy dark shades. **16.7 Million Colors** is engineered from the ground up natively in the **OKLCH color space**:

* 🎯 **Perceptually Uniform:** Equal mathematical shifts produce equal visual changes to the human eye.
* 🌈 **Wide-Gamut Ready:** Native support and visual hardware badges for **Display P3** and **Rec2020** screens.
* ⚡ **100% Client-Side Speed:** Runs at 60 FPS in your browser using IndexedDB, WebGL shaders, and pure client-side math. Zero server latency.

---

## 🗺️ The Guided Workspace Tour

Explore the 5 integrated studios built into a single workspace:

### 01 / Library (`/library`) — Infinite Color Discovery
* **Serendipity Shuffle:** GPU-accelerated visual discovery through endless single-color fields.
* **Gemini Vibe Search:** Natural language search powered by free client-side LLM integration (e.g., *"Cyberpunk Tokyo rain"* or *"1970s Italian espresso bar"*).
* **Micro-Section Inspector:** Deep-dive color metrics, gamut hardware checks, and 1-click dock collecting.

---

### 02 / Scale Lab (`/builder`) — Perceptual Scale Generator
* **Preset Step Mechanics:** 1-click pills for **3** (Core Brand Trio), **5** (Classic UI), and **10** (Design Tokens) steps, or custom numeric inputs.
* **OKLCH Curve Scrubbing:** Continuous gradient ribbon scrubber with visual handles for Lightness, Chroma, and Hue Torsion.
* **Collapsible Contrast Matrix Heatmap:** Non-intrusive $N \times N$ APCA/WCAG 2.1 compliance matrix with hover glow guides.

---

### 03 / Studio (`/studio`) — The Infinite 20,000px Spatial Canvas
* **Bounded Spatial Engine:** A 20,000 × 20,000px darkroom light-table with rubber-band boundaries and floating minimap camera snaps.
* **Bento Magnet Engine:** Auto-normalizes dropped images and magnetically docks color swatches into aligned editorial layout bars.
* **Client-Side Image Extractor:** HTML5 Canvas pixel analysis (OKLCH K-Means clustering) extracts dominant color pins directly on reference photos.
* **Ambient Radiance Shaders:** Swatches emit GPU-accelerated ambient glows onto the deep obsidian canvas (`#050508`).

---

### 04 / Visualizer (`/visualizer`) — Live UI Sandbox & Accessibility Lab
* **Bespoke Live UI Mockups:** Real-time interactive testing across SaaS Dashboards, E-Commerce Showcase Cards, Editorial Heroes, and Mobile Apps.
* **WCAG Auto-Fix Engine:** Live contrast badges over text and buttons with a **1-Click Auto-Fix** action that adjusts OKLCH lightness without altering brand hue.
* **Color Vision Deficiency (CVD) Simulator:** Real-time SVG filters for *Protanopia, Deuteranopia, Tritanopia,* and *Achromatopsia*.

---

### 05 / Typography (`/typography`) — Type & Color Pairing Lab
* **3-Way Font Ingestion:** Scan installed Mac Font Book fonts via `window.queryLocalFonts()`, Google Fonts, or Fontshare CDN.
* **8 Typographic Scales:** Modular mathematical scale ratios from Minor Second (`1.067`) to Golden Ratio (`1.618`).
* **Variable Font Axis Controller:** Parametric sliders for Weight (`wght`), Width (`wdth`), Slant (`slnt`), and Optical Size (`opsz`).
* **Fluid CSS `clamp()` Calculator:** Automatic responsive clamp math generation for design token vaults.

---

## ⚡ Developer Code Vault

Generate production-ready design tokens in 1 click directly from the studio:

### Tailwind CSS v4 `@theme`
```css
@theme {
  --color-primary-50: oklch(0.97 0.02 260);
  --color-primary-500: oklch(0.65 0.22 260);
  --color-primary-950: oklch(0.18 0.08 260);
}
