---
name: Carmen AI Automation
description: AI-powered accounting automation for Carmen Cloud ERP
colors:
  carmen-blue: "oklch(0.4714 0.1794 258.7)"
  carmen-blue-light: "oklch(0.95 0.014 258.7)"
  carmen-blue-mid: "oklch(0.88 0.04 258.7)"
  carmen-blue-dark: "oklch(0.4 0.18 258.7)"
  process-teal: "oklch(0.5852 0.1706 253.27)"
  process-teal-light: "oklch(0.95 0.014 253.27)"
  alert-rose: "oklch(0.666 0.2013 24.11)"
  alert-rose-light: "oklch(0.95 0.025 24.11)"
  alert-rose-mid: "oklch(0.84 0.08 24.11)"
  caution-amber: "oklch(0.78 0.15 75)"
  caution-amber-light: "oklch(0.97 0.025 75)"
  caution-amber-mid: "oklch(0.9 0.08 75)"
  success-emerald: "oklch(0.7515 0.1117 188.43)"
  success-emerald-light: "oklch(0.96 0.025 188.43)"
  surface-body: "oklch(0.9 0.014 258.7)"
  surface-card: "oklch(1 0 0)"
  surface-muted: "oklch(0.95 0.008 258.7)"
  ink-primary: "oklch(0.16 0.02 258.7)"
  ink-secondary: "oklch(0.33 0.018 258.7)"
  ink-tertiary: "oklch(0.56 0.016 258.7)"
  ink-quaternary: "oklch(0.7 0.014 258.7)"
  border-subtle: "oklch(0.91 0.008 258.7)"
  border-raised: "oklch(0.84 0.01 258.7)"
typography:
  headline:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, Sarabun, -apple-system, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, Sarabun, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, Sarabun, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.08em"
  data:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.83rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.01em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "9px"
  lg: "14px"
  xl: "20px"
  pill: "100px"
spacing:
  xs: "0.35rem"
  sm: "0.65rem"
  md: "1.25rem"
  lg: "1.75rem"
  xl: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.carmen-blue}"
    textColor: "oklch(1 0 0)"
    rounded: "{rounded.md}"
    padding: "0.65rem 1.5rem"
  button-primary-hover:
    backgroundColor: "{colors.carmen-blue-dark}"
    textColor: "oklch(1 0 0)"
  button-outline:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "0.65rem 1.25rem"
  button-outline-hover:
    backgroundColor: "{colors.carmen-blue-light}"
    textColor: "{colors.carmen-blue}"
  button-danger:
    backgroundColor: "{colors.alert-rose-light}"
    textColor: "{colors.alert-rose}"
    rounded: "{rounded.md}"
    padding: "0.65rem 1.25rem"
  button-danger-hover:
    backgroundColor: "{colors.alert-rose}"
    textColor: "oklch(1 0 0)"
  badge-info:
    backgroundColor: "{colors.carmen-blue-light}"
    textColor: "{colors.carmen-blue}"
    rounded: "{rounded.pill}"
    padding: "0.28rem 0.7rem"
  badge-success:
    backgroundColor: "{colors.success-emerald-light}"
    textColor: "{colors.success-emerald}"
    rounded: "{rounded.pill}"
    padding: "0.28rem 0.7rem"
  badge-warning:
    backgroundColor: "{colors.caution-amber-light}"
    textColor: "{colors.caution-amber}"
    rounded: "{rounded.pill}"
    padding: "0.28rem 0.7rem"
  badge-error:
    backgroundColor: "{colors.alert-rose-light}"
    textColor: "{colors.alert-rose}"
    rounded: "{rounded.pill}"
    padding: "0.28rem 0.7rem"
---

# Design System: Carmen AI Automation

## 1. Overview

**Creative North Star: "The Instrument Panel"**

Carmen AI Automation is a tool where the stakes are real: extracted numbers go directly into GL entries. The interface treats every pixel as a readout, not a decoration. Surfaces recede. Headers read like panel labels. Numeric values surface in monospace, unambiguous. Motion conveys state, not atmosphere. The tool is precise because the work demands precision.

The system rejects the SaaS playbook entirely. There are no gradient text treatments, no hero metrics with big numbers and gradient accents, no celebratory animations for routine accounting tasks, and no enterprise-legacy chrome (thick borders, beige fills, Sage-era form controls). The palette is restrained: one brand accent used as a state indicator, not an identity statement. Color communicates "this needs your attention" or "this is confirmed" — never "look how polished we are."

Thai and English are equally considered. Sarabun sits alongside Inter in every font stack. Vendor names, GL labels, and invoice text arrive in Thai; every layout decision accounts for it. A field that truncates English properly must truncate Thai properly too, with matching line-height and line-break behavior.

**Key Characteristics:**
- Surfaces recede; data leads. Card chrome is minimal so extracted values stand forward.
- Mono for amounts, Inter/Sarabun for everything else. The distinction is structural.
- Color = state. Carmen Blue signals the active action or current step. Teal, Emerald, Rose, and Amber signal AP module context, success, error, and caution respectively. None of them decorate.
- Dark mode is first-class. Every token has a dark variant; no surfaces use raw hex that breaks at night.
- Workflow-first layout. Every screen belongs to a step in the document-processing flow. Navigation exists to move users forward, not to expose surface area.
- 44px minimum tap targets on mobile. Accounting tools are used on tablets; touch ergonomics matter.

---

## 2. Colors: The Carmen Palette

A restrained two-accent system: one identity accent (Carmen Blue, primary actions and current state), one module accent (Process Teal, AP invoice surfaces and info states), plus a four-color semantic vocabulary for document-validation feedback. Neutrals are brand-hue-tinted at low chroma rather than pure gray.

### Primary

- **Carmen Blue** (`oklch(0.4714 0.1794 258.7)`): The single brand accent. Used for primary buttons, active step indicators, focus rings, hover states on interactive rows, and current-selection borders. Every interactive affordance the user needs to act on wears Carmen Blue. Its rarity outside of those roles is what makes it legible as a call to action.
- **Carmen Blue Light** (`oklch(0.95 0.014 258.7)`): Tinted surface for primary-tinted states (hovered rows, selected bank options, button hover backgrounds, active step badge fills). Never used as a base background; only as a response-to-state fill.
- **Carmen Blue Mid** (`oklch(0.88 0.04 258.7)`): Border color for primary-tinted surfaces. Separates the tinted fill from the neutral surroundings without requiring a shadow.
- **Carmen Blue Dark** (`oklch(0.4 0.18 258.7)`): Hover state for primary buttons only. 120ms transition from base to dark.

### Secondary

- **Process Teal** (`oklch(0.5852 0.1706 253.27)`): The AP invoice module accent and the system's info semantic color. Appears as the module accent in the header (`data-module="ap-invoice"`), as the button-success variant (post-submission actions), and in info status badges. Visually distinct from Carmen Blue at a glance — slightly greener — despite sharing hue territory.
- **Process Teal Light** (`oklch(0.95 0.014 253.27)`): Tinted surface for teal-state fills, same role as Carmen Blue Light within the AP invoice context.

### Tertiary (Semantic Vocabulary)

Four-color semantic set. Each color has a light surface variant and a mid border variant. Used exclusively to communicate document-validation state, not for decoration.

- **Alert Rose** (`oklch(0.666 0.2013 24.11)`): Error, destructive actions, missing required cells in the review table, the danger button fill on hover. In the review table, a missing-cell combination of rose text on rose-light background with a rose-mid dashed border makes errors impossible to miss.
- **Caution Amber** (`oklch(0.78 0.15 75)`): Warning states, mapping alerts when GL codes need attention, the warning modal icon. Never used as an action color.
- **Success Emerald** (`oklch(0.7515 0.1117 188.43)`): Completed step indicators (the step-num gets a gradient from Emerald to #34d399), the active upload border, success badges, and the "System Online" dot on the home page. The step-num gradient (`linear-gradient(135deg, var(--emerald) 0%, #34d399 100%)`) is the one deliberate gradient in the system — reserved for "this step is done."

### Neutral

The gray scale is not pure gray — every neutral carries a trace of Carmen Blue's hue (258.7°) at chroma 0.005–0.022. This makes the surface feel part of the same system without being obviously tinted.

- **Surface Body** (`oklch(0.9 0.014 258.7)`): Page background. Darker than a typical "near-white" at L 0.9; it creates clear visual separation from cards at L 1.0.
- **Surface Card** (`oklch(1 0 0)`): Card background (pure white). Used for panel-cards, data-cards, and modal boxes. The white-on-body contrast creates depth without shadows alone.
- **Surface Muted** (`oklch(0.95 0.008 258.7)`): Secondary surface inside cards — card title bars, table header rows, form action bars. Lower chroma than body; reads as slightly cooler than the card face.
- **Ink Primary** (`oklch(0.16 0.02 258.7)`): Headings, module card names, modal titles, confirmed-value text. Near-black with a hint of brand hue.
- **Ink Secondary** (`oklch(0.33 0.018 258.7)`): Card title text, body copy in cards, data table cell values. Slightly lighter than primary ink.
- **Ink Tertiary** (`oklch(0.56 0.016 258.7)`): Subtitles, helper text, placeholder equivalents, table header labels, bank option names. Verify against surface-card (white): passes WCAG AA at ≥4.5:1.
- **Ink Quaternary** (`oklch(0.7 0.014 258.7)`): The quietest text layer. Used for version strings, elapsed-time readouts, secondary metadata. Verify on every background; border on WCAG AA for body text — use only for non-essential information at 14px+ sizes.
- **Border Subtle** (`oklch(0.91 0.008 258.7)`): Standard card borders, table cell separators, input borders at rest, separator lines. Low-contrast by design; structure, not decoration.
- **Border Raised** (`oklch(0.84 0.01 258.7)`): Emphasized borders — outline button edges, modal outline, step separator borders. Slightly darker than subtle, used to mark interactive boundaries.

**The One Voice Rule.** Carmen Blue appears on ≤15% of any given screen. When every action and every active state wears the same color, that color retains its signal value. Do not use Carmen Blue for decorative gradients, section dividers, or inactive-state backgrounds.

**The No-Raw-Hex Rule.** All color values must reference a CSS custom property from `:root`. Never hardcode a hex or OKLCH value directly in component code. Dark mode works because every token has a `[data-theme='dark']` override.

---

## 3. Typography

**Body Font:** Inter (300/400/500/600/700/800), -apple-system, sans-serif
**Thai Body Font:** Sarabun (300/400/500/600) — loaded alongside Inter; applies to Thai-script content via the shared font stack
**Data/Mono Font:** IBM Plex Mono (400/500)

**Character:** Inter carries the interface — navigation, labels, body, buttons. IBM Plex Mono carries the data — amounts, account codes, document numbers, elapsed times. The pairing is functional, not expressive: the switch from proportional to monospaced type is a signal that "this is a number you should verify," not a style choice. Sarabun matches Inter's weight range and humanist feel; it doesn't compete or clash when Thai and Latin text appear in the same line.

### Hierarchy

- **Headline** (700, 1.05rem, lh 1.2, ls -0.01em): Modal titles, card section headings, step titles within wizards. Confident but compact — this is product UI, not editorial. Never used above ~1.3rem outside of the home hero.
- **Title** (700, 0.9–1.0rem, lh 1.3, ls -0.015em): Module card names, data card titles, confirmation screen titles. The primary visual anchor within a card surface.
- **Body** (400–500, 0.875rem, lh 1.65): Descriptive text, module card descriptions, modal messages, how-to steps. Max line length 65ch on prose surfaces. Tables and form labels run denser.
- **Label** (700, 0.68–0.72rem, UPPERCASE, ls 0.06–0.12em): Form field labels, table column headers, step badge text, card eyebrows. Short (under 4 words), uppercase, tracked. Reserved exclusively for labels — never for body copy or headings.
- **Data** (IBM Plex Mono 400–500, 0.8–0.85rem, lh 1.4, ls -0.01em): All financial amounts, account codes, document numbers, bank codes, version strings, elapsed time readouts. Right-aligned for numeric columns. The visual signal that "this is a value, not prose."

**The Mono Signal Rule.** IBM Plex Mono appears only on values the user must verify: amounts, codes, dates in `DD/MM/YYYY` format, status strings, elapsed timers. It does not appear on headings, button labels, or descriptive text. If a piece of text is formatted in mono, it is data. If it is data, it must be in mono.

**The Scale Ceiling Rule.** No heading in the product exceeds `clamp(2.1rem, 5vw, 2.6rem)` (the home page h1). Module-internal headings are capped at 1.1rem. Product UI does not shout; it organizes.

---

## 4. Elevation

The system uses a layered, structured shadow vocabulary with brand-blue hue tinting. Shadows are not purely neutral gray — every layer carries a trace of `oklch(0.25 0.03 258.7)` at low opacity, tying elevated surfaces back to the brand color even at the shadow level. Cards sit above the body through a combination of: (1) background value contrast (card = L 1.0 vs. body = L 0.9), (2) a multi-layer outer shadow, and (3) an inset highlight (`inset 0 1px 0 rgba(255,255,255,0.9)`) that creates a subtle top-edge lift.

### Shadow Vocabulary

- **Shadow XS** (`0 0.0625rem 0.125rem oklch(0.25 0.03 258.7 / 0.04)`): Micro-lift for small UI elements. File-info strips, row-count badges, small tool buttons.
- **Shadow SM** (`0 0.0625rem 0.25rem ... / 0.07, 0 0.0625rem 0.125rem ... / 0.04`): Default card shadow. Module cards and panel cards at rest. Combined with the inset highlight.
- **Shadow MD** (`0 0.25rem 0.5rem ... / 0.09, 0 0.125rem 0.25rem ... / 0.05`): Hover state on cards, document preview toolbar. Used as a hover upgrade from SM.
- **Shadow LG** (`0 0.5rem 0.875rem ... / 0.09, 0 0.25rem 0.375rem ... / 0.05`): Hover state on elevated cards, floating dropdowns, active-step panel-card pulse. Signals interactivity.
- **Shadow XL** (`0 1rem 1.5rem ... / 0.09, 0 0.5rem 0.625rem ... / 0.04`): Modals and loading overlays. The maximum depth in the system.
- **Shadow Primary** (`0 4px 18px oklch(0.4714 0.1794 258.7 / 0.2)`): Exclusive to primary buttons and the active step indicator. Carmen Blue glow; not used on neutral surfaces.
- **Shadow Teal** (`0 4px 16px oklch(0.5852 0.1706 253.27 / 0.18)`): Exclusive to the success/teal button variant (post-submission action). Same construction as Shadow Primary.

**The Flat-By-Default Rule.** Shadows appear only on surfaces that contain or represent interactive content (cards the user acts on, buttons, active inputs). Purely structural surfaces (dividers, separators, empty containers) are flat. A shadow is a promise that something is interactive or elevated — do not make that promise on decorative elements.

**The One-Layer-of-Blur Rule.** Backdrop blur (`backdrop-filter: blur`) is reserved for the sticky app-header (14px), modal overlays (16px), toast containers (16px), and the OCR loading overlay (8px). It is never applied to cards, panels, or inline UI. Decorative glassmorphism is explicitly prohibited.

---

## 5. Components

### Buttons

Buttons use a 9px radius (rounded.md) across all variants. The shape is consistent system-wide — no square-cornered or fully-rounded variants break the vocabulary.

- **Primary** (`.btn-primary`): Carmen Blue fill, white text, 0.65rem/1.5rem padding, shadow-primary glow. The single most visually prominent element on any screen. Hover: darkens to carmen-blue-dark, lifts 2px. Active: scales to 0.97. Disabled: 0.42 opacity, no shadow, no transform.
- **Submit** (`.btn-submit`): Identical to primary; used specifically in form-actions footers. Padding 0.65rem/1.5rem. Always the rightmost button in form-actions.
- **Outline** (`.btn-outline`): White card-bg fill, border-raised border, ink-secondary text. Hover: carmen-blue-light fill, carmen-blue text, carmen-blue-mid border. The secondary action on any given screen.
- **Cancel** (`.btn-cancel`): White fill, border-raised border, ink-tertiary text. Hover: gray-50 fill, gray-400 border, ink-secondary text. Never carries a shadow.
- **Success/Teal** (`.btn-success`): Process Teal fill, white text, shadow-teal glow. Used exclusively for post-submission actions ("Return to Carmen", "Submit to GL"). Not for generic "confirm" flows.
- **Danger** (`.btn-danger`): Alert-rose-light fill, alert-rose text, alert-rose-mid border. Hover: fills to solid rose with white text. For destructive confirmation actions (overwrite, delete row).
- **Destructive Solid** (`.btn-overwrite`): Alert-rose fill, white text. For the most severe destructive action on a given screen where danger-soft would be insufficient. Used sparingly — one per destructive flow at most.
- **Icon** (`.btn-icon`): 36×36px, rounded.md, white fill, border-raised border. Hover: primary-light fill, carmen-blue text and border. Used for toolbar actions, re-extract, and secondary controls within cards.

### Status Badges

Pill-shaped (rounded.pill), 0.72rem text, 600 weight. Semantic colors only — each badge communicates one meaning system-wide.

- **Info**: carmen-blue-light fill, carmen-blue text, carmen-blue-mid border. "ACTIVE" modules, current-step indicators.
- **Success**: success-emerald-light fill, success-emerald text, emerald border. "Posted", "Complete" states.
- **Warning**: caution-amber-light fill, amber text, amber-mid border. GL mapping alerts, quota warnings.
- **Error/Danger**: alert-rose-light fill, alert-rose text, rose-mid border.
- **Neutral**: gray-200 fill, ink-tertiary text, gray-300 border. "COMING SOON" and inactive-module tags.

### Cards / Containers

Two card species: **panel-card** (user works inside it, interactive content) and **data-card** (displays extracted data, less interactive).

- **Panel Card** (`.panel-card`): card-bg fill, subtle border (`rgba(255,255,255,0.7)` — semi-transparent to let body color bleed slightly), 14px radius (rounded.lg), 1.5rem padding. Multi-layer shadow: inset highlight + outer layers. Hover: shadow upgrades from SM to LG equivalent; lifts 2px. The active step has a `pulse-ring` outline animation in Carmen Blue; the upload-active state uses Emerald.
- **Data Card** (`.data-card`): Identical shadow and fill to panel-card. No hover transform — data cards don't invite the same pointer interaction. Has a card-title bar (surface-muted fill, 0.875rem/600/ink-secondary) that separates the header from the body. Card-body padding 1.5rem; card-body-flush is 0 for table-adjacent surfaces.
- **Module Card** (`.module-card`): Home page only. Rounded.xl (20px), box-shadow-sm, `--card-accent` CSS variable overrides border and arrow color per module. Banner area (96px, surface-muted fill) holds the icon. Hover: lifts 3px, border shifts to card-accent color, arrow circle fills with card-accent. Coming-soon variant: 0.3 grayscale filter, no hover interaction.
- **Modal Box** (`.modal-box`): Rounded.xl, shadow-xl, 2.5rem/2.25rem padding. 420px max-width, backdrop-blur(16px) overlay. Entry animation: `modalScaleIn` (scale 0.95 + 12px Y → normal, 300ms expo-out). Centered icon with semantic color variant (info/success/warning/error), each a 52px rounded.lg icon container.

### Inputs / Fields

Two input paradigms coexist:

- **Bottom-border field** (`.form-field input`): Transparent background, no box, `border-bottom: 1.5px solid border-subtle`. Focus: border-bottom shifts to carmen-blue. Inter/Sarabun 0.9rem, 500 weight, ink-primary text. Used in the header form section (company info, dates, document number) where the data feels more like filling in a form than using an input control.
- **Bordered table input** (`.detail-input`): transparent fill, transparent border at rest, rounded.sm. Hover: border-subtle border appears, white fill. Focus: carmen-blue border, carmen-blue-light fill. IBM Plex Mono 0.83rem. Used inside the review data table so values feel like they live in a ledger, not a form.
- **Modal input** (`.modal-input`): Bordered with 8px radius, 1.5px border-subtle border. Focus: carmen-blue border, `0 0 0 3px carmen-blue-light` focus ring. Background `var(--bg-2, #f9fafb)`.

All inputs use the same focus treatment: carmen-blue border + (where applicable) carmen-blue-light ring or fill. The ring width is 3px via `box-shadow: 0 0 0 3px`. No outline; focus-visible is handled via CSS `outline: 2.5px solid var(--primary)`.

### Navigation

- **App Header** (`.app-header`): Sticky at `top: 0.75rem`, z-index 50. Backdrop-blur 14px + saturate 1.4 over a semi-transparent card-bg fill. Rounded.xl. Contains: back button (pill shape, muted-bg, scales to module-accent on hover), separator, logo box (38×38px rounded.md in module-accent color, white logo SVG), brand text (eyebrow label + module title), and actions slot. A 1px gradient line at the bottom edge traces from transparent to module-accent back to transparent — a subtle module-identity marker.
- **Step Wizard** (`.step-wizard`): Sticky pill bar below the header. Card-bg fill, rounded.xl, border-subtle border, shadow-sm. Steps show: number (22px circle in IBM Plex Mono), label (hidden on mobile except active). Active step: Framer Motion animated pill in Carmen Blue wraps the active step; text is white. Done step: emerald text, gradient-filled step-num circle. Separator: 2px border-subtle line, max 40px wide.
- **Back Button** (`.app-header-back`): Pill (100px radius), 32px height, muted-bg fill. Hover: fills with module-accent-soft, text and border shift to module-accent, arrow icon slides 2px left.

### Signature: Upload Drop Zone

The upload experience is one of the most visually distinctive components. The drop zone (`.upload-drop`) uses a subtle diagonal gradient from near-white to a faint purple tint (`rgba(240,236,255,0.4)`) — this is the one deliberate surface tint in the system, marking the zone as "magical" relative to the surrounding neutral surfaces. It is not a background color declaration; it is an invitation.

States:
- At rest: dashed border-raised border, gradient fill, gray icon, gray hint text in IBM Plex Mono.
- Hover: solid carmen-blue border, carmen-blue-light fill, `0 0 0 3px primary-glow` ring, icon lifts and turns blue, icon scales 1.1.
- Drag-over: border becomes solid, ring increases to 4px, shadow-md adds depth, zone scales 1.01.
- Dropping (file released): scales down briefly to 0.98 (120ms fast ease) before confirming.

### Signature: Loading Overlay

The OCR loading overlay (`.ocr-loading-overlay`) uses `backdrop-filter: blur(8px)` over a dark scrim (`rgba(15,23,42,0.6)`). The loading box is white with shadow-xl and a 3px shimmer gradient (`linear-gradient(90deg, carmen-blue, process-teal)`) animating across the top edge. This primary-to-teal shimmer is the visual signal that the AI is processing — it appears only here and on the extraction status strip.

---

## 6. Do's and Don'ts

### Do:
- **Do** use IBM Plex Mono for every financial amount, account code, document number, and date value. The switch to mono is the visual signal that this is data the user must verify.
- **Do** give every interactive element a focus-visible ring: `outline: 2.5px solid var(--primary)` with `outline-offset: 2px`. WCAG AA requires it; the accounting workflow involves keyboard navigation between fields.
- **Do** reference CSS custom properties for every color. `var(--primary)` not `oklch(0.4714 0.1794 258.7)` in component code. Dark mode depends on this contract.
- **Do** use the 44px minimum tap target for all buttons on mobile (`min-height: 44px` at `max-width: 768px`).
- **Do** apply `@media (prefers-reduced-motion: reduce)` for every animation. The global rule in `base.css` already handles this, but any new `transition` or `animation` must respect it.
- **Do** apply `text-wrap: balance` on headings (h1–h3) and `text-wrap: pretty` on modal messages and card descriptions to prevent orphan words.
- **Do** treat the step wizard as the primary navigation metaphor. Users are always in a step; the current step is always visible. New screens must integrate with the wizard, not work around it.
- **Do** verify Ink Tertiary (`oklch(0.56 0.016 258.7)`) against its background on every new surface. It passes AA on white but approaches the floor; anything smaller than 14px or lighter than 500 weight needs a darker ink value.
- **Do** include all five button states in every new button variant: default, hover, focus-visible, active (scale 0.97), and disabled (0.42–0.55 opacity, no shadow, no pointer cursor).
- **Do** use the Sarabun font stack (not just Inter) on every text element that may contain Thai script — vendor names, GL labels, invoice descriptions, bank names.

### Don't:
- **Don't** add `background-clip: text` with a gradient background. Gradient text is prohibited. Use a single solid color; emphasis through weight or size.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, alerts, or list items. The existing toast component uses this pattern (`border-left: 4px solid var(--emerald)`) — this is a legacy issue, not a template to follow. New alert components use full-border + background-tint instead.
- **Don't** use `backdrop-filter: blur` on cards, panel surfaces, or inline UI elements. It is reserved for the three blurred surfaces in the system: app-header, modal overlays, and the OCR loading overlay.
- **Don't** introduce a display font. Inter handles all hierarchy. No serif, no script, no variable font with dramatic weight extremes. Product UI typography uses weight contrast within one family.
- **Don't** add a flash AI SaaS aesthetic: no hero-metric big-number layouts, no gradient accents on decorative elements, no celebration animations for the standard upload-to-submit flow.
- **Don't** use Carmen Blue on more than 15% of a given screen surface. If every border, every divider, and every label wears the brand color, it stops signaling action and starts being noise.
- **Don't** use modal-first for actions where an inline confirmation or a toast would work. Modals are reserved for genuinely destructive or irreversible operations (overwrite, session expiry, quota exceeded) and for inputs that require deliberate entry.
- **Don't** hardcode `#1e293b`, `rgba(255,255,255,0.9)`, or any raw hex/rgba in new component code. These appear in the legacy CSS; future additions must reference tokens. The dark-mode contract breaks on raw values.
- **Don't** ship a new workflow screen without empty states. Every table, every data column, and every result area must render something useful before data arrives — either a skeleton or an instructional empty state that teaches the next step.
- **Don't** animate layout properties (`width`, `height`, `top`, `left`, `padding`). Animate `transform` and `opacity` only. Every entrance in this system uses `translateY` + `opacity` (fadeUp, fadeDown, modalScaleIn) — match this pattern.
- **Don't** use the `.home-modules-title` uppercase tracked eyebrow pattern on interior screens. "Select Module" on the home page is a one-time deliberate use of that pattern. It is not a reusable section-label template.

---

## 7. Showcase Layer (marketing surfaces only)

The core system is product-register and deliberately restrained (§1). The **pricing/marketing surface** (`/pricing`, the "ระบบ AI ช่วยงานบัญชี" feature section) is the one place that legitimately needs to *sell* the AI, so it gets a **sanctioned, narrowly-scoped exception** — a "showcase layer." This exists to host the three feature infographics (Credit Card, AP Invoice, GL Suggestion) ported from the design mock, refined to fit the system.

**What the showcase layer permits (and nothing more):**
- **Richer elevation** via `--showcase-shadow` and a larger `--showcase-radius` (20px) on the feature cards — premium but still light.
- **Soft accent header washes**: a feature card header may use a light gradient wash built from the feature accent via `color-mix` (e.g. `linear-gradient(135deg, color-mix(in srgb, var(--flow) 14%, var(--card-bg)), var(--card-bg))`). The accent (`--flow`) maps to the existing palette: blue=`--primary`, emerald=`--emerald`, teal=`--teal`.
- **Story motion**: the input→process→output pipeline may animate as a staged reveal (auto-played when scrolled into view), longer than core UI (`--showcase-dur` ≈ 380ms). It conveys the *flow*, which is the section's whole point — this is the documented exception to "motion conveys state, not atmosphere."

**The showcase layer still obeys the core rules — these are NOT relaxed:**
- **No dark fills / banners.** All surfaces stay light; dark bands read as stray dark-mode among the light plan cards. Expressiveness comes from wash + accent + elevation + motion, never a dark surface.
- **No gradient text, no hero-metric template, no glassmorphism.**
- **WCAG AA everywhere.** Accent-as-foreground uses the AA, theme-aware `--flow-strong` tier; the light `--flow` token is for tints/glows/1px borders only. Filled chips that carry white text must use a dark-enough surface, not a light pastel.
- **Tokens only**, no raw hex. `prefers-reduced-motion: reduce` shows the full pipeline with no sequence.

If a future surface is *not* marketing (any authenticated task screen), it does **not** get the showcase layer — it stays on the core system.
