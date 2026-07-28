---
name: Serene Finance
colors:
  surface: '#f5faf8'
  surface-dim: '#d6dbd9'
  surface-bright: '#f5faf8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f5f2'
  surface-container: '#eaefed'
  surface-container-high: '#e4e9e7'
  surface-container-highest: '#dee4e1'
  on-surface: '#171d1c'
  on-surface-variant: '#3d4947'
  inverse-surface: '#2c3130'
  inverse-on-surface: '#edf2f0'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#575e70'
  on-secondary: '#ffffff'
  secondary-container: '#d9dff5'
  on-secondary-container: '#5c6274'
  tertiary: '#924628'
  on-tertiary: '#ffffff'
  tertiary-container: '#b05e3d'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#dce2f7'
  secondary-fixed-dim: '#c0c6db'
  on-secondary-fixed: '#141b2b'
  on-secondary-fixed-variant: '#404758'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#773215'
  background: '#f5faf8'
  on-background: '#171d1c'
  surface-variant: '#dee4e1'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The design system is engineered to facilitate a calm, intentional relationship with personal finance. The target audience consists of privacy-conscious individuals seeking a focused, distraction-free environment for budget management. 

The aesthetic sits at the intersection of **Minimalism** and **Modern Corporate**, prioritizing functional clarity and psychological safety. By utilizing expansive whitespace and a restrained color application, the UI reduces the cognitive load often associated with financial data. The emotional response is one of control, reliability, and precision. High-quality typography and a rigorous adherence to grid systems signal a professional, secure platform where data is the protagonist.

## Colors

This design system utilizes a high-contrast palette optimized for legibility and accessibility. The **Primary Teal** (#0D9488) serves as the core brand anchor, used exclusively for primary actions and meaningful state indicators. 

The background system employs a "Neutral Off-White" to minimize screen glare in light mode, while the "Deep Charcoal" provides a sophisticated, low-fatigue environment for dark mode. Semantic colors (Success, Warning, Error) are calibrated to maintain consistent luminance across both modes, ensuring that financial alerts remain distinct but not jarring.

## Typography

The design system relies on **Inter** for its systematic, utilitarian precision. The typographic hierarchy is strictly enforced to guide the user through complex financial datasets. 

Headlines use tighter letter-spacing and heavier weights to create focal points for account balances and category titles. Body text prioritizes line-height to maintain readability during long sessions of transaction reviewing. Labels utilize a slightly increased letter-spacing and uppercase styling for secondary metadata to ensure clear differentiation from primary content.

## Layout & Spacing

This design system uses a **Fluid Grid** approach with a modular 8px baseline rhythm. For mobile (PWA), a 4-column layout is standard, transitioning to a 12-column layout for desktop views.

- **Margins:** 16px on mobile devices to maximize screen real estate; 48px on desktop to maintain a centered, focused content area.
- **Gutters:** Fixed at 16px to ensure consistent breathing room between data cards.
- **Rhythm:** Vertical spacing between components should follow the `lg` (24px) or `xl` (32px) tokens to preserve the minimalist, "airy" feel. Smaller `sm` (8px) units are reserved for internal element grouping within cards.

## Elevation & Depth

Visual hierarchy is achieved through a combination of **Tonal Layers** and **Ambient Shadows**. Instead of heavy shadows, the system uses "Soft Depth" to define interactable surfaces.

- **Level 0 (Base):** Off-white or Charcoal background.
- **Level 1 (Cards):** Subtle 1px border (#E5E7EB in light / #374151 in dark) with a very diffused, 4% opacity shadow.
- **Level 2 (Modals/FABs):** Increased shadow spread (12% opacity) to create a distinct "floating" effect, indicating higher z-index priority.
- **Backdrops:** All modal overlays must use a `blur(8px)` backdrop filter with a semi-transparent (60%) fill of the surface color to maintain context while focusing user attention.

## Shapes

The shape language is defined by **Rounded** geometry, softening the often-rigid nature of financial data. 

Standard components (buttons, input fields) use a 0.5rem (8px) radius. Containers and cards use the `rounded-xl` (1.5rem / 24px) token to create a friendly, modern "app-like" feel characteristic of high-end PWAs. Interactive elements like Category Chips or Floating Action Buttons (FABs) use fully pill-shaped (3rem) rounding to maximize their touch-target visibility and differentiate them from informational containers.

## Components

### Buttons & FABs
Primary buttons are solid Teal with white text. The Floating Action Button (FAB) is a signature element, positioned at the bottom-right, using the `rounded-xl` shape and Level 2 elevation. It should only house the "Add Transaction" primary action.

### Cards
Financial summaries and transaction groups are housed in cards. Cards feature a 24px corner radius, a subtle 1px border, and a soft ambient shadow. Internal padding is strictly 20px or 24px.

### Inputs & Selection
Input fields are "ghost" style: background matches the surface level, defined by a 1px border that thickens and changes to Primary Teal on focus. Checkboxes and radios use the Primary Teal for active states.

### Category Chips
Chips include a 6px color-coded dot (dot-indicator) aligned to the left of the label. The background of the chip should be a 10% opacity tint of the category color to ensure high-contrast text remains legible.

### Navigation
The PWA utilizes a bottom navigation bar on mobile with outline-style icons. Active states are indicated by a change in icon stroke weight (from 1.5px to 2px) and a color shift to Primary Teal.

### Data Visualization
Progress bars and donut charts use a 12px stroke width. The "remaining" portion of a budget uses a low-contrast neutral gray, while the "spent" portion uses the semantic colors (Success/Warning/Error) based on the percentage of the budget consumed.