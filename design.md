# Visual Design Specification - Modern Glassmorphism Login UI

## 1. Aesthetic Vision
A futuristic, clean, dark-mode visual style using **Glassmorphism**, vibrant gradients, glowing focus states, floating ambient mesh elements, and smooth micro-animations.

---

## 2. Design System Tokens

### 2.1 Color Palette
- **Background Deep**: `#090d16` (Obsidian Dark)
- **Glass Card Fill**: `rgba(17, 24, 39, 0.65)` with `backdrop-filter: blur(16px)`
- **Glass Border**: `rgba(255, 255, 255, 0.12)`
- **Primary Accent**: `#8b5cf6` (Vibrant Purple / Violet)
- **Secondary Accent**: `#06b6d4` (Electric Cyan)
- **Gradient Primary**: `linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)`
- **Text Main**: `#f8fafc` (Off-white / Slate 50)
- **Text Muted**: `#94a3b8` (Slate 400)
- **Input Fill**: `rgba(15, 23, 42, 0.6)`
- **Success Color**: `#10b981` (Emerald)
- **Error Color**: `#f43f5e` (Rose)

### 2.2 Typography
- **Font Family**: `'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
- **Title H1**: `2.25rem (36px)`, Weight 700, Gradient clip effect
- **Body Regular**: `0.95rem (15px)`, Weight 400/500
- **Input Text**: `1rem (16px)`, Weight 400

### 2.3 Visual Effects & Shadows
- **Card Shadow**: `0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)`
- **Input Focus Glow**: `0 0 0 3px rgba(139, 92, 246, 0.35)`
- **Button Hover Glow**: `0 8px 25px rgba(139, 92, 246, 0.45)`

---

## 3. UI Component Specs

### 3.1 Authentication Container Card
- Centered layout, max-width `460px`.
- Border-radius `24px`.
- Tabbed header allowing seamless switching between **Sign In** and **Create Account**.

### 3.2 Form Input Groups
- Floating labels / active focus indicators.
- Prefix icons (Email envelope, Lock key, User badge).
- Password field features toggleable visibility icon (Eye / Eye Off).
- Live password strength visualizer bar (Weak -> Medium -> Strong).

### 3.3 Dynamic Toast Notifications
- Floating notifications top-right of screen.
- Slide-in and fade-out keyframe animations.
- Icons for Success (Check circle), Error (Alert circle), and Info (Info circle).

### 3.4 Protected Dashboard
- Glassmorphic card displaying user avatar badge, full name, email, JWT token state, and active session timer.
- Action button for Logout with confirmation.
