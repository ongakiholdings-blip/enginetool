'use client';

import { Localize } from '@deriv-com/translations';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import type {
  EngineDurationUnit,
  TradeIntervalMinutes,
} from '@/hooks/use-trade-engine';
import { ENGINE_MARKET_SCOPES } from '@/lib/engine-market-scope';
import type { EngineMarketScope } from '@/lib/engine-market-scope';

interface TradeEngineSettingsProps {
  isRunning: boolean;
  isBuying: boolean;
  intervalMinutes: TradeIntervalMinutes;
  setIntervalMinutes: (minutes: TradeIntervalMinutes) => void;
  activeDuration: string;
  setActiveDuration: (duration: string) => void;
  activeDurationUnit: EngineDurationUnit;
  setActiveDurationUnit: (unit: EngineDurationUnit) => void;
  elapsedSeconds: number;
  secondsUntilNextTrade: number | null;
  canTrade: boolean;
  engineError: string | null;
  marketScope: EngineMarketScope;
  setMarketScope: (scope: EngineMarketScope) => void;
}

const INTERVALS: { minutes: TradeIntervalMinutes; label: string }[] = [
  { minutes: 0.5, label: '30 seconds' },
  { minutes: 1, label: '1 minute' },
  { minutes: 5, label: '5 minutes' },
  { minutes: 10, label: '10 minutes' },
];
const DURATION_UNITS: { unit: EngineDurationUnit; label: string }[] = [
  { unit: 'minutes', label: 'Minutes' },
  { unit: 'hours', label: 'Hours' },
  { unit: 'days', label: 'Days' },
];

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatElapsed(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

export function TradeEngineSettings({
  isRunning,
  isBuying,
  intervalMinutes,
  setIntervalMinutes,
  activeDuration,
  setActiveDuration,
  activeDurationUnit,
  setActiveDurationUnit,
  elapsedSeconds,
  secondsUntilNextTrade,
  canTrade,
  engineError,
  marketScope,
  setMarketScope,
}: TradeEngineSettingsProps) {
  const { localize } = useAppTranslations();
  const status = engineError
    ? `${localize('Engine stopped after an error')}: ${localize(engineError)}`
    : !isRunning
    ? localize('Engine stopped')
    : isBuying
      ? localize('Engine running: placing trade')
      : !canTrade
        ? localize('Engine waiting for connection or proposal')
      : secondsUntilNextTrade === null
        ? localize('Engine running')
        : localize('Next trade in {{time}}', {
            time: formatCountdown(secondsUntilNextTrade),
          });

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-3">
      <div className="space-y-2">
        <label
          htmlFor="engine-market-scope"
          className="text-xs font-medium text-muted-foreground"
        >
          <Localize i18n_default_text="Markets to trade" />
        </label>
        <Select
          value={marketScope}
          onValueChange={(value) => {
            const scope = ENGINE_MARKET_SCOPES.find((option) => option.value === value);
            if (scope) setMarketScope(scope.value);
          }}
          disabled={isRunning}
        >
          <SelectTrigger id="engine-market-scope" className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENGINE_MARKET_SCOPES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <Localize i18n_default_text={option.label} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {marketScope !== 'selected' && (
          <p className="text-xs text-muted-foreground">
            <Localize i18n_default_text="Takes one trade per interval. After each trade, switches to the next open market for the next trade." />
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label
          htmlFor="trade-interval"
          className="text-xs font-medium text-muted-foreground"
        >
          <Localize i18n_default_text="Trade interval" />
        </label>
        <Select
          value={String(intervalMinutes)}
          onValueChange={(value) => {
            const interval = Number(value);
            const option = INTERVALS.find((candidate) => candidate.minutes === interval);
            if (option) setIntervalMinutes(option.minutes);
          }}
          disabled={isRunning}
        >
          <SelectTrigger id="trade-interval" className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVALS.map((option) => (
              <SelectItem key={option.minutes} value={String(option.minutes)}>
                <Localize i18n_default_text={option.label} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          <Localize i18n_default_text="Starts with a trade as soon as the proposal is ready, then trades again at each selected interval. Different tones signal interval start and end." />
        </p>
      </div>
      <div className="space-y-2">
        <label
          htmlFor="engine-active-duration"
          className="text-xs font-medium text-muted-foreground"
        >
          <Localize i18n_default_text="Engine time limit" />
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.8fr)] gap-2">
          <Input
            id="engine-active-duration"
            type="number"
            min={1}
            step={1}
            value={activeDuration}
            onChange={(event) => setActiveDuration(event.target.value)}
            disabled={isRunning}
            placeholder={localize('Unlimited')}
            aria-label={localize('Engine time limit')}
          />
          <Select
            value={activeDurationUnit}
            onValueChange={(value) => {
              const unit = DURATION_UNITS.find((option) => option.unit === value);
              if (unit) setActiveDurationUnit(unit.unit);
            }}
            disabled={isRunning}
          >
            <SelectTrigger aria-label={localize('Duration unit')} className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_UNITS.map((option) => (
                <SelectItem key={option.unit} value={option.unit}>
                  <Localize i18n_default_text={option.label} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <Localize i18n_default_text="Engine active for" />
        </span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatElapsed(elapsedSeconds)}
        </span>
      </p>
      <p
        role={engineError ? 'alert' : 'status'}
        aria-live="polite"
        className="min-h-5 text-xs text-muted-foreground"
      >
        {status}
      </p>
    </div>
  );
}
