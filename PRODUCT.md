# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Individual consumers and households managing recurring subscriptions, software licenses, streaming services, free trials, and shared plan costs with friends and family members.

## Product Purpose
Provide a fast, private, and local-first management system for tracking subscription renewal dates, receiving cut-off alerts, and splitting subscription expenses with automated WhatsApp payment reminders.

## Positioning
A lightweight, privacy-respecting subscription hub that automates cost-sharing calculations and reminders without requiring third-party financial aggregators, bank credentials, or external cloud subscriptions.

## Operating Context
- Responsive web app (SPA + PWA) served locally with zero external dependencies via Python 3 (`app.py` / `http://localhost:8000`) or Docker.
- Desktop and mobile browser usage, plus optional Capacitor native mobile wrapping.
- Quick mobile actions, such as one-tap WhatsApp payment reminder generation via `wa.me` URLs.

## Capabilities and Constraints
- Local SQLite database (`backend/db.py`) storing users, subscriptions, payments, and friends contacts.
- Salted PBKDF2 HMAC password hashing with session authentication.
- Real-time cut-off calculations, free trial alerts, monthly budget limits, and multi-currency conversion.
- Cost-splitting management with friend debt status tracking and direct WhatsApp messaging.
- Calendar integration through standard `.ics` exports.
- Zero external runtime dependencies in core Python service.

## Brand Commitments
- Name: SubTracker Pro (Gestor Inteligente de Suscripciones & Amigos)
- Voice: Helpful, organized, transparent, and reassuring.
- Visual Language: Google Material Design 3 (M3 / Material You) dark mode with lavender/purple tonal palette, with flexibility to explore modernizing color accents and component layouts during live exploration.

## Evidence on Hand
- Complete web SPA in `public/index.html`, `public/styles.css`, and `public/app.js`.
- Python server implementation in `app.py` and `backend/server.py`.
- Automated test suite in `test_app.py`.

## Product Principles
1. Privacy and Control: User data stays local and personal with no third-party data tracking.
2. Immediate Clarity: Key metrics—monthly spend, upcoming renewals, trial cut-offs, and who owes what—are scannable in seconds.
3. Frictionless Sharing: Splitting shared costs and reminding friends is effortless and friendly.
4. Lightweight Reliability: Instant loading, clean architecture, and robust offline-capable PWA foundation.

## Accessibility & Inclusion
- High contrast dark mode adhering to WCAG AA guidelines.
- Visible focus rings (`--md-sys-color-primary`), tabular figures for numbers, and minimum 44x44px touch targets.
