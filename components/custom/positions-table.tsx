'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Localize } from '@deriv-com/translations';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getSymbolDisplayName } from '@/lib/active-symbols-display-names';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import { OpenPositionCard } from './open-position-card';
import { ClosedPositionCard } from './closed-position-card';
import type { OpenPosition } from '@/hooks/use-open-positions';
import type { ClosedPosition } from '@/hooks/use-closed-positions';

export type PositionFilter = 'open' | 'closed' | 'all';

interface PositionsTableProps {
  openPositions: OpenPosition[];
  closedPositions: ClosedPosition[];
  onSell: (contractId: number, bidPrice: string) => Promise<void>;
  sellingId: number | null;
  sellError: string | null;
  onClearSellError: () => void;
  /** Map from contract_type string to display label. Falls back to raw type. */
  contractTypeLabels?: Record<string, string>;
  /** Merged onto the root wrapper (spacing, max-height, overflow). */
  className?: string;
  /** Optional title for embedded transaction history tables. */
  title?: string;
  /** Initial filter for embedded transaction history tables. */
  initialFilter?: PositionFilter;
  /** Hide the position filter and show every position. */
  showFilter?: boolean;
  /** Clears the locally displayed session history. */
  onResetClosedHistory?: () => void;
  /** Overrides the reset button's empty-history state. */
  resetDisabled?: boolean;
}

function getValueColHeader(
  filter: PositionFilter,
  localize: (text: string, values?: Record<string, unknown>) => string
): string {
  switch (filter) {
    case 'open':
      return localize('Current Value');
    case 'closed':
      return localize('Sell Price');
    case 'all':
      return localize('Value');
  }
}

function formatContractType(
  contractType: string,
  labels: Record<string, string>,
  barrier?: string
): string {
  const label = labels[contractType] ?? contractType;
  return barrier !== undefined ? `${label} (${barrier})` : label;
}

function formatAmount(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}

function getProfitPercentage(profit: number, buyPrice: number): number | null {
  if (!Number.isFinite(profit) || !Number.isFinite(buyPrice) || buyPrice === 0) {
    return null;
  }
  return (profit / buyPrice) * 100;
}

export function PositionsTable({
  openPositions,
  closedPositions,
  onSell,
  sellingId,
  sellError,
  onClearSellError,
  contractTypeLabels = {},
  className,
  title = 'Report',
  initialFilter = 'open',
  showFilter = true,
  onResetClosedHistory,
  resetDisabled,
}: PositionsTableProps) {
  const { localize } = useAppTranslations();
  const [filter, setFilter] = useState<PositionFilter>(initialFilter);

  useEffect(() => {
    if (sellError) {
      toast.error(localize('Sell Failed'), { description: sellError });
      onClearSellError();
    }
  }, [sellError, onClearSellError, localize]);

  const totalCount = openPositions.length + closedPositions.length;

  const visibleOpen =
    !showFilter || filter === 'open' || filter === 'all' ? openPositions : [];
  const visibleClosed =
    !showFilter || filter === 'closed' || filter === 'all' ? closedPositions : [];

  return (
    <div className={cn('mt-6', className)}>
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-3 gap-2">
        {onResetClosedHistory ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={resetDisabled ?? totalCount === 0}
            onClick={onResetClosedHistory}
          >
            <Localize i18n_default_text="Reset history" />
          </Button>
        ) : (
          <div />
        )}
        <h2 className="text-sm font-semibold text-center">
          <Localize i18n_default_text={title} />
        </h2>
        {showFilter ? (
          <Select value={filter} onValueChange={(value) => setFilter(value as PositionFilter)}>
            <SelectTrigger className="w-28 ml-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">
                {localize('Open ({{count}})', { count: openPositions.length })}
              </SelectItem>
              <SelectItem value="closed">
                {localize('Closed ({{count}})', { count: closedPositions.length })}
              </SelectItem>
              <SelectItem value="all">
                {localize('All ({{count}})', { count: totalCount })}
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div />
        )}
      </div>
      {onResetClosedHistory && (
        <p className="mb-3 text-xs text-muted-foreground">
          <Localize i18n_default_text="Reset history clears this session's displayed transactions; active contracts continue trading." />
        </p>
      )}

      {/* Desktop: table */}
      <div className="hidden lg:block rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Localize i18n_default_text="Type" />
              </TableHead>
              <TableHead>
                <Localize i18n_default_text="Symbol" />
              </TableHead>
              <TableHead className="text-right">
                <Localize i18n_default_text="Stake" />
              </TableHead>
              <TableHead className="text-right">
                {getValueColHeader(showFilter ? filter : 'all', localize)}
              </TableHead>
              <TableHead className="text-right">
                <Localize i18n_default_text="P&L" />
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleOpen.map((pos) => (
              <OpenPositionRow
                key={`open-${pos.contract_id}`}
                pos={pos}
                isSelling={sellingId === pos.contract_id}
                onSell={onSell}
                contractTypeLabels={contractTypeLabels}
              />
            ))}
            {visibleClosed.map((pos) => (
              <ClosedPositionRow
                key={`closed-${pos.contract_id}`}
                pos={pos}
                contractTypeLabels={contractTypeLabels}
              />
            ))}
            {visibleOpen.length === 0 && visibleClosed.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  <Localize i18n_default_text="No positions" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <div className="lg:hidden flex flex-col gap-3">
        {visibleOpen.map((pos) => (
          <OpenPositionCard
            key={`open-card-${pos.contract_id}`}
            pos={pos}
            isSelling={sellingId === pos.contract_id}
            onSell={onSell}
            contractTypeLabels={contractTypeLabels}
          />
        ))}
        {visibleClosed.map((pos) => (
          <ClosedPositionCard
            key={`closed-card-${pos.contract_id}`}
            pos={pos}
            contractTypeLabels={contractTypeLabels}
          />
        ))}
        {visibleOpen.length === 0 && visibleClosed.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            <Localize i18n_default_text="No positions" />
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Desktop table rows ────────────────────────────────────────────────────

function OpenPositionRow({
  pos,
  isSelling,
  onSell,
  contractTypeLabels,
}: {
  pos: OpenPosition;
  isSelling: boolean;
  onSell: (contractId: number, bidPrice: string) => Promise<void>;
  contractTypeLabels: Record<string, string>;
}) {
  const { localize } = useAppTranslations();
  const profit = parseFloat(pos.profit);
  const buyPrice = parseFloat(pos.buy_price);
  const providedProfitPct = Number(pos.profit_percentage);
  const profitPct = Number.isFinite(providedProfitPct)
    ? providedProfitPct
    : getProfitPercentage(profit, buyPrice);
  const isProfit = profit >= 0;
  const isClosed = !!pos.is_sold || !!pos.is_expired || pos.status !== 'open';

  return (
    <TableRow>
      <TableCell className="font-medium">
        {formatContractType(pos.contract_type, contractTypeLabels, pos.barrier)}
        {isClosed && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            <Localize i18n_default_text="Closed" />
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{getSymbolDisplayName(pos.underlying_symbol)}</TableCell>
      <TableCell className="text-right">
        {formatAmount(buyPrice)} {pos.currency}
      </TableCell>
      <TableCell className="text-right">
        {formatAmount(parseFloat(pos.bid_price))} {pos.currency}
      </TableCell>
      <ProfitCell profit={profit} profitPct={profitPct} currency={pos.currency} isProfit={isProfit} />
      <TableCell className="text-right">
        {isClosed ? (
          <span className="text-xs text-muted-foreground">
            <Localize i18n_default_text="Closed" />
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={isSelling || pos.is_valid_to_sell !== 1}
            onClick={() => onSell(pos.contract_id, pos.bid_price)}
          >
            {isSelling ? localize('Selling...') : localize('Sell')}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function ClosedPositionRow({
  pos,
  contractTypeLabels,
}: {
  pos: ClosedPosition;
  contractTypeLabels: Record<string, string>;
}) {
  const buyPrice = Number(pos.buy_price);
  const profit = Number(pos.sell_price) - buyPrice;
  const profitPct = getProfitPercentage(profit, buyPrice);
  const isProfit = profit >= 0;

  return (
    <TableRow>
      <TableCell className="font-medium">
        {formatContractType(pos.contract_type, contractTypeLabels)}
      </TableCell>
      <TableCell className="text-muted-foreground">{getSymbolDisplayName(pos.underlying_symbol)}</TableCell>
      <TableCell className="text-right">
        {formatAmount(buyPrice)}
      </TableCell>
      <TableCell className="text-right">
        {formatAmount(Number(pos.sell_price))}
      </TableCell>
      <ProfitCell profit={profit} profitPct={profitPct} currency="" isProfit={isProfit} />
      <TableCell />
    </TableRow>
  );
}

function ProfitCell({
  profit,
  profitPct,
  currency,
  isProfit,
}: {
  profit: number;
  profitPct: number | null;
  currency: string;
  isProfit: boolean;
}) {
  return (
    <TableCell
      className={cn(
        'text-right font-semibold',
        isProfit ? 'text-green-600' : 'text-destructive'
      )}
    >
      {isProfit ? '+' : ''}{formatAmount(profit)}{currency ? ` ${currency}` : ''}
      {profitPct !== null && (
        <span className="text-xs font-normal ml-1 opacity-70">
          ({isProfit ? '+' : ''}{profitPct.toFixed(1)}%)
        </span>
      )}
    </TableCell>
  );
}
