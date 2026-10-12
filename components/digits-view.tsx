'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban } from 'lucide-react';
import { toast } from 'sonner';
import { Localize } from '@deriv-com/translations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Footer, FooterBar } from '@/components/custom/footer';
import { Header } from '@/components/custom/header';
import { LoginPromptDialog } from '@/components/custom/login-prompt-dialog';
import { PinnedBuyBar } from '@/components/custom/pinned-buy-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import { CurrentTickDisplay } from './current-tick-display';
import { DigitStatsBar } from './digit-stats-bar';
import { TradeControls } from './trade-controls';
import { ConfigurableDigitsControls, ConfigurableBuyButton } from './configurable-digits-controls';
import { SymbolSelector } from '@/components/custom/symbol-selector';
import { TransactionsPanel } from '@/components/custom/transactions-panel';
import { ThemeToggle } from '@/components/custom/theme-toggle';
import { PositionsTable } from '@/components/custom/positions-table';
import { TradeEngineSettings } from './trade-engine-settings';
import type {
  AuthState,
  DerivAccount,
  ActiveSymbol,
  Tick,
  ProposalInfo,
  DurationLimits,
  BuyResult,
} from '@deriv/core';
import type {
  ContractMode,
  DigitStats,
  OpenPosition,
  ClosedPosition,
} from '../lib/types';
import { ALL_CONTROL_KEYS } from '../lib/app-config';
import type { ControlKey, DigitsAppConfig } from '../lib/app-config';

/**
 * Desktop no-code column split. Digits has no chart, so the market-data blocks
 * (symbol, tick, digit stats) stand in for it on the left, mirroring the
 * chart-left / controls-right desktop layout of rise-fall and accumulators —
 * and the 3-column desktop the standard Digits layout has always had. The
 * blocks keep their configured relative order inside each column; the
 * drag-to-reorder editor is phone-framed, so the single mobile column stays
 * the source of truth and desktop is a grouped projection of it.
 */
const MARKET_COLUMN_KEYS: ControlKey[] = ['symbol', 'tick', 'digitStats'];
const CONTROLS_COLUMN_KEYS: ControlKey[] = ALL_CONTROL_KEYS.filter(
  (key) => !MARKET_COLUMN_KEYS.includes(key)
);

// Edit-mode stand-in for the login prompt's auth handlers — same rule as the
// header: no OAuth navigation out of the editor.
const noopAsyncAuth = async () => {};

export interface DigitsViewProps {
  // Auth
  authState: AuthState;
  accounts: DerivAccount[];
  activeAccount: DerivAccount | null;
  onLogin: () => Promise<void>;
  onApiTokenLogin?: (token: string) => Promise<void>;
  onSignUp: () => Promise<void>;
  onLogout: () => void;
  onSwitchAccount: (accountId: string) => Promise<void>;

  // Connection / loading
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Market data
  symbols: ActiveSymbol[];
  activeSymbol: ActiveSymbol | null;
  selectSymbol: (symbol: string) => void;
  currentTick: Tick | null;
  lastDigit: number | null;
  digitStats: DigitStats;
  pipSize: number;

  // Trade controls
  contractMode: ContractMode;
  setContractMode: (mode: ContractMode) => void;
  selectedDigit: number;
  setSelectedDigit: (digit: number) => void;
  stake: string;
  setStake: (value: string) => void;
  duration: number;
  setDuration: (value: number) => void;
  durationLimits: DurationLimits;
  proposal: ProposalInfo | null;
  isProposalLoading: boolean;
  isBuying: boolean;
  isEngineRunning: boolean;
  intervalMinutes: 1 | 5 | 10;
  setIntervalMinutes: (minutes: 1 | 5 | 10) => void;
  secondsUntilNextTrade: number | null;
  engineError: string | null;
  canEngineTrade: boolean;
  startEngine: () => void;
  stopEngine: () => void;
  buyResult: BuyResult | null;
  buyError: string | null;
  clearBuyResult: () => void;
  openPositions: OpenPosition[];
  closedPositions: ClosedPosition[];
  refreshClosedPositions: () => Promise<void>;
  sellContract: (contractId: number, bidPrice: string) => Promise<void>;
  sellingId: number | null;
  sellError: string | null;
  clearSellError: () => void;
  // Branding (used by preview route; no-op in the real app)
  logoSrc?: string;
  appName?: string;
  showAppName?: boolean;

  /**
   * No-code config. When provided, the controls render in configurable
   * styles/order (ConfigurableDigitsControls). When omitted, the standard
   * DigitsView layout renders unchanged.
   */
  appConfig?: DigitsAppConfig;
  /** Edit mode — components become selectable (click opens their accordion). */
  editMode?: boolean;
  /** Called when an editable component is clicked (e.g. "stake"). */
  onSelect?: (key: string) => void;
  /** Currently selected component (highlighted). */
  selectedKey?: string | null;
  /** Rearrange mode — drag blocks in the phone to reorder the layout. */
  rearrangeMode?: boolean;
  /** Called with the new block order after a drag-drop reorder. */
  onReorder?: (order: DigitsAppConfig['order']) => void;
}

export function DigitsView({
  authState,
  accounts,
  activeAccount,
  onLogin,
  onApiTokenLogin,
  onSignUp,
  onLogout,
  onSwitchAccount,
  isConnected,
  isLoading,
  error,
  symbols,
  activeSymbol,
  selectSymbol,
  currentTick,
  lastDigit,
  digitStats,
  pipSize,
  contractMode,
  setContractMode,
  selectedDigit,
  setSelectedDigit,
  stake,
  setStake,
  duration,
  setDuration,
  durationLimits,
  proposal,
  isProposalLoading,
  isBuying,
  isEngineRunning,
  intervalMinutes,
  setIntervalMinutes,
  secondsUntilNextTrade,
  engineError,
  canEngineTrade,
  startEngine,
  stopEngine,
  buyResult,
  buyError,
  clearBuyResult,
  openPositions,
  closedPositions,
  refreshClosedPositions,
  sellContract,
  sellingId,
  sellError,
  clearSellError,
  logoSrc,
  appName,
  showAppName,
  appConfig,
  editMode,
  onSelect,
  selectedKey,
  rearrangeMode,
  onReorder,
}: DigitsViewProps) {
  const isMobile = useIsMobile();
  // Pinning is a mobile affordance: on desktop the controls card grows to fit,
  // so the Buy button is never scroll-clipped and a viewport-wide bar under a
  // 400px column would look detached.
  const pinBuy = !!appConfig?.buy?.pinned && isMobile;
  // With Buy unpinned the footer still has to sit at the end of the mobile
  // column — and a `fixed` footer makes that column reserve clearance for it.
  // That reservation was a guess (`pb-28`, 112px) for a footer that measures
  // 40px, leaving 72px of dead space under the Buy button at the bottom of the
  // scroll. Rendering it in flow, exactly as PinnedBuyBar does, ends the column
  // where the footer begins and removes the number to guess.
  //
  // Note what this does NOT depend on: `buy.pinned`. Every no-code mobile
  // render gets the in-flow band, so an existing unpinned project also moves
  // off the translucent `fixed` footer on its next redeploy. That is deliberate
  // — it is the dead-space fix — but it means the backward-compatibility rule
  // covers Buy's PLACEMENT, not the footer treatment: a pre-existing project
  // keeps Buy scrolling in the column, while its footer becomes the opaque
  // bordered band. A footer that moved after a redeploy is expected here, not a
  // regression.
  const inFlowFooter = !!appConfig && isMobile;
  const { localize } = useAppTranslations();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [clearedClosedPositionIds, setClearedClosedPositionIds] = useState<Set<number>>(
    () => new Set()
  );
  const handleViewPositions = useCallback(() => setShowTransactions(true), []);
  const accountId = activeAccount?.account_id;
  const visibleClosedPositions = useMemo(
    () =>
      closedPositions.filter(
        (position) => !clearedClosedPositionIds.has(position.contract_id)
      ),
    [closedPositions, clearedClosedPositionIds]
  );
  const resetClosedHistory = useCallback(() => {
    setClearedClosedPositionIds((cleared) => {
      const next = new Set(cleared);
      for (const position of closedPositions) {
        next.add(position.contract_id);
      }
      return next;
    });
  }, [closedPositions]);

  useEffect(() => {
    setClearedClosedPositionIds(new Set());
  }, [accountId]);

  // Starting the engine requires an authenticated account. Once started, each
  // order uses the same proposal and purchase path as a manual trade.
  const handleToggleEngine = useCallback(() => {
    if (editMode) return;
    if (isEngineRunning) {
      stopEngine();
      return;
    }
    // Mid-OAuth (the ?code= callback) the header already shows a login in
    // progress — don't stack a "please log in" prompt on top of it.
    if (authState === 'authenticating') return;
    if (authState !== 'authenticated') {
      setShowLoginPrompt(true);
      return;
    }
    startEngine();
  }, [editMode, isEngineRunning, authState, startEngine, stopEngine]);

  // Purchase feedback for the configurable layouts lives HERE, not in
  // ConfigurableDigitsControls: the desktop no-code layout mounts that
  // component once per column, and a per-instance effect would fire every
  // toast twice. The standard layout's TradeControls owns its own toasts, so
  // these are gated on appConfig to keep a single owner per layout.
  const hasAppConfig = !!appConfig;
  useEffect(() => {
    if (!hasAppConfig || !buyError) return;
    toast.error(localize('Purchase Failed'), { description: buyError });
    clearBuyResult();
  }, [hasAppConfig, buyError, clearBuyResult, localize]);
  useEffect(() => {
    if (!hasAppConfig || !buyResult) return;
    toast.success(localize('Contract Purchased'), {
      description: localize(
        'Buy price: {{buyPrice}} USD | Payout: {{payout}} USD | Balance: {{balance}} USD',
        {
          buyPrice: buyResult.buyPrice.toFixed(2),
          payout: buyResult.payout.toFixed(2),
          balance: buyResult.balanceAfter.toFixed(2),
        }
      ),
    });
    clearBuyResult();
  }, [hasAppConfig, buyResult, clearBuyResult, localize]);

  // In edit mode, login/sign-up/account actions are inert (no OAuth navigation
  // out of the editor) — only the theme toggle stays interactive.
  const headerEl = useMemo(() => {
    const noop = () => {};
    const noopAsync = async () => {};
    return (
      <Header
        authState={authState}
        accounts={accounts}
        activeAccount={activeAccount}
        onLogin={editMode ? noopAsync : onLogin}
        onApiTokenLogin={editMode ? undefined : onApiTokenLogin}
        onSignUp={editMode ? noopAsync : onSignUp}
        onLogout={editMode ? noop : onLogout}
        onSwitchAccount={editMode ? noopAsync : onSwitchAccount}
        logoSrc={logoSrc}
        appName={appName}
        showAppName={showAppName}
        actions={<ThemeToggle />}
      />
    );
  }, [
    authState,
    accounts,
    activeAccount,
    editMode,
    onLogin,
    onApiTokenLogin,
    onSignUp,
    onLogout,
    onSwitchAccount,
    logoSrc,
    appName,
    showAppName,
  ]);

  if (error) {
    return (
      <main className="flex flex-col bg-background items-center justify-center px-4 min-h-dvh">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">
              <Localize i18n_default_text="Connection Error" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // The configurable controls — a reorderable column. `keys` narrows the
  // instance to one desktop column; omitted, it renders every block.
  const renderConfigurable = (keys?: ControlKey[], showPositionsLink?: boolean) =>
    appConfig ? (
      <ConfigurableDigitsControls
        config={appConfig}
        keys={keys}
        showPositionsLink={showPositionsLink}
        symbols={symbols}
        activeSymbol={activeSymbol}
        selectSymbol={selectSymbol}
        currentTick={currentTick}
        lastDigit={lastDigit}
        digitStats={digitStats}
        pipSize={pipSize}
        contractMode={contractMode}
        onContractModeChange={setContractMode}
        selectedDigit={selectedDigit}
        onDigitSelect={setSelectedDigit}
        stake={stake}
        onStakeChange={setStake}
        duration={duration}
        onDurationChange={setDuration}
        durationLimits={durationLimits}
        proposal={proposal}
        isProposalLoading={isProposalLoading}
        onToggleEngine={handleToggleEngine}
        onViewPositions={handleViewPositions}
        isBuying={isBuying}
        isEngineRunning={isEngineRunning}
        intervalMinutes={intervalMinutes}
        setIntervalMinutes={setIntervalMinutes}
        secondsUntilNextTrade={secondsUntilNextTrade}
        engineError={engineError}
        canTrade={canEngineTrade}
        isConnected={isConnected}
        isAuthenticated={authState === 'authenticated'}
        editMode={editMode}
        onSelect={onSelect}
        selectedKey={selectedKey}
        rearrangeMode={rearrangeMode}
        onReorder={onReorder}
        pinBuy={pinBuy}
      />
    ) : null;

  const renderTransactionHistory = () =>
    !editMode ? (
      <section className="w-full max-w-7xl mx-auto px-3 py-4 pb-24 sm:px-4">
        <PositionsTable
          openPositions={openPositions}
          closedPositions={visibleClosedPositions}
          onSell={sellContract}
          sellingId={sellingId}
          sellError={sellError}
          onClearSellError={clearSellError}
          contractTypeLabels={{
            DIGITMATCH: localize('Digit Match'),
            DIGITDIFF: localize('Digit Differs'),
            DIGITOVER: localize('Digit Over'),
            DIGITUNDER: localize('Digit Under'),
          }}
          title="Transaction history"
          initialFilter="all"
          showFilter={false}
          onResetClosedHistory={resetClosedHistory}
          className="mt-0"
        />
      </section>
    ) : null;

  return (
    <main
      className={`flex flex-col max-lg:h-dvh max-lg:overflow-y-auto lg:overflow-visible ${
        editMode ? 'bg-muted/50' : 'bg-transparent'
      }`}
    >
      {editMode ? (
        <div className="group/hdr sticky top-0 z-50">
          {headerEl}
          <div className="pointer-events-none absolute inset-0 z-[60] opacity-0 ring-2 ring-inset ring-muted-foreground/25 transition-opacity group-hover/hdr:opacity-100">
            <span className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border">
              <Ban className="h-3.5 w-3.5" />
              <Localize i18n_default_text="Not editable" />
            </span>
          </div>
        </div>
      ) : (
        headerEl
      )}

      {appConfig ? (
        isMobile ? (
          /* No-code mobile layout: a single, reorderable column of blocks. */
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 py-3">
              {isLoading ? <Skeleton className="h-[420px] w-full rounded-xl" /> : renderConfigurable()}
              {pinBuy && !editMode && (
                <div className="space-y-2">
                  <TradeEngineSettings
                    isRunning={isEngineRunning}
                    isBuying={isBuying}
                    intervalMinutes={intervalMinutes}
                    setIntervalMinutes={setIntervalMinutes}
                    secondsUntilNextTrade={secondsUntilNextTrade}
                    canTrade={canEngineTrade}
                    engineError={engineError}
                  />
                  <p className="text-center text-xs text-muted-foreground">
                    <Localize i18n_default_text="Starts immediately, then repeats at the selected interval." />
                  </p>
                  <p className="text-center text-xs text-muted-foreground">
                    <Localize i18n_default_text="Automatically places trades using your selected stake, symbol, and contract." />
                  </p>
                </div>
              )}
              {renderTransactionHistory()}
            </div>
          </div>
        ) : (
          /* No-code desktop layout: two columns, like rise-fall and
             accumulators — market data (symbol, tick, digit stats) left where
             those templates put the chart, controls card right. See
             MARKET_COLUMN_KEYS for the split. The controls column is 440px
             (not the siblings' 400px) because the trade-type chips row lives
             here and needs ~370px of card content in English — 400px would
             clip it, and longer locales need the headroom.

             The 440px track is guarded behind `lg:` because useIsMobile
             initialises to false — on SSR and the first client render every
             viewport takes this desktop branch, and an unguarded fixed track
             would overflow a phone until hydration flips the flag. The hook's
             (max-width: 1023px) query is the same boundary as `lg`, so the
             CSS and the JS branch agree once hydrated.

             Edit mode shares this layout (as in rise-fall/accumulators), so
             the builder's desktop viewport shows what deploys: selection works
             across both columns, and rearrange drags reorder within a column
             (each column keys the same full config.order, so a within-column
             drop still produces the correct full order; a cross-column drop is
             a no-op because each instance tracks its own drag). Full reordering
             lives in the builder's phone viewport, which renders the single
             mobile column. */
          <div className="flex w-full max-w-5xl mx-auto flex-col px-4 py-4 pb-24">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_440px]">
                <Skeleton className="h-[420px] w-full rounded-xl" />
                <Skeleton className="h-[420px] w-full rounded-xl" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_440px]">
                <Card data-testid="market-column">
                  <CardContent className="pt-4">
                    {renderConfigurable(MARKET_COLUMN_KEYS, false)}
                  </CardContent>
                </Card>
                <Card data-testid="controls-column">
                  <CardContent className="pt-4">
                    {renderConfigurable(CONTROLS_COLUMN_KEYS)}
                  </CardContent>
                </Card>
              </div>
            )}
            {renderTransactionHistory()}
          </div>
        )
      ) : isMobile ? (
        /* Standard mobile layout: market data and engine controls. */
        <div className="flex w-full max-w-7xl mx-auto flex-col px-3 py-2 sm:px-4 sm:py-4 gap-2 sm:gap-3 pb-10">
          {isLoading ? (
            <>
              {/* Main card skeleton */}
              <Skeleton className="w-full h-[420px] rounded-xl" />
            </>
          ) : (
            <>
              <Card className="mb-12 shrink-0 ring-1 ring-primary/10">
                <CardContent className="flex flex-col p-3 pt-3 sm:p-6 sm:pt-4 pb-2 sm:pb-6">
                  {/* Symbol selector + tick display */}
                  <div className="flex flex-col pb-4 pt-1 sm:pb-6 sm:pt-2">
                    <SymbolSelector
                      symbols={symbols}
                      activeSymbol={activeSymbol}
                      onSymbolChange={selectSymbol}
                    />
                    <div className="flex items-center justify-center min-h-24 sm:min-h-32">
                      <CurrentTickDisplay
                        tick={currentTick}
                        lastDigit={lastDigit}
                        activeSymbol={activeSymbol}
                        pipSize={pipSize}
                      />
                    </div>
                  </div>

                  <div className="border-t divide-y divide-border">
                    <div className="py-4 sm:py-6">
                      <DigitStatsBar
                        digitStats={digitStats}
                        selectedDigit={selectedDigit}
                        onDigitSelect={setSelectedDigit}
                      />
                    </div>

                    {/* Trade controls */}
                    <div className="pt-4 sm:pt-6">
                      <TradeControls
                        contractMode={contractMode}
                        onContractModeChange={setContractMode}
                        selectedDigit={selectedDigit}
                        isConnected={isConnected}
                        stake={stake}
                        onStakeChange={setStake}
                        duration={duration}
                        onDurationChange={setDuration}
                        durationLimits={durationLimits}
                        proposal={proposal}
                        isProposalLoading={isProposalLoading}
                        onToggleEngine={handleToggleEngine}
                        onViewPositions={handleViewPositions}
                        isBuying={isBuying}
                        isEngineRunning={isEngineRunning}
                        intervalMinutes={intervalMinutes}
                        setIntervalMinutes={setIntervalMinutes}
                        secondsUntilNextTrade={secondsUntilNextTrade}
                        engineError={engineError}
                        canTrade={canEngineTrade}
                        buyResult={buyResult}
                        buyError={buyError}
                        onClearBuyResult={clearBuyResult}
                        isAuthenticated={authState === 'authenticated'}
                        isMobile
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          {renderTransactionHistory()}
        </div>
      ) : (
        /* Standard desktop layout: the SAME two-column split as the no-code
           desktop above — market data (symbol, tick, digit stats) left,
           controls (contract type + trade engine) right — so both paths
           look identical. The `lg:` guard plays the same first-paint role as
           in the no-code grid (useIsMobile initialises to false). */
        <div className="flex w-full max-w-5xl mx-auto flex-col px-4 py-4 pb-24">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_440px]">
              <Skeleton className="h-[420px] w-full rounded-xl" />
              <Skeleton className="h-[420px] w-full rounded-xl" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_440px]">
              <Card data-testid="market-column">
                <CardContent className="flex flex-col gap-4 pt-4">
                  <SymbolSelector
                    symbols={symbols}
                    activeSymbol={activeSymbol}
                    onSymbolChange={selectSymbol}
                  />
                  <div className="flex flex-1 items-center justify-center min-h-32">
                    <CurrentTickDisplay
                      tick={currentTick}
                      lastDigit={lastDigit}
                      activeSymbol={activeSymbol}
                      pipSize={pipSize}
                    />
                  </div>
                  <DigitStatsBar
                    digitStats={digitStats}
                    selectedDigit={selectedDigit}
                    onDigitSelect={setSelectedDigit}
                  />
                </CardContent>
              </Card>
              <Card data-testid="controls-column">
                <CardContent className="flex flex-col gap-4 pt-4">
                  <TradeControls
                    contractMode={contractMode}
                    onContractModeChange={setContractMode}
                    selectedDigit={selectedDigit}
                    isConnected={isConnected}
                    stake={stake}
                    onStakeChange={setStake}
                    duration={duration}
                    onDurationChange={setDuration}
                    durationLimits={durationLimits}
                    proposal={proposal}
                    isProposalLoading={isProposalLoading}
                    onToggleEngine={handleToggleEngine}
                    onViewPositions={handleViewPositions}
                    isBuying={isBuying}
                    isEngineRunning={isEngineRunning}
                    intervalMinutes={intervalMinutes}
                    setIntervalMinutes={setIntervalMinutes}
                    secondsUntilNextTrade={secondsUntilNextTrade}
                    engineError={engineError}
                    canTrade={canEngineTrade}
                    buyResult={buyResult}
                    buyError={buyError}
                    onClearBuyResult={clearBuyResult}
                    isAuthenticated={authState === 'authenticated'}
                  />
                </CardContent>
              </Card>
            </div>
          )}
          {renderTransactionHistory()}
        </div>
      )}

      {pinBuy ? (
        <PinnedBuyBar
          editMode={editMode}
          rearrangeMode={rearrangeMode}
          selected={selectedKey === 'buy'}
          onSelect={() => onSelect?.('buy')}
          label={localize('Engine button')}
        >
          <ConfigurableBuyButton
            variant={appConfig!.styles.buy}
            isConnected={isConnected}
            isProposalReady={!!proposal}
            onToggleEngine={handleToggleEngine}
            isBuying={isBuying}
            isEngineRunning={isEngineRunning}
            intervalMinutes={intervalMinutes}
            setIntervalMinutes={setIntervalMinutes}
            secondsUntilNextTrade={secondsUntilNextTrade}
            engineError={engineError}
            canTrade={canEngineTrade}
            showSettings={!!editMode}
          />
        </PinnedBuyBar>
      ) : inFlowFooter ? (
        /* Unpinned mobile: the same band the pinned bar ends in, minus the Buy
           button — in flow at the end of the h-dvh column, so the scroll area
           ends where it begins and nothing reserves clearance for it. Sharing
           the band is what keeps the footer from moving when the pin toggles. */
        <FooterBar />
      ) : (
        /* Fixed footer — desktop and the standard layout, which scroll the
           document rather than an inner column. */
        <div className="fixed bottom-0 left-0 right-0 py-2 text-center bg-background/80 backdrop-blur-sm">
          <Footer />
        </div>
      )}

      <LoginPromptDialog
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        onLogin={editMode ? noopAsyncAuth : onLogin}
        onApiTokenLogin={editMode ? undefined : onApiTokenLogin}
        onSignUp={editMode ? noopAsyncAuth : onSignUp}
      />
      <TransactionsPanel
        open={showTransactions && authState === 'authenticated'}
        onOpenChange={setShowTransactions}
        openPositions={openPositions}
        closedPositions={closedPositions}
        onRefreshTransactions={refreshClosedPositions}
        onSell={sellContract}
        sellingId={sellingId}
        sellError={sellError}
        onClearSellError={clearSellError}
        contractTypeLabels={{
          DIGITMATCH: localize('Digit Match'),
          DIGITDIFF: localize('Digit Differs'),
          DIGITOVER: localize('Digit Over'),
          DIGITUNDER: localize('Digit Under'),
        }}
      />
    </main>
  );
}
