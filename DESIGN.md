---
name: SG Homie
description: The Housing Companion — an approachable, practical interface for Singapore housing decisions.
colors:
  action-blue: "#2563eb"
  deep-blue: "#1d4ed8"
  strong-blue: "#1e40af"
  focus-blue: "#3b82f6"
  sky-blue: "#60a5fa"
  soft-blue: "#eff6ff"
  blue-tint: "#dbeafe"
  white: "#ffffff"
  gray-canvas: "#f9fafb"
  gray-wash: "#f3f4f6"
  gray-border: "#e5e7eb"
  gray-field-border: "#d1d5db"
  gray-muted: "#6b7280"
  gray-body: "#4b5563"
  gray-label: "#374151"
  gray-ink: "#111827"
  slate-canvas: "#f8fafc"
  slate-wash: "#f1f5f9"
  slate-border: "#e2e8f0"
  slate-muted: "#64748b"
  slate-body: "#475569"
  slate-label: "#334155"
  slate-ink: "#0f172a"
  slate-deep: "#020617"
  emerald-highlight: "#34d399"
  emerald-soft: "#d1fae5"
  emerald-marker: "#10b981"
  emerald-strong: "#065f46"
  amber-wash: "#fffbeb"
  amber-soft: "#fef3c7"
  amber-marker: "#f59e0b"
  amber-strong: "#92400e"
  rose-soft: "#ffe4e6"
  rose-marker: "#f43f5e"
  rose-strong: "#9f1239"
  indigo-accent: "#6366f1"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.375
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: "2.25rem"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  body-small:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  2xl: "1rem"
  full: "9999px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
  12: "3rem"
  16: "4rem"
  24: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.white}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.deep-blue}"
  button-pill:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.white}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-pill-hover:
    backgroundColor: "{colors.deep-blue}"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "12px 12px 12px 40px"
  navigation:
    backgroundColor: "rgb(255 255 255 / 80%)"
    textColor: "{colors.gray-label}"
    height: "80px"
  category-chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-label}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  category-chip-selected:
    backgroundColor: "{colors.slate-ink}"
    textColor: "{colors.white}"
  listing-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.2xl}"
  chat-launcher:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
    width: "56px"
    height: "56px"
  valuation-range:
    backgroundColor: "{colors.gray-wash}"
    rounded: "{rounded.full}"
    height: "48px"
---

# Design System: SG Homie

## Overview

**Creative North Star: "The Housing Companion"**

SG Homie is clear and approachable: a practical companion for Singapore housing decisions. Familiar system typography, blue actions, white surfaces, and rounded controls make browsing, comparing, and asking for help feel accessible. Evidence and understandable labels carry the experience.

The existing interface is softly layered. Public sections combine Singapore photography, dark image overlays, blue-to-emerald headline accents, spacious cards, and prominent shadows. Task screens use denser forms, pale gray or slate canvases, borders, and quieter shadows. These are related surface variants; the public-page treatment is not a template for every workspace.

**Key Characteristics:**
- Clear and approachable.
- Friendly, practical controls.
- Softly layered surfaces with task-specific density.
- Blue actions with distinct semantic and category colors.
- Visible evidence, provenance, and uncertainty.

This is an implementation snapshot, documented on 2026-10-18, rather than a redesign or certification of accessibility. Token names are documentation aliases for existing utilities, not new application CSS variables. Primitive values above are normative; the source map below identifies their origin. [PRODUCT.md](PRODUCT.md) governs capability claims and durable brand commitments.

### Evidence and source map

All frontend paths below are relative to `SGHomie/FrontEnd/`. Tailwind values were resolved from the installed package and `tailwind.config.js`, whose theme extension adds motion rather than a custom palette or type scale.

| Evidence | Source and mapping |
| --- | --- |
| Palette | `src/index.css` and active JSX utilities. Action/Deep/Strong/Focus/Sky/Soft Blue and Blue Tint map to blue-600/700/800/500/400/50/100. Gray and slate aliases retain their respective Tailwind families: canvas=50, wash=100, border=200, muted=500, body=600, label=700, ink=900; Gray Field Border=300 and Slate Deep=950. |
| Semantic accents | `src/components/ValuationRangeGauge.tsx`: emerald/amber/rose soft=100, marker=500, strong=800. `src/pages/Home.tsx`: Emerald Highlight=400. `src/index.css`: Amber Wash=50 and Indigo Accent=500. |
| Type, radius, spacing | `src/index.css` defines the inherited family; Tailwind defines utility sizes, weights, line heights, radii, and spacing. Numeric spacing keys retain Tailwind names. Display maps to the active Home heading, not unused `Hero.tsx`. |
| Primary button and field | `src/components/AuthModal.tsx`: submit button and icon-prefixed fields. Fields inherit text color; Gray Ink is the documentation's explicit text role. |
| Pill button and navigation | `src/components/Navbar.tsx`: desktop Sign In and fixed navigation. |
| Chip and category colors | `src/pages/PropertyDetails.tsx` and `.amenity-tone--*` in `src/index.css`. |
| Listing card and map | `src/pages/Search.tsx`, `src/components/MarketplaceMap.tsx`, and map marker rules in `src/index.css`. |
| Chat | `src/components/Chatbot.tsx`, `src/components/Chatbot.css`, `src/lib/chatWindow.ts`. |
| Valuation | `src/components/ValuationRangeGauge.tsx`, `src/pages/PropertyDetails.tsx`, and `.valuation-*` rules in `src/index.css`. |

Local browser inspection at desktop (1440 × 1000) and mobile (390 × 844) confirmed the homepage, navigation, authentication dialog, and open chat, including sampled computed styles. Protected search and authenticated valuation results were inspected in source, not through an authenticated session. Repository inspection and a local render do not verify hosted deployments or the provenance of displayed records.

## Colors

The palette combines bright blue interaction cues with neutral white, gray, and slate surfaces. Exact values live in frontmatter; names below describe their use.

### Primary

- **Action Blue:** common primary buttons, navigation identity, chat header, and launcher.
- **Deep Blue / Strong Blue:** hover states, search actions, listing prices, and stronger emphasis; the search action starts at Deep Blue and darkens to blue-800 on hover.
- **Focus Blue:** input rings and selected-card borders. **Sky Blue:** the light end of headline and identity gradients.
- **Soft Blue / Blue Tint:** contextual washes, icon backgrounds, and subtle selected-state rings. These are backgrounds, not interchangeable small-text colors.

### Secondary

- **Emerald Highlight:** the existing public headline gradient endpoint. It is a visual accent, not proof of a favorable property assessment.
- **Indigo Accent:** the valuation action/progress treatment. Keep this localized treatment distinct from ordinary blue actions.

### Tertiary

- **Emerald Soft / Marker / Strong:** the central likely-market band and within-range marker.
- **Amber Wash / Soft / Marker / Strong:** demo and uncertainty notices, the lower-range band, and below-range marker.
- **Rose Soft / Marker / Strong:** the upper-range band and above-range marker.
- Nearby categories have their own strong/soft/foreground triples in `src/index.css`: transport uses blue, school teal, shopping orange, healthcare rose, food amber, park green, and community/neutral slate. These categories do not represent listing quality or verified proximity. Exact triples are preserved in the sidecar's category metadata.

### Neutral

- **White:** cards, dialogs, fields, and foreground on blue actions.
- **Gray Canvas / Wash / Border / Field Border:** the app shell, detail-page sections, dividers, and authentication fields. **Gray Muted / Body / Label / Ink:** captions through headings.
- **Slate Canvas / Wash / Border:** map-search surfaces. **Slate Muted / Body / Label / Ink / Deep:** search metadata, category chips, map pins, dark tooltips, and image overlays. Preserve the distinction from gray rather than globally substituting one family.

**The Meaning Beyond Color Rule.** Pair status and selection colors with text, shape, or explicit state. Keep asking price, research estimates, and demo provenance legible without interpreting a hue.

## Typography

One inherited system sans-serif stack serves display and body text; there is no custom webfont or separate display face. The same family is recorded for every typography role. The character is familiar and practical, with weight and size providing hierarchy.

| Role | Use and variation |
| --- | --- |
| Display | Active Home heading: the frontmatter gives the mobile base. It steps to 3rem at sm, 3.75rem at md, and 4.5rem at lg, retaining a 1.375 line-height. The clipped gradient span has bottom padding for descenders. |
| Headline | Page and section titles; public section headings also use 2.25rem. Search uses the headline base and steps to 2.25rem at sm, with tight tracking. |
| Title | Card and detail-section headings; selected titles use bold rather than semibold. |
| Body / Body Small | Form controls, descriptions, listing facts, and chat. Descriptions sometimes use relaxed line-height. Home supporting text grows from 1.125rem to 1.5rem at md. |
| Label / Caption | Field labels, category chips, metadata, and disclosures. Small chat chrome also has local 10–11px utilities; these are existing exceptions, not a new global text scale. |

Housing amounts retain explicit S$ formatting where implemented. Do not document tabular numerals or a universal reading-width limit as existing features: neither is established globally. Chat Markdown has its own heading hierarchy, wrapping, and horizontally scrollable table/code containers.

## Layout

The common centered container caps at 80rem with responsive horizontal gutters of 1rem, 1.5rem at sm, and 2rem at lg. Search intentionally widens to 1500px. There is a recurring 4px-based spacing vocabulary, with half-steps such as 10px and 6px where the source uses them; it is not a strict universal grid.

- **Public pages:** generous vertical sections, centered headings, photography with a dark overlay, and cards with 1.5–2rem padding. Home summary cards overlap the hero and stack on small screens. Do not copy the overlapping composition into every route.
- **Navigation:** fixed, full-width, 80px high with a translucent white background and blur. Desktop links appear at md; below md, account/sign-in and menu icon controls remain visible, with a dropdown below the bar. Main task pages reserve top space for the fixed navigation.
- **Map search:** filters progress from one column to two at sm and a wider inline layout at xl. Below lg, the map precedes results; at lg, results sit on the left and the map becomes sticky on the right. Desktop results scroll independently. Map heights vary by breakpoint rather than preserving a fixed aspect ratio.
- **Property details:** nearby categories scroll horizontally; the map precedes the facility list on mobile and sits beside it at lg. This is distinct from search's desktop column order.
- **Authentication:** a centered, scrollable dialog caps at 28rem with 2rem internal padding and outer mobile gutters.
- **Chat:** compact preferred dimensions are 420 × 560px, expanded 820 × 700px. Bounds clamp to a 12px viewport margin; small screens narrow the window rather than switching to a separate full-screen route. Stored/moved bounds can change its position. Listing content inside chat uses a 600px container query for two columns.

Tailwind viewport breakpoints are sm=640px, md=768px, lg=1024px, xl=1280px, and 2xl=1536px; these and the separate chat container threshold live in the sidecar.

## Elevation & Depth

Depth is structural and ambient: borders group task content, pale washes distinguish sections, and shadows lift cards and floating surfaces. Public cards are more elevated than search panels. Some existing cards combine a fine border and shadow; preserve this observed treatment rather than imposing a new flat-only rule.

| Shadow vocabulary | Existing use |
| --- | --- |
| sm | Search panels, listing cards, and the authentication submit button. |
| md | Featured listing cards and the resting desktop Sign In pill. |
| lg | Navigation, chat launcher, tooltips, and elevated hover states. |
| xl | Public cards and authentication dialog. |
| 2xl | Floating chat window. |

Exact shadow strings are in `.impeccable/design.json`. Navigation uses medium backdrop blur; the authentication overlay uses a half-black scrim with small blur. Map price labels and clusters use white borders and dedicated compact shadows. Leaflet is isolated into its own stacking context so its controls stay beneath application overlays.

Motion is part of the current implementation, not a claim that every transition is desirable. Global CSS applies a broad 300ms ease-in-out transition; buttons/links normally scale on hover and press, and fields use a shorter transition. Chat suppresses control scaling, restricts descendant transition properties, and disables geometry transitions during direct manipulation. Chat opening/closing and valuation loading/results have their own timings. Chat and valuation explicitly support reduced motion; the global stylesheet does not establish a comprehensive site-wide reduced-motion policy.

## Shapes

Forms use gently rounded corners: ordinary fields and controls commonly use lg, search fields use xl, and major cards/dialogs/chat use 2xl. Older featured-listing controls also use md. Pills are established for sign-in actions, navigation affordances, nearby chips, status badges, and map price labels. A single radius does not replace these existing variants.

Icons primarily use Lucide outlined SVG with consistent strokes, often at 16–24px; the navigation home icon is larger. Circular icon washes reinforce categories. The active navigation identity is a house outline plus a blue-gradient wordmark; the root logo asset is available but is not rendered by this component. Photography is cover-cropped; it must not imply a verified property/location relationship without evidence.

## Components

### Buttons

Friendly and practical. The frontmatter's **primary** variant records the authentication submit control; the **pill** variant records desktop Sign In. Primary hover darkens blue, and visible focus commonly uses a blue ring or outline. Search instead uses a Deep Blue, semibold xl-rounded action. White/blue secondary actions and local gradients exist on public and valuation surfaces; they are not universal defaults. Disabled styles vary by control, including reduced opacity and waiting cursors.

### Inputs / Fields

White, bordered fields with readable labels. Authentication uses icon-prefixed lg corners; search and chat use xl corners. Focus shifts the border/ring toward blue. The global field rule adds a partially transparent focus ring; individual forms override it. Authentication errors, submission feedback, and disabled controls are local implementations. Visible keyboard focus is required for new controls, but this snapshot does not certify every existing control: the authentication close button removes its outline without an explicit replacement.

### Navigation

Translucent, approachable, and persistent. Blue active text and stronger weight distinguish the current desktop route; hover adds a pale blue pill background. Preserve mobile account access, menu labels, expanded state, and keyboard-visible outlines. Navigation labels vary with authentication/role; preview links are illustrative and do not reproduce permission logic.

### Chips

Compact rounded filters. Nearby chips use a white bordered default and dark slate selected state with stronger weight and `aria-pressed`. A small category-colored dot accompanies the label; the selected dot has a white halo. Hover changes the neutral border/background. Category colors describe facility type, not verified real-world data.

### Cards / Containers

Public cards favor generous padding and elevated shadows. Search listing cards use 2xl corners, a slate border, and sm shadow; selection changes the border to blue and adds a pale blue ring. A separate selection button and details link preserve their distinct purposes. Images are cover-cropped with rounded inner corners. Empty results use a dashed border and explicit recovery copy; errors and loading remain textual, not color-only signals.

### Chat Launcher / Window

The circular launcher uses the frontmatter dimensions, a white outlined message icon, and lg shadow. Its hover darkens blue without scaling. The window has a blue header, white scrolling body, bordered composer, rounded shell, and 2xl shadow. Dragging/resizing also has keyboard controls; Escape closes the window. Document these as interface behavior, not evidence of grounded answers or provider availability.

### Valuation Range Gauge

A likely-market band with separate estimate and asking-price markers. The central band is emerald, with amber and rose outside it; the asking marker changes tone with its labeled position. Bounds, band, and markers are focusable and expose descriptions/tooltips. The caption repeats the information in text, and invalid values have a textual fallback. Small-screen captions stack; wider screens use columns. Keep the research-model notice, demo-input caveat where relevant, and calibration-target explanation alongside the real feature; color does not establish a financial recommendation or property-specific probability.

The companion sidecar contains eight framework-free visual previews. Their labels identify illustrative content. They demonstrate appearance and CSS interaction states, not authentication, database access, search, chat requests, selection state management, or model inference. Gauge positions are illustrative geometry without invented monetary outputs; listing previews use labeled empty image slots rather than fabricated properties.

All eight previews were rendered independently in Shadow DOM at the desktop and mobile widths recorded above, without horizontal page overflow. Primary-button hover, field focus, and gauge keyboard-visible focus were sampled. The sidecar remains under the repository's existing `.impeccable/` Git ignore rule; sharing it through Git requires an explicit force-add.

## Do's and Don'ts

### Do:

- **Do** preserve blue action cues, inherited system typography, and the existing gray/slate surface variants.
- **Do** match component density and elevation to the surrounding route.
- **Do** keep labels, keyboard-visible focus, and textual status alongside visual state.
- **Do** distinguish asking prices, historical transactions, research estimates, and demo content in visible copy.
- **Do** preserve chat direct-manipulation exceptions and the implemented reduced-motion treatments.

### Don't:

- **Don't** turn public-page photography, gradients, or oversized shadows into a universal task-screen template.
- **Don't** replace category or valuation labels with color alone.
- **Don't** present illustrative previews, synthetic amenities, testimonials, or generated analytics as verified evidence.
- **Don't** describe intended capabilities or local rendering as proof of hosted deployment or production model approval.
- **Don't** treat documentation aliases as existing application tokens or invent new global styling rules during extraction.
