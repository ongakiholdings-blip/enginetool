# Digits Trading App

A self-hosted digit trading app built on the Deriv WebSocket API. Supports Matches/Differs and Over/Under contract types with real-time tick streaming, digit frequency statistics, and a right-side panel for open positions and recent transactions.

## Prerequisites

- Node.js 18.18 or later

## Step 1: Register Your App ID

1. Log in to your Deriv account and go to the [API Token page](https://app.deriv.com/account/api-token) to create a token with the required scopes.
2. Navigate to [App Registration](https://developers.deriv.com/dashboard/) and register a new application.
3. Set the **Redirect URI** to the URL where you will host this app (e.g. `http://localhost:3000` for local development).
4. Copy the **App ID** shown after registration — you will need it in the next step.

## Step 2: Configure environment variables

For local production builds, copy `.env.example` to `.env.production` and fill in your values:

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

For local development, copy `.env.example` to `.env.local` and fill in your values. Next.js loads `.env.local` automatically.

### Deploy to Vercel

1. Import this repository into Vercel. The included `vercel.json` identifies it as a Next.js project; keep the detected Next.js framework settings and do not set an output directory such as `out`.
2. In the Vercel project, open **Settings → Environment Variables** and add the variables from `.env.example`. Set them for the environments where you intend to deploy. These are `NEXT_PUBLIC_` variables and are included in the browser bundle; never put Deriv API tokens or other secrets in them.
3. Set `NEXT_PUBLIC_DERIV_REDIRECT_URI` to the exact production URL registered for your Deriv application (for example, `https://your-project.vercel.app`). Register that same URL in the Deriv App settings. If you use a custom domain, use that domain consistently in both places.
4. Redeploy after changing environment variables; Next.js reads these public values during the build.

Use `NEXT_PUBLIC_DERIV_ENV=production` for live Deriv services. Use `preview` only when intentionally connecting a deployment to Deriv's staging services.

## Step 3: Local Development

```bash
npm install
npm run dev
```

The app is available at `http://localhost:3000`.

You can authenticate with Deriv OAuth or choose **API token** in the header. API-token login requires a token with the `trade` permission. The token is sent directly to Deriv's REST API as a bearer token to retrieve accounts and an authenticated WebSocket URL; it is kept in session storage only for the current browser session.

## Automated Trading Engine

Choose **Over 1**, **Under 8**, or **Differs** and set the stake, Martingale multiplier, contract duration, and trade interval. Martingale defaults to 2×: after each losing trade, the next stake is the previous stake multiplied by the selected value; after a win, it returns to the base stake. Leave the multiplier blank to disable Martingale. When Martingale is enabled, the engine waits for a trade to settle before placing the next trade so it can apply the correct stake. **Start engine** places the first trade immediately, then submits another trade after each selected interval (30 seconds, 1, 5, or 10 minutes). Over 1 and Under 8 use fixed digit barriers; Differs uses the selected digit. The elapsed engine time is displayed while it runs. An optional positive whole-number time limit can be set in minutes, hours, or days; leave it blank for unlimited runtime. The engine stops automatically when the limit is reached, and rejects zero, fractional, or excessively large limits. The engine requires an authenticated trading account and stops when you log out or switch accounts. **Stop engine** prevents future trades; it does not cancel a purchase request already in progress.

The main screen shows the active and closed positions from the current engine session in a transaction history below the trading controls. Older account history is not included. **Reset history** clears the displayed session history without closing active contracts; new trades are shown after reset.

## Step 4: Verify a Production Build

```bash
npm run build
```

Vercel runs this build automatically when deploying. This project uses the standard Next.js build output; it is not configured as a static export.
