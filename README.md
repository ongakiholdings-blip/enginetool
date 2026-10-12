# Digits Trading App

A self-hosted digit trading app built on the Deriv WebSocket API. Supports Matches/Differs and Over/Under contract types with real-time tick streaming, digit frequency statistics, and a right-side panel for open positions and recent transactions.

## Prerequisites

- Node.js 18.18 or later

## Step 1: Register Your App ID

1. Log in to your Deriv account and go to the [API Token page](https://app.deriv.com/account/api-token) to create a token with the required scopes.
2. Navigate to [App Registration](https://developers.deriv.com/dashboard/) and register a new application.
3. Set the **Redirect URI** to the URL where you will host this app (e.g. `http://localhost:3000` for local development).
4. Copy the **App ID** shown after registration — you will need it in the next step.

## Step 2: Configure `.env.production`

Copy `.env.example` to `.env.production` and fill in your values:

```bash
cp .env.example .env.production
```

Edit `.env.production`:

```env
NEXT_PUBLIC_DERIV_APP_ID=your_app_id_here
NEXT_PUBLIC_DERIV_REDIRECT_URI=https://your-registered-redirect-uri.com
NEXT_PUBLIC_DERIV_APP_NAME=your_app_name_here
NEXT_PUBLIC_DERIV_SHOW_APP_NAME=true
NEXT_PUBLIC_DERIV_REFERRAL_LINK=your_referral_link_here
NEXT_PUBLIC_DERIV_OAUTH_SCOPES=trade,account_manage
NEXT_PUBLIC_DERIV_ENV=production
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_DERIV_APP_ID` | Your Deriv app ID from the App Registration dashboard |
| `NEXT_PUBLIC_DERIV_REDIRECT_URI` | OAuth redirect URI — must exactly match the URI registered in your Deriv app |
| `NEXT_PUBLIC_DERIV_APP_NAME` | In-app display name (header, tab title, favicon). Set in App Builder Customise. OAuth/consent registration name is configured separately and is not this env var. |
| `NEXT_PUBLIC_DERIV_SHOW_APP_NAME` | `true` (default) shows the name next to the logo on desktop; `false` hides it (logo only). Tab title / favicon still use `NEXT_PUBLIC_DERIV_APP_NAME`. |
| `NEXT_PUBLIC_DERIV_REFERRAL_LINK` | Affiliate referral link shown to unauthenticated users (optional) |
| `NEXT_PUBLIC_DERIV_OAUTH_SCOPES` | Comma-separated OAuth scopes (e.g. `trade,account_manage`) |
| `NEXT_PUBLIC_DERIV_ENV` | `production` to connect to the live Deriv endpoint; `preview` for staging |

For local development, copy `.env.production` to `.env.local` — Next.js will load `.env.local` automatically and it takes precedence over `.env.production`.

## Step 3: Local Development

```bash
npm install
npm run dev
```

The app is available at `http://localhost:3000`.

You can authenticate with Deriv OAuth or choose **API token** in the header. API-token login requires a token with the `trade` permission. The token is sent directly to Deriv's REST API as a bearer token to retrieve accounts and an authenticated WebSocket URL; it is kept in session storage only for the current browser session.

## Automated Trading Engine

Choose **Over 1**, **Under 8**, or **Differs** and set the stake, contract duration, and trade interval. **Start engine** places the first trade immediately, then submits another trade after each selected interval (1, 5, or 10 minutes). Over 1 and Under 8 use fixed digit barriers; Differs uses the selected digit. The elapsed engine time is displayed while it runs. An optional positive whole-number time limit can be set in minutes, hours, or days; leave it blank for unlimited runtime. The engine stops automatically when the limit is reached, and rejects zero, fractional, or excessively large limits. The engine requires an authenticated trading account and stops when you log out or switch accounts. **Stop engine** prevents future trades; it does not cancel a purchase request already in progress.

The main screen shows the active and closed positions from the current engine session in a transaction history below the trading controls. Older account history is not included. **Reset history** clears the displayed session history without closing active contracts; new trades are shown after reset.

## Step 4: Build for Production

```bash
npm run build
```

This produces a fully static export in the `/out` directory. Serve the contents of `/out` from any web server or static file host.
