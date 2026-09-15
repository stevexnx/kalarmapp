---
name: SubTracker Pro
description: Gestor Inteligente de Suscripciones & Amigos
colors:
  primary: "#d0bcff"
  on-primary: "#381e72"
  primary-container: "#4f378b"
  on-primary-container: "#eaddff"
  secondary: "#ccc2dc"
  secondary-container: "#4a4458"
  on-secondary-container: "#e8def8"
  tertiary: "#efb8c8"
  tertiary-container: "#492532"
  on-tertiary-container: "#ffd8e4"
  neutral-bg: "#141218"
  surface: "#141218"
  surface-dim: "#110f14"
  surface-bright: "#3b383e"
  surface-container-low: "#1d1b20"
  surface-container: "#211f26"
  surface-container-high: "#2b2930"
  surface-container-highest: "#36343b"
  on-surface: "#e6e0e9"
  on-surface-variant: "#cac4d0"
  outline: "#a5a0ab"
  outline-variant: "#49454f"
  success: "#a8d5b5"
  warning: "#f2c18d"
  error: "#f2b8b5"
typography:
  display:
    fontFamily: "'Google Sans', 'Google Sans Text', 'Roboto Flex', sans-serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Google Sans', 'Google Sans Text', 'Roboto Flex', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Google Sans', 'Google Sans Text', 'Roboto Flex', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Google Sans Text', 'Google Sans', 'Roboto Flex', Roboto, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  label:
    fontFamily: "'Google Sans Text', 'Google Sans', 'Roboto Flex', Roboto, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "28px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  card:
    backgroundColor: "{colors.surface-container}"
    rounded: "{rounded.xl}"
    padding: "20px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  badge:
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

# Design System: SubTracker Pro

## Overview
SubTracker Pro is built around Google Material Design 3 (Material You) dark theme with a soothing purple/lavender tonal core. The visual hierarchy balances functional financial oversight (costs, renewal countdowns, friends' debts) with modern mobile-friendly affordances. It uses M3 tonal layering, expressive rounded corners, and clear typographic hierarchy to make subscription management tactile and scannable.

## Colors
The palette follows the M3 Dark Theme Tonal Palette:
- **Primary (`#d0bcff`)**: Lavender/Purple accent used for interactive highlights, primary actions, and key active states.
- **Surface & Containers**: Layered depth from `#141218` (base background) through `surface-container-low` (`#1d1b20`), `surface-container` (`#211f26`), to `surface-container-highest` (`#36343b`) for elevated cards and modals.
- **Semantic Accents**:
  - **Success (`#a8d5b5`)**: Soft tonal mint green for paid debts, safe budget margins, and active status.
  - **Warning (`#f2c18d`)**: Amber/gold for imminent renewal alerts (within 3 days) and free trials ending soon.
  - **Error (`#f2b8b5`)**: Soft coral/rose for overdue payments or budget overruns.
  - **Tertiary (`#efb8c8`)**: Gentle pink for secondary highlights and badge variations.

## Typography
- **Headings & Displays**: Google Sans / Roboto Flex with negative letter spacing (`-0.02em`) for clean modern punch.
- **Body & Controls**: Google Sans Text with subtle `-0.01em` tracking for readability on dark backgrounds.
- **Monospace / Numerical Data**: Tabular numerals (`font-feature-settings: "tnum" 1, "zero" 1`) applied to all prices, counts, and currency counters to ensure strict vertical alignment in tables and cards.

## Layout
- **Navigation**: Persistent M3 Navigation Rail on desktop/tablet, collapsing to an adaptive bottom bar / floating action bar on compact mobile screens.
- **Dashboard Grid**: Responsive multi-column grid (`grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`) for subscription cards, allowing seamless reflow from mobile to wide displays.
- **Spacing Scale**: 4px base increment (`4px`, `8px`, `16px`, `24px`, `32px`). Cards maintain generous padding (`20px` to `24px`) with `16px` gutters.

## Elevation & Depth
Elevation is expressed through tonal container shifts rather than heavy drop shadows:
- **Level 0**: Base background (`--md-sys-color-background`).
- **Level 1**: Card surfaces (`--md-sys-color-surface-container`) with subtle 1px offset tonal shadow.
- **Level 2**: Hovered cards and menus (`--md-sys-color-surface-container-high`).
- **Level 3**: Dialogs, modal sheets, and floating toasts (`--md-sys-color-surface-container-highest`).

## Shapes
- **Cards & Surfaces**: Smooth `24px` (`--md-shape-xl`) corner radius giving an organic, friendly Material You look.
- **Buttons & Pills**: Fully rounded pill shapes (`9999px`) for primary actions and filter chips.
- **Inputs & Smaller Containers**: `12px` (`--md-shape-md`) or `16px` (`--md-shape-lg`) for text inputs and dropdowns.

## Components
- **Subscription Card**: High-contrast header with service logo/avatar, next billing badge, pricing in tabular font, and quick actions (WhatsApp share, edit, mark paid).
- **Stat Metric Card**: Compact container showcasing monthly total spend, active trial count, and pending split debt with subtle icon indicators.
- **Friends Split Debt Tile**: Contact card showing individual balance, shared subscription avatars, and one-tap WhatsApp reminder button.
- **Primary & Secondary Buttons**: High-contrast pill buttons with ripple/tonal state transitions on hover and active.

## Do's and Don'ts
- **Do**:
  - Always use tabular numerals for prices and monetary amounts.
  - Maintain the tonal surface hierarchy for dark mode contrast; never use flat pure black `#000000` for cards.
  - Keep touch targets at or above 44x44px.
  - Provide distinct visual status indicators (Success, Warning, Error) alongside textual labels.
- **Don't**:
  - Don't use harsh pure-neon colors or un-toned saturated primaries that cause eye strain in dark mode.
  - Don't hardcode font sizes in pixels without proportional line heights.
  - Don't break the rounded container rhythm by mixing sharp rectangular cards with rounded pills.
