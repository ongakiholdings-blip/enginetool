import type { DerivAccount } from '../types';
import { fetchAccounts, getWebSocketOTP } from './accounts';

export interface ApiTokenSession {
  accounts: DerivAccount[];
  activeAccount: DerivAccount;
  wsUrl: string;
}

/**
 * Authenticates a Personal Access Token using Deriv's REST API and obtains an
 * authenticated WebSocket URL for the selected account.
 */
export async function authorizeApiToken(
  token: string,
  clientId: string,
  preferredAccountId?: string | null
): Promise<ApiTokenSession> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    throw new Error('Enter an API token.');
  }
  if (!clientId) {
    throw new Error('Deriv App ID is not configured.');
  }

  const authInfo = { access_token: trimmedToken };
  const accounts = await fetchAccounts(authInfo, clientId);
  if (accounts.length === 0) {
    throw new Error('No trading accounts are available for this API token.');
  }

  const activeAccount =
    accounts.find(account => account.account_id === preferredAccountId) ?? accounts[0];
  const wsUrl = await getWebSocketOTP(activeAccount.account_id, authInfo, clientId);

  return { accounts, activeAccount, wsUrl };
}
