import type { ActiveSymbol } from '@deriv/core';

export type EngineMarketScope = 'selected' | 'one-second' | 'volatility' | 'jump';

export const ENGINE_MARKET_SCOPES: {
  value: EngineMarketScope;
  label: string;
}[] = [
  { value: 'selected', label: 'Selected market' },
  { value: 'one-second', label: 'All 1-second indices' },
  { value: 'volatility', label: 'Plain indices (non-1s)' },
  { value: 'jump', label: 'Jump indices' },
];

export function getEngineMarketSymbols(
  symbols: ActiveSymbol[],
  scope: EngineMarketScope
): ActiveSymbol[] {
  if (scope === 'selected') return [];

  return symbols.filter((symbol) => {
    if (symbol.exchange_is_open !== 1 || symbol.is_trading_suspended === 1) return false;
    if (scope === 'one-second') return symbol.underlying_symbol.startsWith('1HZ');
    if (scope === 'volatility') return /^R_\d+$/.test(symbol.underlying_symbol);
    return /^JD\d+$/.test(symbol.underlying_symbol);
  });
}
