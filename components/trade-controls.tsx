'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { Localize } from '@deriv-com/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import { TradeEngineSettings } from './trade-engine-settings';
import type {
  EngineDurationUnit,
  TradeIntervalMinutes,
} from '@/hooks/use-trade-engine';
import type {
  ContractMode,
  DurationLimits,
  ProposalInfo,
  BuyResult,
} from '../lib/types';

interface TradeControlsProps {
  contractMode: ContractMode;
  onContractModeChange: (mode: ContractMode) => void;
  selectedDigit: number;
  isConnected: boolean;
  stake: string;
  onStakeChange: (value: string) => void;
  martingaleMultiplier: string;
  onMartingaleMultiplierChange: (value: string) => void;
  martingaleError: string | null;
  duration: string;
  onDurationChange: (value: string) => void;
  durationLimits: DurationLimits;
  proposal: ProposalInfo | null;
  isProposalLoading: boolean;
  onToggleEngine: () => void;
  isBuying: boolean;
  isEngineRunning: boolean;
  intervalMinutes: TradeIntervalMinutes;
  setIntervalMinutes: (minutes: TradeIntervalMinutes) => void;
  activeDuration: string;
  setActiveDuration: (duration: string) => void;
  activeDurationUnit: EngineDurationUnit;
  setActiveDurationUnit: (unit: EngineDurationUnit) => void;
  elapsedSeconds: number;
  secondsUntilNextTrade: number | null;
  engineError: string | null;
  canTrade: boolean;
  buyResult: BuyResult | null;
  buyError: string | null;
  onClearBuyResult: () => void;
  isAuthenticated?: boolean;
  onViewPositions?: () => void;
  /**
   * Pins the Buy button above the footer (fixed) instead of inline. Driven by
   * the same useIsMobile state that picks the view's layout branch — a CSS
   * breakpoint here could disagree with the mounted branch during the
   * first-paint window, where useIsMobile is still false on every viewport.
   */
  isMobile?: boolean;
}

function getContractModeOptions(
  localize: (text: string) => string
): { value: ContractMode; label: string }[] {
  return [
    { value: 'DIGITOVER', label: localize('Over 1') },
    { value: 'DIGITUNDER', label: localize('Under 8') },
    { value: 'DIGITDIFF', label: localize('Differs') },
  ];
}

function getPredictionText(
  contractMode: ContractMode,
  localize: (text: string) => string
): string {
  switch (contractMode) {
    case 'DIGITDIFF':
      return localize('differ from');
    case 'DIGITOVER':
      return localize('be over 1');
    case 'DIGITUNDER':
      return localize('be under 8');
  }
}

export function TradeControls({
  contractMode,
  onContractModeChange,
  selectedDigit,
  isConnected,
  stake,
  onStakeChange,
  martingaleMultiplier,
  onMartingaleMultiplierChange,
  martingaleError,
  duration,
  onDurationChange,
  durationLimits,
  proposal,
  isProposalLoading,
  onToggleEngine,
  isBuying,
  isEngineRunning,
  intervalMinutes,
  setIntervalMinutes,
  activeDuration,
  setActiveDuration,
  activeDurationUnit,
  setActiveDurationUnit,
  elapsedSeconds,
  secondsUntilNextTrade,
  engineError,
  canTrade,
  buyResult,
  buyError,
  onClearBuyResult,
  isAuthenticated,
  onViewPositions,
  isMobile,
}: TradeControlsProps) {
  const { localize } = useAppTranslations();

  useEffect(() => {
    if (buyError) {
      toast.error(localize('Purchase Failed'), { description: buyError });
      onClearBuyResult();
    }
  }, [buyError, onClearBuyResult, localize]);

  useEffect(() => {
    if (buyResult) {
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
      onClearBuyResult();
    }
  }, [buyResult, onClearBuyResult, localize]);

  const modeOptions = getContractModeOptions(localize);

  return (
    <div className="space-y-2 sm:space-y-4">
      <ToggleGroup
        type="single"
        value={contractMode}
        onValueChange={(value) => {
          const option = modeOptions.find((candidate) => candidate.value === value);
          if (option) onContractModeChange(option.value);
        }}
        className="w-full gap-0 rounded-full bg-muted p-1"
      >
        {modeOptions.map(opt => (
          <ToggleGroupItem
            key={opt.value}
            value={opt.value}
            className="flex-1 rounded-full text-sm font-medium text-muted-foreground transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:font-bold data-[state=on]:shadow-md data-[state=on]:shadow-primary/20 hover:text-foreground"
          >
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="stake" className="text-xs text-muted-foreground">
              <Localize i18n_default_text="Stake" />
            </Label>
            <Input
              id="stake"
              type="number"
              value={stake}
              onChange={e => onStakeChange(e.target.value)}
              onKeyDown={e => {
                if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
              }}
              min={0}
              step="0.01"
              labelRight="USD"
              disabled={isEngineRunning}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="martingale-multiplier" className="text-xs text-muted-foreground">
              <Localize i18n_default_text="Martingale" />
            </Label>
            <Input
              id="martingale-multiplier"
              type="number"
              min={1}
              step="0.1"
              value={martingaleMultiplier}
              onChange={e => onMartingaleMultiplierChange(e.target.value)}
              labelRight="x"
              disabled={isEngineRunning}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              <Localize i18n_default_text="Next stake is multiplied by this value after each loss and resets to your base stake after a win. Leave blank to disable." />
            </p>
            {martingaleError && (
              <p role="alert" className="text-xs text-destructive">
                {localize(martingaleError)}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="duration" className="text-xs text-muted-foreground">
            <Localize i18n_default_text="Duration" />
          </Label>
          <Input
            id="duration"
            type="number"
            value={duration}
            onChange={e => onDurationChange(e.target.value)}
            min={durationLimits.min}
            max={durationLimits.max}
            step={1}
            labelRight={localize('Ticks')}
          />
        </div>
      </div>

      <div className="space-y-1.5 rounded-2xl border border-border/80 bg-accent/40 p-3 shadow-inner sm:space-y-2 sm:p-4">
        <p className="text-[11px] sm:text-xs text-muted-foreground mb-0 sm:mb-1">
          <Localize i18n_default_text="Prediction" />
        </p>
        <p className="text-xs sm:text-sm font-medium">
          <Localize i18n_default_text="Last digit of the price will" />{' '}
          <span className="text-primary font-bold">
            {getPredictionText(contractMode, localize)}
          </span>
          {contractMode === 'DIGITDIFF' && (
            <>
              {' '}
              <span className="inline-flex w-5 h-5 rounded-full bg-primary text-primary-foreground items-center justify-center text-xs font-bold">
                {selectedDigit}
              </span>
            </>
          )}
        </p>
        {(proposal || isProposalLoading) && (
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground">
              <Localize i18n_default_text="Payout" />
            </span>
            {isProposalLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="text-sm font-bold text-foreground">
                {proposal!.payout.toFixed(2)} USD
              </span>
            )}
          </div>
        )}
      </div>

      <TradeEngineSettings
        isRunning={isEngineRunning}
        isBuying={isBuying}
        intervalMinutes={intervalMinutes}
        setIntervalMinutes={setIntervalMinutes}
        activeDuration={activeDuration}
        setActiveDuration={setActiveDuration}
        activeDurationUnit={activeDurationUnit}
        setActiveDurationUnit={setActiveDurationUnit}
        elapsedSeconds={elapsedSeconds}
        secondsUntilNextTrade={secondsUntilNextTrade}
        canTrade={canTrade}
        engineError={engineError}
      />

      <p className="text-center text-xs text-muted-foreground">
        <Localize i18n_default_text="Starts immediately, then repeats at the selected interval." />
      </p>
      <p className="text-center text-xs text-muted-foreground">
        <Localize i18n_default_text="Automatically places trades using your selected stake, symbol, and contract." />
      </p>

      {/* Engine control — fixed above footer on mobile, inline on desktop */}
      <div
        className={
          isMobile
            ? 'fixed bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] left-3 right-3'
            : undefined
        }
      >
        <Button
          className="w-full h-10 rounded-full px-6 sm:h-11 sm:px-8"
          variant={isEngineRunning ? 'destructive' : 'default'}
          disabled={!isConnected || (!isEngineRunning && (!proposal || isBuying))}
          aria-pressed={isEngineRunning}
          onClick={onToggleEngine}
        >
          {isEngineRunning
            ? localize('Stop engine')
            : isBuying
              ? localize('Preparing engine...')
              : localize('Start engine')}
        </Button>
      </div>

      {isAuthenticated && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-sm text-muted-foreground hover:text-foreground"
          onClick={onViewPositions}
        >
          <Localize i18n_default_text="View your positions →" />
        </Button>
      )}
    </div>
  );
}
