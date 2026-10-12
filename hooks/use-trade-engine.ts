'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const TRADE_INTERVAL_OPTIONS = [0.5, 1, 5, 10] as const;
const MAX_TIMEOUT_MS = 2_147_000_000;

export type TradeIntervalMinutes = (typeof TRADE_INTERVAL_OPTIONS)[number];
export type EngineDurationUnit = 'minutes' | 'hours' | 'days';

interface UseTradeEngineParams {
  canTrade: boolean;
  placeTrade: () => Promise<void>;
}

interface UseTradeEngineReturn {
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
  startEngine: () => void;
  stopEngine: () => void;
}

export function useTradeEngine({
  canTrade,
  placeTrade,
}: UseTradeEngineParams): UseTradeEngineReturn {
  const [isEngineRunning, setIsEngineRunning] = useState(false);
  const [intervalMinutes, setIntervalMinutesState] = useState<TradeIntervalMinutes>(1);
  const [activeDuration, setActiveDurationState] = useState('');
  const [activeDurationUnit, setActiveDurationUnitState] =
    useState<EngineDurationUnit>('minutes');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [nextTradeAt, setNextTradeAt] = useState<number | null>(null);
  const [secondsUntilNextTrade, setSecondsUntilNextTrade] = useState<number | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const intervalRef = useRef<TradeIntervalMinutes>(1);
  const canTradeRef = useRef(canTrade);
  const placeTradeRef = useRef(placeTrade);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const endsAtRef = useRef<number | null>(null);

  canTradeRef.current = canTrade;
  placeTradeRef.current = placeTrade;

  const stopEngine = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearTimeout(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (startedAtRef.current !== null) {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }
    startedAtRef.current = null;
    endsAtRef.current = null;
    setIsEngineRunning(false);
    setNextTradeAt(null);
    setSecondsUntilNextTrade(null);
  }, []);

  const scheduleDurationStop = useCallback(() => {
    const schedule = () => {
      const endsAt = endsAtRef.current;
      if (endsAt === null) return;

      const remaining = endsAt - Date.now();
      if (remaining <= 0) {
        stopEngine();
        return;
      }

      durationTimerRef.current = setTimeout(
        () => {
          if (endsAtRef.current !== null && Date.now() >= endsAtRef.current) {
            stopEngine();
          } else {
            schedule();
          }
        },
        Math.min(remaining, MAX_TIMEOUT_MS)
      );
    };
    schedule();
  }, [stopEngine]);

  const runCycle = useCallback(async () => {
    if (!runningRef.current) return;
    if (endsAtRef.current !== null && Date.now() >= endsAtRef.current) {
      stopEngine();
      return;
    }

    const nextAt = Date.now() + intervalRef.current * 60_000;
    setNextTradeAt(nextAt);

    try {
      if (canTradeRef.current) await placeTradeRef.current();
    } catch (error) {
      stopEngine();
      setEngineError(
        error instanceof Error ? error.message : 'Engine stopped after an error'
      );
      return;
    }

    if (!runningRef.current) return;
    if (endsAtRef.current !== null && Date.now() >= endsAtRef.current) {
      stopEngine();
      return;
    }
    const waitUntil =
      endsAtRef.current === null ? nextAt : Math.min(nextAt, endsAtRef.current);
    timerRef.current = setTimeout(
      () => {
        if (endsAtRef.current !== null && Date.now() >= endsAtRef.current) {
          stopEngine();
        } else {
          void runCycle();
        }
      },
      Math.max(0, waitUntil - Date.now())
    );
  }, [stopEngine]);

  const startEngine = useCallback(() => {
    if (runningRef.current) return;
    setEngineError(null);
    const amount = Number(activeDuration);
    const hasDuration = activeDuration.trim() !== '';
    const unitSeconds = {
      minutes: 60,
      hours: 60 * 60,
      days: 24 * 60 * 60,
    }[activeDurationUnit];
    const durationSeconds = amount * unitSeconds;
    if (
      hasDuration &&
      (!Number.isSafeInteger(amount) ||
        amount < 1 ||
        !Number.isFinite(durationSeconds * 1000))
    ) {
      setEngineError('Engine time limit must be a positive whole number');
      return;
    }

    runningRef.current = true;
    setIsEngineRunning(true);
    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    setElapsedSeconds(0);
    endsAtRef.current =
      !hasDuration ? null : startedAt + durationSeconds * 1000;
    if (endsAtRef.current !== null) scheduleDurationStop();
    void runCycle();
  }, [activeDuration, activeDurationUnit, runCycle, scheduleDurationStop]);

  const setIntervalMinutes = useCallback((minutes: TradeIntervalMinutes) => {
    if (runningRef.current || !TRADE_INTERVAL_OPTIONS.includes(minutes)) return;
    intervalRef.current = minutes;
    setIntervalMinutesState(minutes);
  }, []);

  const setActiveDuration = useCallback((duration: string) => {
    if (runningRef.current) return;
    setActiveDurationState(duration);
  }, []);

  const setActiveDurationUnit = useCallback((unit: EngineDurationUnit) => {
    if (runningRef.current) return;
    setActiveDurationUnitState(unit);
  }, []);

  useEffect(() => {
    if (!isEngineRunning || startedAtRef.current === null) return;
    const updateElapsed = () => {
      if (startedAtRef.current !== null) {
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [isEngineRunning]);

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
      if (durationTimerRef.current) clearTimeout(durationTimerRef.current);
    },
    []
  );

  return {
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
    startEngine,
    stopEngine,
  };
}
