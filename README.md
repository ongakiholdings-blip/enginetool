# Digits Trading App

A self-hosted digit trading app built on the Deriv WebSocket API. Supports Matches/Differs and Over/Under contract types with real-time tick streaming, digit frequency statistics, and a right-side panel for open positions and recent transactions.

## Prerequisites

- Node.js 18.18 or later

## Step 1: Register Your App ID

1. Log in to your Deriv account and go to the [API Token page](https://app.deriv.com/account/api-token) to create a token with the required scopes.
2. Navigate to [App Registration](https://developers.deriv.com/dashboard/) and register a new application.
3. Set the **Redirect URI** to `https://www.frostydbot.site` for production. Register `http://localhost:3000` separately if you also want to test OAuth locally.
4. Copy the **App ID** shown after registration — you will need it in the next step.

## Step 2: Configure environment variables

For local production builds, copy `.env.example` to `.env.production` and fill in your values:

```bash
cp .env.example .env.production
```

Edit `.env.production`:

```env
NEXT_PUBLIC_DERIV_APP_ID=34EC8wFqtCnCN09NJpMXv
NEXT_PUBLIC_DERIV_REDIRECT_URI=https://www.frostydbot.site
NEXT_PUBLIC_DERIV_APP_NAME=FROSTY-DBOT
NEXT_PUBLIC_DERIV_SHOW_APP_NAME=true
NEXT_PUBLIC_DERIV_REFERRAL_LINK=https://t.deriv.link?t=439FPLA37FCH
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

For the Vercel **Production** environment, use the values shown above. Add the exact `https://www.frostydbot.site` redirect URI to the Deriv application's allowed redirect URIs.

For local development, copy `.env.example` to `.env.local` and fill in your values. Next.js loads `.env.local` automatically.

### Deploy to Vercel

1. Import this repository into Vercel. The included `vercel.json` identifies it as a Next.js project; keep the detected Next.js framework settings and do not set an output directory such as `out`.
2. In the Vercel project, open **Settings → Environment Variables** and add the variables from `.env.example`. Set them for the environments where you intend to deploy. These are `NEXT_PUBLIC_` variables and are included in the browser bundle; never put Deriv API tokens or other secrets in them.
3. Set `NEXT_PUBLIC_DERIV_REDIRECT_URI` to `https://www.frostydbot.site` and register that exact URL in the Deriv App settings. Configure both `frostydbot.site` and `www.frostydbot.site` as Vercel custom domains and enable HTTPS. The app redirects the apex domain to `www` so OAuth state stays on the same browser origin.
4. Redeploy after changing environment variables; Next.js reads these public values during the build.

Use `NEXT_PUBLIC_DERIV_ENV=production` for live Deriv services. Use `preview` only when intentionally connecting a deployment to Deriv's staging services.

## Step 3: Local Development

```bash
npm install
npm run dev
```

The app is available at `http://localhost:3000`.

You can authenticate with Deriv OAuth or choose **API token** in the header. API-token login requires a Deriv **Personal Access Token (PAT)** with the `trade` permission. Legacy API tokens are not supported by this REST-based login flow. The PAT is sent directly to Deriv's REST API as a bearer token to retrieve accounts and an authenticated WebSocket URL; it is kept in session storage only for the current browser session.

## Automated Trading Engine

Choose **Over 1**, **Under 8**, or **Differs** and set the stake, Martingale multiplier, contract duration, and trade interval. The engine waits at least the selected interval before the next trade (30 seconds, 1, 5, or 10 minutes). It evaluates each setup against the proposal's break-even rate using a 95% Wilson lower confidence bound on a held-out, newer half of at least 800 recent ticks, and skips the interval unless that bound is more than 2 percentage points above break-even. For **Differs**, the barrier is chosen from the less frequent digits in the older half; Over 1 and Under 8 use their fixed barriers. This conservative filter can skip many or all trades and does not predict or guarantee future results. Distinct synthesized tones signal when an interval starts and when its timer ends; starting the engine also plays the interval-start tone. Martingale defaults to 2×: after each losing trade, the next stake is the previous stake multiplied by the selected value; after a win, it returns to the base stake. Leave the multiplier blank to disable Martingale. When Martingale is enabled, the engine also waits for a trade to settle before placing the next trade so it can apply the correct stake. Manual **Differs** proposals use the selected digit; the automated filter does not change manual trades. The elapsed engine time is displayed while it runs. An optional positive whole-number time limit can be set in minutes, hours, or days; leave it blank for unlimited runtime. The engine stops automatically when the limit is reached, and rejects zero, fractional, or excessively large limits. The engine requires an authenticated trading account and stops when you log out or switch accounts. **Stop engine** prevents future trades; it does not cancel a purchase request already in progress.

Use **Markets to trade** to keep the engine on the selected symbol or cycle through open, non-suspended **1-second indices**, **plain volatility indices**, or **Jump indices**. The holdout check is recalculated for the current market each interval. After a trade in a group, the engine switches to the next matching market; a skipped interval stays on the same market. The loop ends at the configured time limit. Stake and contract settings apply across the selected group.

The main screen shows the active and closed positions from the current engine session in a transaction history below the trading controls. Older account history is not included. **Reset history** clears the displayed session history without closing active contracts; new trades are shown after reset.

## Step 4: Verify a Production Build

```bash
npm run build
```

Vercel runs this build automatically when deploying. This project uses the standard Next.js build output; it is not configured as a static export.
