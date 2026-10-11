'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Localize } from '@deriv-com/translations';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OpenPositionCard } from '@/components/custom/open-position-card';
import { ClosedPositionCard } from '@/components/custom/closed-position-card';
import { Button } from '@/components/ui/button';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import type { OpenPosition } from '@/hooks/use-open-positions';
import type { ClosedPosition } from '@/hooks/use-closed-positions';

interface TransactionsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openPositions: OpenPosition[];
  closedPositions: ClosedPosition[];
  onRefreshTransactions: () => Promise<void>;
  onSell: (contractId: number, bidPrice: string) => Promise<void>;
  sellingId: number | null;
  sellError: string | null;
  onClearSellError: () => void;
  contractTypeLabels: Record<string, string>;
}

type PositionTab = 'open' | 'closed';

export function TransactionsPanel({
  open,
  onOpenChange,
  openPositions,
  closedPositions,
  onRefreshTransactions,
  onSell,
  sellingId,
  sellError,
  onClearSellError,
  contractTypeLabels,
}: TransactionsPanelProps) {
  const { localize } = useAppTranslations();
  const [tab, setTab] = useState<PositionTab>('open');

  useEffect(() => {
    if (!sellError) return;
    toast.error(localize('Sell Failed'), { description: sellError });
    onClearSellError();
  }, [sellError, onClearSellError, localize]);

  useEffect(() => {
    if (!open) setTab('open');
  }, [open]);

  useEffect(() => {
    if (open) void onRefreshTransactions();
  }, [open, onRefreshTransactions]);

  const positions = tab === 'open' ? openPositions : closedPositions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!left-auto !right-0 !top-0 !h-dvh !w-[min(92vw,420px)] !max-w-none !translate-x-0 !translate-y-0 !gap-0 !rounded-none !p-0">
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-5 py-4 pr-12">
          <DialogTitle>
            <Localize i18n_default_text="Report" />
          </DialogTitle>
          <Link
            href="/reports"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Localize i18n_default_text="View your positions →" />
          </Link>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 border-b border-border p-3">
          <Button
            type="button"
            variant={tab === 'open' ? 'default' : 'outline'}
            aria-pressed={tab === 'open'}
            onClick={() => setTab('open')}
          >
            {localize('Open ({{count}})', { count: openPositions.length })}
          </Button>
          <Button
            type="button"
            variant={tab === 'closed' ? 'default' : 'outline'}
            aria-pressed={tab === 'closed'}
            onClick={() => setTab('closed')}
          >
            {localize('Closed ({{count}})', { count: closedPositions.length })}
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {positions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              <Localize i18n_default_text="No positions" />
            </p>
          ) : tab === 'open' ? (
            (positions as OpenPosition[]).map((position) => (
              <OpenPositionCard
                key={position.contract_id}
                pos={position}
                isSelling={sellingId === position.contract_id}
                onSell={onSell}
                contractTypeLabels={contractTypeLabels}
              />
            ))
          ) : (
            (positions as ClosedPosition[]).map((position) => (
              <ClosedPositionCard
                key={position.contract_id}
                pos={position}
                contractTypeLabels={contractTypeLabels}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
