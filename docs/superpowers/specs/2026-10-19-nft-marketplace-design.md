# Design: NFT Marketplace Frontend Challenge

Date: 2026-10-19  
Status: Approved direction; awaiting review of this written specification.

## Goal

Build the React and TypeScript NFT marketplace described in `README.md`, using the supplied Figma as the visual reference. Deliver the discovery, purchase, and collector-account flows with deterministic simulated APIs, responsive layouts, realtime updates, E2E coverage, performance reports, and a public deployment. Keep the implementation understandable and explain decisions in Portuguese as work proceeds.

The repository currently contains the challenge README and a pre-existing untracked `.vscode/` directory. Do not overwrite or remove that directory. The Figma design link could not be read automatically during the initial review, so the attached screenshot is the current visual reference; exact measurements and available assets must be checked against Figma when access is available.

## Product scope

The application includes these routes and flows:

- `/`: featured NFTs, searchable/filterable/sortable catalog, pagination, and links to detail.
- `/nft/$nftId`: gallery, edition/quantity, favorites, and add-to-cart.
- `/cart`: editable quantities, removal, coupon, and price summary.
- `/checkout`: authenticated collector details, wallet/network selection, review, and order submission.
- `/orders/$orderId`: only show a receipt after the simulated order is confirmed; preserve the order snapshot.
- `/login` and `/register`: session lifecycle, validation, and return to the interrupted flow.
- `/account/profile` and `/account/wallets`: private profile and wallet management.

Editorial, support, activity, offer, and download pages are excluded. Auxiliary links must not imply successful unsupported operations. Simulated data must remain visibly simulated where it could otherwise be mistaken for real blockchain, wallet, or payment activity.

## Delivery decomposition

The project is split into ordered deliverables that can be checked independently:

1. **Foundation and design system:** inspect available Figma assets and measurements; define theme tokens and shared layout; set up routes, typed contracts, Axios, TanStack Query, and the network mock entry point.
2. **First vertical slice:** home/catalog → NFT detail → cart → login/session recovery → checkout → pending/confirmed/declined order. Build the mock data and REST operations needed for this complete path before adding more screens.
3. **Collector account:** registration, favorites, profile/avatar/password, and primary/secondary wallets, with private-cache isolation and refresh persistence.
4. **Realtime and recovery:** price/availability changes in catalog/detail/cart, stale-quote checkout protection, pending-order recovery, Socket.IO reconnection, version ordering, duplicate rejection, and session isolation.
5. **Quality and delivery:** responsive and accessible behavior, remaining failure scenarios, Playwright flows and visual baselines, Lighthouse reports, setup/architecture documentation, and deployment.

This order keeps the first milestone integrated while preserving the full README scope. Each milestone should end with a runnable app and the relevant scenario documented. The implementation should be paced to the two-day deadline, but required behavior must not be replaced with static screens.

## Architecture

Use Vite as the build tool because the README leaves that choice open and recommends Vercel's Vite flow. Organize the app by route and feature, with a thin application shell and explicit boundaries between transport, mock state, domain calculations, and presentation.

```text
src/
  app/                 router, query client, providers, route guards
  routes/              route definitions and URL search schemas
  features/
    catalog/            search, filters, sorting, pagination
    nft-detail/         gallery, edition, quantity, favorites
    cart/               cart actions, coupon, quote summary
    checkout/           collector, wallet, network, review, submit
    orders/             pending state and immutable receipt
    auth/               login, registration, session recovery
    profile/            collector profile, avatar, password
    wallets/            primary and secondary wallets
  components/           shared layout and themed shadcn/ui components
  lib/
    api/                 Axios instance and typed transport functions
    query/               query keys and cache policy
    realtime/            Socket.IO client and event reconciliation
    domain/              ETH decimal-string calculations and validation
  mocks/
    browser.ts           MSW startup
    handlers/            REST and Socket.IO handlers
    data/                fixtures, scenario state, persistence and reset
  styles/               Tailwind entry and theme tokens
tests/e2e/              Playwright flows and visual baselines
docs/                    API/event contracts and architecture decisions
```

All REST requests go through the Axios client. Route search parameters are the source of truth for catalog search, filters, sorting, and pagination. TanStack Query owns remote state and mutation lifecycles; query keys include user identity for private resources. On logout or account change, cancel private requests, remove private cache entries, and close that session's event subscriptions.

MSW intercepts at the network layer. Its scenario data is shared by REST handlers and realtime handlers; local persistence supports refresh, and a reset returns every resource to a known fixture state. UI components and API client functions must not contain alternate fake-business logic.

Socket.IO events travel through `socket.io-client` and the MSW Socket.IO binding, never direct UI setters or direct Query-cache writes from a test. The binding's documented support is partial; the design only depends on direct client events needed for `nft.updated` and `order.updated`, not rooms or namespaces. Validate the exact compatible MSW/binding versions in the foundation milestone. Start MSW before importing/initializing the Socket.IO client because the interceptor replaces the global WebSocket implementation; use a mock bootstrap ordering or lazy client import if needed.

## State, pricing, and failure behavior

- Catalog query state belongs in the URL, survives refresh/history, resets page when a filter changes, and discards/cancels stale responses.
- Session and cart persist across refresh. Guest cart items merge on login without exceeding edition availability.
- ETH values stay decimal strings at transport boundaries. Domain calculations use exact integer arithmetic at a documented precision; quantities are integers.
- Checkout revalidates quote, coupon, price, availability, and fees. If values change, show the new quote and require another confirmation.
- Order submission carries an idempotency key. Repeating a submission recovers the same order; the same key with different content conflicts. Pending orders recover after refresh or reconnect. Confirmed and declined orders are terminal.
- Receipts render the immutable order snapshot. Confirmed purchases remove only the purchased quantities; errors preserve the cart.
- Loading, empty, error, success, stale-update, pending, and retry states are explicit. Data-dependent surfaces use dimension-preserving shimmer skeletons and respect reduced-motion settings.
- MSW scenarios cover variable latency, out-of-order results, HTTP/network failures, expired sessions, validation conflicts, coupon failures, price/edition changes, timeout/idempotency recovery, and both payment outcomes.

## Visual, responsive, and accessibility direction

The attached Figma screenshot indicates a dark charcoal canvas, warm brown content panels, orange accents, NFT artwork cards, a left-side catalog filter area, and a gallery/details composition. Treat the original Figma as the source of truth for typography, dimensions, spacing, and assets once readable. Keep bundled assets locally accessible; document any substitution or deliberate accessibility adjustment.

Implement desktop, tablet, and mobile layouts at the challenge's 1440, 768, and 390 pixel checkpoints. Filters, navigation, forms, cart, and checkout must remain operable without horizontal overflow. Provide keyboard navigation, visible focus, correct labels and error associations, meaningful image alternatives, accessible mutation/realtime feedback, and focus management for dialogs and drawers. Contrast and state must not rely on color alone.

## Verification and operations

Playwright uses the MSW scenarios and an isolated known state per test. Cover the challenge's twelve listed scenario groups, including browser history, auth/session isolation, full purchase and failures, Socket.IO ordering/reconnection, keyboard access, and slow skeletons/retries. Run main flows in Chromium at desktop and mobile viewports, with versioned visual baselines for home, detail, cart, and payment.

Audit optimized production builds of home and NFT detail on mobile and desktop. Run three Lighthouse measurements per page/profile and report medians, LCP, CLS, TBT, tool versions, and environment. Keep the full application assets and mocked features active during audits.

The final README must document setup, environment variables, fictional credentials, scenarios/reset, commands, and failure reproduction. `ARCHITECTURE.md` must document REST/event contracts, session and cart policies, cache, REST/Socket.IO reconciliation, limitations, UX decisions, and Figma deviations. Provide development-with-mocks, build, preview, type-check, lint, Playwright, and Lighthouse commands. Deploy the same code and mock behavior that is delivered in the repository; direct route loads and refresh must work.

## Technical risks to validate early

1. **Figma assets/access:** exact file access is not yet verified. Confirm permissions and retrieve usable local assets before relying on precise visual reproduction.
2. **Socket.IO mock compatibility:** the `@mswjs/socket.io-binding` documentation describes partial Socket.IO feature parity. Pin mutually compatible versions and prove `socket.io-client` receives the required events in both development and Playwright before building dependent features.
3. **Scope versus deadline:** account, checkout, realtime, tests, Lighthouse, and deploy together are substantial. Maintain the vertical-slice order and keep all required flows real in the simulation; cut polish only after mandatory behaviors are complete.

## Approval boundary

This document records the approved direction and is presented for review before the implementation plan and project setup. No application dependencies have been installed and no application source files have been created yet.
