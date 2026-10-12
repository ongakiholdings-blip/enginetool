'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  useProposal,
  useBuy,
} from '@deriv/core';
import type {
  ActiveSymbol,
  Tick,
  ProposalInfo,
  ProposalParams,
  DurationLimits,
  BuyResult,
} from '@deriv/core';
import { useBaseTrading } from '@/hooks/use-base-trading';
import type { UseBaseTradingParams } from '@/hooks/use-base-trading';
import { computeDigitStats, getLastDigit } from '../lib/digit-stats';
import { useTradeEngine } from './use-trade-engine';
import type { ContractMode, DigitStats, OpenPosition, ClosedPosition } from '../lib/types';

const CONTRACT_TYPES = ['DIGITDIFF', 'DIGITOVER', 'DIGITUNDER'];

interface UseDigitsTradingReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  symbols: ActiveSymbol[];
  activeSymbol: ActiveSymbol | null;
  selectSymbol: (symbol: string) => void;
  currentTick: Tick | null;
  lastDigit: number | null;
  digitStats: DigitStats;
  contractMode: ContractMode;
  setContractMode: (mode: ContractMode) => void;
  selectedDigit: number;
  setSelectedDigit: (digit: number) => void;
  contractsAvailable: boolean;
  pipSize: number;
  stake: string;
  setStake: (value: string) => void;
  duration: string;
  setDuration: (value: string) => void;
  durationLimits: DurationLimits;
  defaultStake: number;
  proposal: ProposalInfo | null;
  isProposalLoading: boolean;
  isBuying: boolean;
  isEngineRunning: boolean;
  intervalMinutes: 1 | 5 | 10;
  setIntervalMinutes: (minutes: 1 | 5 | 10) => void;
  secondsUntilNextTrade: number | null;
  engineError: string | null;
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
}

export type UseDigitsTradingParams = Pick<UseBaseTradingParams, 'ws' | 'isConnected' | 'isExhausted' | 'isAuthenticated' | 'onAuthWSFailed'> & {
  accountId?: string | null;
};

export function useDigitsTrading({ ws, isConnected, isExhausted, isAuthenticated, onAuthWSFailed, accountId }: UseDigitsTradingParams): UseDigitsTradingReturn {
  const {
    ws: tradingWs,
    isConnected: tradingIsConnected,
    isLoading,
    error,
    symbols,
    activeSymbol,
    selectSymbol,
    currentTick,
    prices,
    pipSize,
    contractsAvailable,
    durationLimits,
    defaultStake,
    openPositions,
    closedPositions,
    refreshClosedPositions,
    sellContract,
    sellingId,
    sellError,
    clearSellError,
  } = useBaseTrading({ ws, isConnected, isExhausted, isAuthenticated, onAuthWSFailed, contractTypes: CONTRACT_TYPES });

  // Digits-specific trade state
  const [contractMode, setContractMode] = useState<ContractMode>('DIGITUNDER');
  const [selectedDigit, setSelectedDigit] = useState<number>(5);
  const [stake, setStake] = useState<string>('0.73');
  const [duration, setDuration] = useState<string>('1');

  const digitStats: DigitStats = useMemo(
    () => computeDigitStats(prices, pipSize),
    [prices, pipSize]
  );

  const lastDigit = useMemo(() => {
    if (currentTick) {
      return getLastDigit(currentTick.quote, pipSize);
    }
    if (prices.length > 0) {
      return getLastDigit(prices[prices.length - 1], pipSize);
    }
    return null;
  }, [currentTick, prices, pipSize]);

  const {
    buyContract: buyWithProposal,
    isBuying,
    buyResult,
    buyError,
    clearBuyResult,
  } = useBuy(tradingWs, tradingIsConnected);

  // Null out params while a buy is in-flight — forces useProposal to unsubscribe
  // the consumed proposal ID. When isBuying flips back to false, the memo returns
  // real params and useProposal re-subscribes to get a fresh proposal.
  const proposalParams: ProposalParams | null = useMemo(() => {
    if (isBuying || !activeSymbol) return null;
    const stakeNum = parseFloat(stake);
    if (!stakeNum || stakeNum <= 0) return null;
    const durationNum = Number(duration);
    if (
      !Number.isInteger(durationNum) ||
      durationNum < durationLimits.min ||
      durationNum > durationLimits.max
    ) {
      return null;
    }

    return {
      contractType: contractMode,
      symbol: activeSymbol.underlying_symbol,
      amount: stakeNum,
      duration: durationNum,
      durationUnit: 't',
      basis: 'stake' as const,
      currency: 'USD',
      barrier:
        contractMode === 'DIGITOVER'
          ? 1
          : contractMode === 'DIGITUNDER'
            ? 8
            : selectedDigit,
    };
  }, [activeSymbol, contractMode, stake, duration, durationLimits, selectedDigit, isBuying]);

  const { proposal } = useProposal(tradingWs, tradingIsConnected, proposalParams);

  const buyContract = useCallback(async () => {
    if (proposal) {
      await buyWithProposal(proposal);
    }
  }, [proposal, buyWithProposal]);

  const engine = useTradeEngine({
    canTrade: isAuthenticated && isConnected && !!proposal && !isBuying,
    placeTrade: buyContract,
  });
  const previousAccountId = useRef(accountId);
  const refreshedClosedContracts = useRef(new Set<number>());
  const closeRefreshTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    for (const position of openPositions) {
      const isClosed =
        !!position.is_sold || !!position.is_expired || position.status !== 'open';
      if (!isClosed || refreshedClosedContracts.current.has(position.contract_id)) {
        continue;
      }

      refreshedClosedContracts.current.add(position.contract_id);
      for (const delay of [500, 1500, 3500]) {
        closeRefreshTimers.current.push(
          setTimeout(() => void refreshClosedPositions(), delay)
        );
      }
    }
  }, [openPositions, refreshClosedPositions]);

  useEffect(
    () => () => closeRefreshTimers.current.forEach(clearTimeout),
    []
  );

  useEffect(() => {
    if (previousAccountId.current !== accountId) {
      previousAccountId.current = accountId;
      refreshedClosedContracts.current.clear();
      closeRefreshTimers.current.forEach(clearTimeout);
      closeRefreshTimers.current = [];
      engine.stopEngine();
    }
    if (!isAuthenticated) engine.stopEngine();
  }, [accountId, isAuthenticated, engine.stopEngine]);

  return {
    isConnected,
    isLoading,
    error,
    symbols,
    activeSymbol,
    selectSymbol,
    currentTick,
    lastDigit,
    digitStats,
    contractMode,
    setContractMode,
    selectedDigit,
    setSelectedDigit,
    contractsAvailable,
    pipSize,
    stake,
    setStake,
    duration,
    setDuration,
    durationLimits,
    defaultStake,
    proposal,
    isProposalLoading: isConnected && proposalParams !== null && proposal === null,
    isBuying,
    ...engine,
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
  };
}
