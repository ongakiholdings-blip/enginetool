'use client';

import { Localize } from '@deriv-com/translations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import type { TradeIntervalMinutes } from '@/hooks/use-trade-engine';

interface TradeEngineSettingsProps {
  isRunning: boolean;
  isBuying: boolean;
  intervalMinutes: TradeIntervalMinutes;
  setIntervalMinutes: (minutes: TradeIntervalMinutes) => void;
  secondsUntilNextTrade: number | null;
  canTrade: boolean;
  engineError: string | null;
}

const INTERVALS: { minutes: TradeIntervalMinutes; label: string }[] = [
  { minutes: 1, label: '1 minute' },
  { minutes: 5, label: '5 minutes' },
  { minutes: 10, label: '10 minutes' },
];

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function TradeEngineSettings({
  isRunning,
  isBuying,
  intervalMinutes,
  setIntervalMinutes,
  secondsUntilNextTrade,
  canTrade,
  engineError,
}: TradeEngineSettingsProps) {
  const { localize } = useAppTranslations();
  const status = engineError
    ? `${localize('Engine stopped after an error')}: ${engineError}`
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
    <div className="space-y-2 rounded-xl border border-border/80 bg-muted/30 p-3">
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
