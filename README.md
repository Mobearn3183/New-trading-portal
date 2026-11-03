# Trading Arena
Participant-driven virtual trading competition portal, connected to the existing Supabase Arena API.

## Run and deploy
- Node 22 or later. No external npm dependencies.
- Run `npm test`, `npm run check`, `npm run build`.
- Serve `dist/` with any static server.
- Netlify reads `netlify.toml`: command `npm run build`, publish `dist`.
- Frontend contains only the public Supabase publishable key. Never add a service-role key.

## Features
Email signup/signin/logout with token refresh; competition lobby and joining; participant-driven market and limit orders; cancellation; reduce-only closing orders; portfolio, execution history, order book, leaderboard; candlestick and line chart, volume, SMA 20, RSI 14, visible-range volume profile, horizontal/trend drawing tools; profile editing; role-gated competition and symbol administration.

## Backend contract
Uses `public.arena_api(action, payload)` on the existing `trading-competition-app` Supabase project.
Actions: snapshot, join, order, cancel, profile, create_competition, save_symbol, cancel_competition.
Authorization, balances, risk controls and matching are enforced by the existing server functions.
No schema is reset or replaced by this frontend.

## Operational details and verification limits
- Virtual symbols ALPHA, NOVA and ORBIT are participant-driven, not external exchange feeds.
- No synthetic chart data. Candles use executed trades, with up to the latest 1,000 executions returned by the API.
- Competition members receive authenticated private WebSocket invalidations after orders, executions, positions, markets and membership changes. Data is fetched through the authorized snapshot API. A 2-second backup poll covers reconnects; a 15-second reconciliation covers missed events while connected. Form focus never pauses updates, and background updates preserve the form and drawing controls.
- Market orders require opposing liquidity; the server cancels any unfilled remainder.
- Order requests carry an idempotency UUID; a failed network request retains the same UUID for an identical retry in the same browser tab.
- Daily trading windows use UTC; competition start/end inputs use the admin's local timezone and are converted to UTC.
- Drawings are kept in memory for the currently selected market; they are not synchronized.
- Chart indicators, refresh queue concurrency, authenticated WebSocket protocol and channel cleanup have automated tests. Build checks are automated. Actual signup, confirmation email delivery, authenticated trading, and mobile interactions require end-to-end validation.
- Admin roles must already be assigned by a trusted server-side administrator. The UI cannot promote itself.

