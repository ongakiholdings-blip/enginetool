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
import { getEngineMarketSymbols } from '../lib/engine-market-scope';
import type { EngineMarketScope } from '../lib/engine-market-scope';
import { useTradeEngine } from './use-trade-engine';
import type { EngineDurationUnit, TradeIntervalMinutes } from './use-trade-engine';
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
  martingaleMultiplier: string;
  setMartingaleMultiplier: (value: string) => void;
  martingaleError: string | null;
  duration: string;
  setDuration: (value: string) => void;
  durationLimits: DurationLimits;
  defaultStake: number;
  proposal: ProposalInfo | null;
  isProposalLoading: boolean;
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
  engineMarketScope: EngineMarketScope;
  setEngineMarketScope: (scope: EngineMarketScope) => void;
  canEngineMarketTrade: boolean;
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
  const [stake, setStakeState] = useState<string>('0.73');
  const [engineStake, setEngineStake] = useState(0.73);
  const [martingaleMultiplier, setMartingaleMultiplierState] = useState('2');
  const [martingaleError, setMartingaleError] = useState<string | null>(null);
  const [engineMarketScope, setEngineMarketScopeState] =
    useState<EngineMarketScope>('selected');
  const engineMarketScopeRef = useRef<EngineMarketScope>('selected');
  const expectedEngineSymbolRef = useRef<string | null>(null);
  const activeSymbolRef = useRef(activeSymbol);
  const proposalRef = useRef<ProposalInfo | null>(null);
  const [hasPendingEngineTrade, setHasPendingEngineTrade] = useState(false);
  const engineStakeRef = useRef(0.73);
  const sessionBaseStakeRef = useRef(0.73);
  const engineRunningRef = useRef(false);
  const pendingEngineContractsRef = useRef(new Map<number, number>());
  const earlyClosedContractsRef = useRef(new Map<number, number>());
  const processedEngineContractsRef = useRef(new Set<number>());
  const stakeRef = useRef(stake);
  stakeRef.current = stake;

  const updateEngineStake = useCallback((value: number) => {
    engineStakeRef.current = value;
    setEngineStake(value);
  }, []);

  const setStake = useCallback((value: string) => {
    stakeRef.current = value;
    setStakeState(value);
    if (!engineRunningRef.current) {
      updateEngineStake(Number(value));
    }
  }, [updateEngineStake]);

  const setMartingaleMultiplier = useCallback((value: string) => {
    setMartingaleMultiplierState(value);
    setMartingaleError(null);
  }, []);
  const [duration, setDuration] = useState<string>('1');

  const digitStats: DigitStats = useMemo(
    () => computeDigitStats(prices, pipSize),
    [prices, pipSize]
  );
  activeSymbolRef.current = activeSymbol;
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

  const proposalContractMode = contractMode;
  const proposalBarrier =
    contractMode === 'DIGITOVER'
      ? 1
      : contractMode === 'DIGITUNDER'
        ? 8
        : selectedDigit;

  // Null out params while a buy is in-flight — forces useProposal to unsubscribe
  // the consumed proposal ID. When isBuying flips back to false, the memo returns
  // real params and useProposal re-subscribes to get a fresh proposal.
  const proposalParams: ProposalParams | null = useMemo(() => {
    if (isBuying || !activeSymbol) return null;
    if (!Number.isFinite(engineStake) || engineStake <= 0) return null;
    const durationNum = Number(duration);
    if (
      !Number.isInteger(durationNum) ||
      durationNum < durationLimits.min ||
      durationNum > durationLimits.max
    ) {
      return null;
    }

    return {
      contractType: proposalContractMode,
      symbol: activeSymbol.underlying_symbol,
      amount: engineStake,
      duration: durationNum,
      durationUnit: 't',
      basis: 'stake' as const,
      currency: 'USD',
      barrier: proposalBarrier,
    };
  }, [
    activeSymbol,
    proposalBarrier,
    proposalContractMode,
    engineStake,
    duration,
    durationLimits,
    isBuying,
  ]);

  const { proposal: receivedProposal } = useProposal(
    tradingWs,
    tradingIsConnected,
    proposalParams
  );
  const proposal =
    receivedProposal?.amount === engineStake &&
    receivedProposal.symbol === activeSymbol?.underlying_symbol &&
    receivedProposal.contractType === proposalContractMode &&
    receivedProposal.barrier === proposalBarrier
      ? receivedProposal
      : null;
  proposalRef.current = proposal;

  const buyContract = useCallback(async () => {
    if (!proposal) throw new Error('The trade proposal is no longer available');
    const purchaseSucceeded = await buyWithProposal(proposal);
    if (!purchaseSucceeded) {
      throw new Error('Purchase failed. Check the purchase error notification and account connection.');
    }
  }, [proposal, buyWithProposal]);

  const engineMarketSymbols = useMemo(
    () => getEngineMarketSymbols(symbols, engineMarketScope),
    [symbols, engineMarketScope]
  );
  const engineMarketReady =
    engineMarketScope === 'selected' ||
    engineMarketSymbols.some(
      (symbol) => symbol.underlying_symbol === activeSymbol?.underlying_symbol
    );
  const setEngineMarketScope = useCallback(
    (scope: EngineMarketScope) => {
      if (engineRunningRef.current) return;
      engineMarketScopeRef.current = scope;
      if (scope === 'selected') {
        expectedEngineSymbolRef.current = activeSymbolRef.current?.underlying_symbol ?? null;
      } else {
        const eligibleSymbols = getEngineMarketSymbols(symbols, scope);
        expectedEngineSymbolRef.current = eligibleSymbols.some(
          (symbol) => symbol.underlying_symbol === activeSymbolRef.current?.underlying_symbol
        )
          ? activeSymbolRef.current?.underlying_symbol ?? null
          : eligibleSymbols[0]?.underlying_symbol ?? null;
      }
      setEngineMarketScopeState(scope);
    },
    [symbols]
  );
  const selectNextEngineMarket = useCallback(() => {
    if (engineMarketScope === 'selected' || engineMarketSymbols.length === 0) return;
    const currentIndex = engineMarketSymbols.findIndex(
      (symbol) => symbol.underlying_symbol === activeSymbol?.underlying_symbol
    );
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % engineMarketSymbols.length;
    expectedEngineSymbolRef.current = engineMarketSymbols[nextIndex].underlying_symbol;
    selectSymbol(engineMarketSymbols[nextIndex].underlying_symbol);
  }, [activeSymbol, engineMarketScope, engineMarketSymbols, selectSymbol]);
  const isEngineProposalReady = useCallback(() => {
    const expectedSymbol = expectedEngineSymbolRef.current;
    const currentSymbol = activeSymbolRef.current?.underlying_symbol;
    const proposalSymbol = proposalRef.current?.symbol;
    return (
      currentSymbol !== undefined &&
      proposalSymbol === currentSymbol &&
      proposalRef.current?.contractType === contractMode &&
      proposalRef.current?.barrier === proposalBarrier &&
      (engineMarketScopeRef.current === 'selected' || expectedSymbol === currentSymbol)
    );
  }, [contractMode, proposalBarrier]);

  const shouldWaitForMartingaleSettlement =
    martingaleMultiplier.trim() !== '' && Number(martingaleMultiplier) > 1;
  const engine = useTradeEngine({
    canTrade:
      isAuthenticated &&
      isConnected &&
      engineMarketReady &&
      !!proposal &&
      !isBuying &&
      (!shouldWaitForMartingaleSettlement || !hasPendingEngineTrade),
    isTradeReady: isEngineProposalReady,
    placeTrade: buyContract,
    onTradeComplete: selectNextEngineMarket,
  });

  useEffect(() => {
    if (
      engine.isEngineRunning ||
      engineMarketScope === 'selected' ||
      engineMarketSymbols.length === 0 ||
      engineMarketReady
    ) {
      return;
    }
    selectSymbol(engineMarketSymbols[0].underlying_symbol);
    expectedEngineSymbolRef.current = engineMarketSymbols[0].underlying_symbol;
  }, [
    activeSymbol,
    engine.isEngineRunning,
    engineMarketReady,
    engineMarketScope,
    engineMarketSymbols,
    selectSymbol,
  ]);
  const processEngineTradeOutcome = useCallback(
    (contractId: number, profit: number) => {
      const tradeStake = pendingEngineContractsRef.current.get(contractId);
      if (tradeStake === undefined || processedEngineContractsRef.current.has(contractId)) {
        return;
      }

      processedEngineContractsRef.current.add(contractId);
      if (processedEngineContractsRef.current.size > 500) {
        const oldestContractId = processedEngineContractsRef.current.values().next().value;
        if (oldestContractId !== undefined) {
          processedEngineContractsRef.current.delete(oldestContractId);
        }
      }
      pendingEngineContractsRef.current.delete(contractId);
      earlyClosedContractsRef.current.delete(contractId);
      setHasPendingEngineTrade(pendingEngineContractsRef.current.size > 0);

      const multiplier = martingaleMultiplier.trim()
        ? Number(martingaleMultiplier)
        : 1;
      const nextStake =
        profit < 0
          ? Math.round(tradeStake * multiplier * 100) / 100
          : sessionBaseStakeRef.current;

      if (!Number.isFinite(nextStake) || nextStake <= 0) {
        setMartingaleError('Martingale stake is invalid; engine stopped');
        engine.stopEngine();
        return;
      }
      updateEngineStake(nextStake);
    },
    [engine.stopEngine, martingaleMultiplier, updateEngineStake]
  );

  useEffect(() => {
    engineRunningRef.current = engine.isEngineRunning;
    if (engine.isEngineRunning) return;

    pendingEngineContractsRef.current.clear();
    earlyClosedContractsRef.current.clear();
    processedEngineContractsRef.current.clear();
    setHasPendingEngineTrade(false);
    updateEngineStake(Number(stakeRef.current));
  }, [engine.isEngineRunning, updateEngineStake]);

  useEffect(() => {
    for (const position of openPositions) {
      const isClosed =
        !!position.is_sold || !!position.is_expired || position.status !== 'open';
      if (!isClosed) continue;

      const profitValue: unknown = position.profit;
      if (
        (typeof profitValue !== 'string' && typeof profitValue !== 'number') ||
        (typeof profitValue === 'string' && profitValue.trim() === '')
      ) {
        continue;
      }
      const profit = Number(profitValue);
      if (!Number.isFinite(profit)) continue;
      if (
        !processedEngineContractsRef.current.has(position.contract_id) &&
        !pendingEngineContractsRef.current.has(position.contract_id)
      ) {
        earlyClosedContractsRef.current.set(position.contract_id, profit);
        if (earlyClosedContractsRef.current.size > 100) {
          const oldestContractId = earlyClosedContractsRef.current.keys().next().value;
          if (oldestContractId !== undefined) {
            earlyClosedContractsRef.current.delete(oldestContractId);
          }
        }
      }
      processEngineTradeOutcome(position.contract_id, profit);
    }
  }, [openPositions, processEngineTradeOutcome]);

  useEffect(() => {
    if (!buyResult || !engineRunningRef.current) return;
    const contractId = buyResult.contractId;
    if (
      processedEngineContractsRef.current.has(contractId) ||
      pendingEngineContractsRef.current.has(contractId)
    ) {
      return;
    }

    const closedProfit = earlyClosedContractsRef.current.get(contractId);
    pendingEngineContractsRef.current.set(contractId, engineStakeRef.current);
    setHasPendingEngineTrade(true);
    if (closedProfit !== undefined) {
      processEngineTradeOutcome(contractId, closedProfit);
    }
  }, [buyResult, processEngineTradeOutcome]);

  const startEngine = useCallback(() => {
    if (!engineMarketReady) return;
    const multiplier = martingaleMultiplier.trim()
      ? Number(martingaleMultiplier)
      : 1;
    if (!Number.isFinite(multiplier) || multiplier < 1) {
      setMartingaleError('Martingale multiplier must be 1 or greater');
      return;
    }

    const baseStake = Number(stakeRef.current);
    if (!Number.isFinite(baseStake) || baseStake <= 0) return;

    setMartingaleError(null);
    sessionBaseStakeRef.current = baseStake;
    pendingEngineContractsRef.current.clear();
    earlyClosedContractsRef.current.clear();
    processedEngineContractsRef.current.clear();
    setHasPendingEngineTrade(false);
    updateEngineStake(baseStake);
    engine.startEngine();
  }, [
    engine.startEngine,
    engineMarketReady,
    martingaleMultiplier,
    updateEngineStake,
  ]);

  const stopEngine = useCallback(() => {
    engine.stopEngine();
  }, [engine.stopEngine]);

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
      stopEngine();
    }
    if (!isAuthenticated) stopEngine();
  }, [accountId, isAuthenticated, stopEngine]);

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
    martingaleMultiplier,
    setMartingaleMultiplier,
    martingaleError,
    duration,
    setDuration,
    durationLimits,
    defaultStake,
    proposal,
    isProposalLoading: isConnected && proposalParams !== null && proposal === null,
    isBuying,
    ...engine,
    engineError: engine.engineError,
    engineMarketScope,
    setEngineMarketScope,
    canEngineMarketTrade: engineMarketReady,
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
  };
}
