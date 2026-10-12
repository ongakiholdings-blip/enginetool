'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const TRADE_INTERVAL_OPTIONS = [0.5, 1, 5, 10] as const;
const MAX_TIMEOUT_MS = 2_147_000_000;

type EngineCue = 'interval-start' | 'interval-end';

function playTone(context: AudioContext, frequency: number, startAt: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const duration = 0.12;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

function playEngineCue(context: AudioContext, cue: EngineCue): void {
  const startAt = context.currentTime + 0.02;
  const notes =
    cue === 'interval-start'
      ? [523.25, 659.25, 783.99]
      : [880, 587.33];

  notes.forEach((frequency, index) => {
    playTone(context, frequency, startAt + index * 0.16);
  });
}

function waitForDelayOrAbort(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });
  });
}

export type TradeIntervalMinutes = (typeof TRADE_INTERVAL_OPTIONS)[number];
export type EngineDurationUnit = 'minutes' | 'hours' | 'days';

interface UseTradeEngineParams {
  canTrade: boolean;
  isTradeReady?: () => boolean;
  placeTrade: () => Promise<void>;
  onTradeComplete?: () => void;
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
  isTradeReady,
  placeTrade,
  onTradeComplete,
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
  const isTradeReadyRef = useRef(isTradeReady);
  const placeTradeRef = useRef(placeTrade);
  const onTradeCompleteRef = useRef(onTradeComplete);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const endsAtRef = useRef<number | null>(null);
  const nextTradeAtRef = useRef<number | null>(null);
  const cycleAbortRef = useRef<AbortController | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioReadyRef = useRef<Promise<void>>(Promise.resolve());
  const isInitialCycleRef = useRef(true);

  canTradeRef.current = canTrade;
  isTradeReadyRef.current = isTradeReady;
  placeTradeRef.current = placeTrade;
  onTradeCompleteRef.current = onTradeComplete;

  const enableEngineSounds = useCallback(() => {
    if (typeof window === 'undefined' || !window.AudioContext) {
      console.error('Engine notification sounds are not supported by this browser');
      return;
    }

    const context = audioContextRef.current ?? new window.AudioContext();
    audioContextRef.current = context;
    if (context.state !== 'running') {
      audioReadyRef.current = context.resume().catch((error: unknown) => {
        console.error('Unable to enable engine notification sounds', error);
      });
    }
  }, []);

  const notifyInterval = useCallback((cue: EngineCue) => {
    void audioReadyRef.current.then(() => {
      const context = audioContextRef.current;
      if (context?.state === 'running') playEngineCue(context, cue);
    });
  }, []);

  const stopEngine = useCallback(() => {
    runningRef.current = false;
    cycleAbortRef.current?.abort();
    cycleAbortRef.current = null;
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
    nextTradeAtRef.current = null;
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

    const nextTradeAt = nextTradeAtRef.current ?? Date.now();
    const remaining = nextTradeAt - Date.now();
    if (remaining > 0) {
      timerRef.current = setTimeout(
        () => void runCycle(),
        Math.min(remaining, MAX_TIMEOUT_MS)
      );
      return;
    }

    if (!isInitialCycleRef.current) notifyInterval('interval-end');
    isInitialCycleRef.current = false;
    nextTradeAtRef.current = null;
    setNextTradeAt(null);
    const controller = new AbortController();
    cycleAbortRef.current = controller;
    try {
      while (
        runningRef.current &&
        !controller.signal.aborted &&
        (!canTradeRef.current ||
          (isTradeReadyRef.current && !isTradeReadyRef.current()))
      ) {
        if (endsAtRef.current !== null && Date.now() >= endsAtRef.current) {
          stopEngine();
          return;
        }
        await waitForDelayOrAbort(250, controller.signal);
      }
      if (!runningRef.current || controller.signal.aborted) return;
      await placeTradeRef.current();
      if (runningRef.current) {
        onTradeCompleteRef.current?.();
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      stopEngine();
      setEngineError(
        error instanceof Error ? error.message : 'Engine stopped after an error'
      );
      return;
    } finally {
      if (cycleAbortRef.current === controller) cycleAbortRef.current = null;
    }

    if (!runningRef.current) return;
    if (endsAtRef.current !== null && Date.now() >= endsAtRef.current) {
      stopEngine();
      return;
    }
    const waitUntil = Date.now() + intervalRef.current * 60_000;
    nextTradeAtRef.current = waitUntil;
    setNextTradeAt(waitUntil);
    notifyInterval('interval-start');
    timerRef.current = setTimeout(
      () => void runCycle(),
      Math.min(waitUntil - Date.now(), MAX_TIMEOUT_MS)
    );
  }, [notifyInterval, stopEngine]);

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
    isInitialCycleRef.current = true;
    enableEngineSounds();
    notifyInterval('interval-start');
    setIsEngineRunning(true);
    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    setElapsedSeconds(0);
    nextTradeAtRef.current = startedAt;
    setNextTradeAt(startedAt);
    endsAtRef.current =
      !hasDuration ? null : startedAt + durationSeconds * 1000;
    if (endsAtRef.current !== null) scheduleDurationStop();
    void runCycle();
  }, [
    activeDuration,
    activeDurationUnit,
    enableEngineSounds,
    notifyInterval,
    runCycle,
    scheduleDurationStop,
  ]);

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
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch((error: unknown) => {
          console.error('Unable to close engine notification audio', error);
        });
      }
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
