# FEATURE SPECIFICATION & ARCHITECTURE: Tab 03 - `/studio`
# Project: "16.7 Million Colors"
# Brand: "Colors World by: aardevaas"
# Goal: Build an Awwwards-grade, infinite spatial design canvas for moodboarding, asset extraction, and visual UI testing.

Hi Claude,

We are now building Tab 03 (`/studio` - The Infinite Spatial Design Canvas). The Studio acts as an interactive darkroom light-table where designers can drag-and-drop colors, images, text nodes, and UI components into spatial moodboard layouts.

Please implement the `/studio` workspace according to the following architecture, UI/UX specification, and design standards:

---

## 1. Core Canvas Architecture & Spatial Engine

1. **20,000 × 20,000px Bounded Spatial Canvas:**
   - Implement a high-performance pan-and-zoom engine supporting click-and-drag panning, multi-touch pinch zoom, and smooth scroll zooming.
   - Include soft rubber-band boundary tension and a faint glowing perimeter at the 20,000 × 20,000px edge.
   - **Floating Minimap HUD:** Displays a real-time micro view of all active canvas nodes. Tapping `Shift + 0` or clicking the minimap triggers a 60 FPS camera fly-to animation framing all items cleanly.

2. **Zero-Backend Client-Side Persistence:**
   - Automatically save and sync canvas layouts, node positions, uploaded images, and text notes locally using browser **IndexedDB / LocalStorage**. Zero server or database costs required.

---

## 2. Bento Magnet Engine & Resizing Mechanics

1. **Normalized Drop Scale & Corner Resizing:**
   - Dragging an image or color swatch onto the canvas auto-normalizes its initial drop size to a standard modular scale (e.g., 320px width).
   - Every node features sleek, glassmorphic corner handles allowing users to freely drag and resize items.

2. **Magnetic Bento Docking:**
   - **Editorial Palette Docking:** Dragging color swatches within 20px of an uploaded image automatically snaps them into an aligned "Editorial Palette Bar" along the image edge.
   - **Bento Snap Alignment:** Dragging multiple color swatches together snaps them into a clean Bento grid with uniform 12px gaps and springy visual alignment guides.

3. **Double-Tap Focus Zoom:**
   - Double-clicking any group/cluster on the canvas smoothly zooms the camera into that cluster while dimming the surrounding background.

---

## 3. Interactive Spatial Features & Intelligence

1. **Client-Side Image Color Extractor:**
   - Users can drag and drop logos, moodboard photos, or reference images onto the canvas.
   - Runs a fast HTML5 Canvas pixel analysis (K-Means clustering in OKLCH color space) to extract dominant color pins directly onto the image card.
   - Clicking any extracted pin converts it into an independent color card or pushes it to the Floating Harmonic Dock.

2. **Live Spatial UI Preview Nodes:**
   - Users can add interactive UI mockups (buttons, card containers, pricing badges) directly onto the canvas.
   - Dragging a color card near a UI node generates glowing Bezier connection lines that snap between them, instantly applying the color to the live component in real time.

3. **Glassmorphic Text & Sticky Notes:**
   - Double-clicking the canvas adds sleek typography text nodes.
   - Automatically computes WCAG legibility contrast against whatever background or color card it sits on top of.

4. **1-Click Editorial Layout Auto-Arrange:**
   - Includes an `[ Auto-Format Board ]` action that runs an automated layout algorithm, organizing cluttered nodes into a clean, magazine-style moodboard layout.

---

## 4. Visuals, Shaders & Export Vault

1. **Ambient Darkroom "Radiance Shaders":**
   - Each color card on the deep obsidian canvas emits a subtle, GPU-accelerated ambient glow matching its exact color value, transforming the canvas into an illuminated light-table.

2. **High-Res Moodboard PNG Exporter:**
   - 1-click export captures the active canvas or selected nodes into a crisp, high-resolution PNG image (`html2canvas` / `modern-screenshot`).
   - Must cleanly render the official watermark credit in the bottom corner: **`Colors World by: aardevaas`**.

---

## 5. Visual & Aesthetic Guidelines

- **Canvas Atmosphere:** Deep obsidian dark mode (#050508) with glassmorphic node panels (`backdrop-blur-md`, subtle 1px border `rgba(255,255,255,0.08)`).
- **Typography:** `Unbounded` for headings, `Plus Jakarta Sans` for UI/body, `Geist Mono` for technical readouts and values.

---

## 6. Creative Freedom Directive for Claude

You have full creative freedom to add tactile spring physics, GPU shader polish, smooth gesture handles, or keyboard shortcuts that elevate this workspace to Awwwards Site of the Year / FWA standards.

Please generate the modular React components, spatial pan/zoom engine, local IndexedDB persistence, image color extraction logic, and responsive UI for Tab 03 (`/studio`).