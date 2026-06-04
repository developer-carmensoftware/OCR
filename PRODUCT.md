# Product

## Register

product

## Users

Thai accounting staff at companies using Carmen Cloud ERP. They open this tool during their normal work shift to process a backlog of credit card statements and vendor invoices — documents that used to require manual keying into Carmen GL. They are not power users exploring the product; they are task-focused workers who want to finish the upload, confirm the data looks right, and move on. Occasional Thai-language content (vendor names, GL labels, invoice text) is the norm, not the exception.

## Product Purpose

Carmen AI Automation extracts structured accounting data from scanned documents (credit card statements, AP invoices) using an LLM vision model, lets users review and correct the output, then posts journal entries directly to Carmen Cloud GL. It eliminates a repetitive, error-prone manual data-entry step from the accounting workflow. Success looks like: document uploaded, data reviewed in under two minutes, entry posted to Carmen with no re-keying.

## Brand Personality

Precise, calm, reliable. The tool handles real money and real GL entries — users need confidence that what they see is what gets posted. Personality comes from precision and clarity, not from decoration or delight mechanics. Think of it as a professional instrument: every element earns its place by serving the task.

## Anti-references

- Not a flashy AI SaaS product — no gradient text, no hero metrics, no celebration animations for routine actions
- Not an enterprise legacy app — not thick borders, not beige surfaces, not Sage/Oracle-era chrome
- Not a data-analytics dashboard — this is task-first, not insight-first; no chart-heavy layouts or drill-down complexity
- Not Notion itself — Notion's blank-slate openness would feel ambiguous here; this tool has a defined workflow with clear steps and explicit states

## Design Principles

1. **The workflow is the UI.** Every screen belongs to a step in the document-processing flow. Navigation, surfaces, and feedback exist to move the user through that flow — not to introduce new surfaces or decorative moments.
2. **Precision signals trust.** Financial data must be visually exact: monospaced numbers, aligned columns, explicit success and error states. Ambiguity in a data-review screen costs real money.
3. **Calm density.** Information is dense by necessity (line items, GL codes, amounts). The surface should recede — low-contrast backgrounds, restrained use of color, whitespace used to group rather than decorate.
4. **Language parity.** Thai text (Sarabun) must feel as considered as English (Inter). Font sizes, line heights, and truncation behaviors must account for Thai script in all contexts.
5. **State is always legible.** Users need to know at a glance: what step they are on, what needs their attention, and what is already confirmed. Status indicators, step progress, and error states are first-class citizens of the design.

## Accessibility & Inclusion

WCAG 2.1 AA throughout. All body text ≥ 4.5:1 contrast against its background; large text and interactive elements ≥ 3:1. Reduced-motion support is already implemented (`@media (prefers-reduced-motion: reduce)` in base.css) — maintain this on all new animations. Thai + English bilingual surface; Sarabun loaded for Thai, Inter for Latin. Dark mode is a first-class supported mode (not an afterthought).
