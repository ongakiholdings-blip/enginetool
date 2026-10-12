'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const TRADE_INTERVAL_OPTIONS = [1, 5, 10] as const;

export type TradeIntervalMinutes = (typeof TRADE_INTERVAL_OPTIONS)[number];

interface UseTradeEngineParams {
  canTrade: boolean;
  placeTrade: () => Promise<void>;
}

interface UseTradeEngineReturn {
  isEngineRunning: boolean;
  intervalMinutes: TradeIntervalMinutes;
  setIntervalMinutes: (minutes: TradeIntervalMinutes) => void;
  secondsUntilNextTrade: number | null;
  engineError: string | null;
  startEngine: () => void;
  stopEngine: () => void;
}

export function useTradeEngine({
  canTrade,
  placeTrade,
}: UseTradeEngineParams): UseTradeEngineReturn {
  const [isEngineRunning, setIsEngineRunning] = useState(false);
  const [intervalMinutes, setIntervalMinutesState] = useState<TradeIntervalMinutes>(1);
  const [nextTradeAt, setNextTradeAt] = useState<number | null>(null);
  const [secondsUntilNextTrade, setSecondsUntilNextTrade] = useState<number | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const intervalRef = useRef<TradeIntervalMinutes>(1);
  const canTradeRef = useRef(canTrade);
  const placeTradeRef = useRef(placeTrade);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  canTradeRef.current = canTrade;
  placeTradeRef.current = placeTrade;

  const runCycle = useCallback(async () => {
    if (!runningRef.current) return;

    const nextAt = Date.now() + intervalRef.current * 60_000;
    setNextTradeAt(nextAt);

    try {
      if (canTradeRef.current) await placeTradeRef.current();
    } catch (error) {
      runningRef.current = false;
      setIsEngineRunning(false);
      setNextTradeAt(null);
      setSecondsUntilNextTrade(null);
      setEngineError(
        error instanceof Error ? error.message : 'Engine stopped after an error'
      );
      return;
    }

    if (!runningRef.current) return;
    timerRef.current = setTimeout(
      () => void runCycle(),
      Math.max(0, nextAt - Date.now())
    );
  }, []);

  const startEngine = useCallback(() => {
    if (runningRef.current) return;
    setEngineError(null);
    runningRef.current = true;
    setIsEngineRunning(true);
    void runCycle();
  }, [runCycle]);

  const stopEngine = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsEngineRunning(false);
    setNextTradeAt(null);
    setSecondsUntilNextTrade(null);
  }, []);

  const setIntervalMinutes = useCallback((minutes: TradeIntervalMinutes) => {
    if (runningRef.current || !TRADE_INTERVAL_OPTIONS.includes(minutes)) return;
    intervalRef.current = minutes;
    setIntervalMinutesState(minutes);
  }, []);

  useEffect(() => {
    if (!isEngineRunning || nextTradeAt === null) return;

    const updateCountdown = () => {
      setSecondsUntilNextTrade(Math.max(0, Math.ceil((nextTradeAt - Date.now()) / 1000)));
    };
    updateCountdown();
    const countdown = setInterval(updateCountdown, 1000);
    return () => clearInterval(countdown);
  }, [isEngineRunning, nextTradeAt]);

  useEffect(
    () => () => {
      runningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return {
    isEngineRunning,
    intervalMinutes,
    setIntervalMinutes,
    secondsUntilNextTrade,
    engineError,
    startEngine,
    stopEngine,
  };
}
