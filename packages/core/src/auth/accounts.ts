import type { AuthInfo, DerivAccount, OTPResponse } from '../types';
import {
  storeDerivAccounts,
  setActiveLoginId,
  setAccountType,
  clearAllAuthData,
} from './storage';
import { getApiBaseUrl } from '../config/urls';

function getAccountsRequestError(status: number, action: string): Error {
  if (status === 401) {
    return new Error(
      'Deriv rejected the token (401). Enter a Personal Access Token (PAT) with trade permission and confirm it has not been revoked.'
    );
  }
  if (status === 403) {
    return new Error(
      'The token was rejected (403). Confirm it has trade permission and that the Deriv App ID is correct.'
    );
  }
  return new Error(`${action} (${status})`);
}

/**
 * Fetch the list of trading accounts for the authenticated user.
 */
export async function fetchAccounts(
  authInfo: Pick<AuthInfo, 'access_token'>,
  clientId: string
): Promise<DerivAccount[]> {
  const response = await fetch(`${getApiBaseUrl()}/accounts`, {
    headers: {
      Authorization: `Bearer ${authInfo.access_token}`,
      'Deriv-App-ID': clientId,
    },
  });

  if (!response.ok) {
    throw getAccountsRequestError(response.status, 'Failed to fetch accounts');
  }

  const data = await response.json();
  const accounts: DerivAccount[] = data.data;

  storeDerivAccounts(accounts);

  if (accounts.length > 0) {
    const firstAccount = accounts[0];
    setActiveLoginId(firstAccount.account_id);
    setAccountType(firstAccount.account_type);
  }

  return accounts;
}

/**
 * Get a one-time WebSocket URL for an authenticated session.
 */
export async function getWebSocketOTP(
  accountId: string,
  authInfo: Pick<AuthInfo, 'access_token'>,
  clientId: string
): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/accounts/${accountId}/otp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authInfo.access_token}`,
      'Deriv-App-ID': clientId,
    },
  });

  if (!response.ok) {
    throw getAccountsRequestError(
      response.status,
      'Failed to get authenticated WebSocket connection'
    );
  }

  const data: OTPResponse = await response.json();
  return data.data.url;
}

/**
 * Perform logout: clear all auth data.
 * Caller is responsible for closing any open WebSocket connections and resetting UI.
 */
export function logout(): void {
  clearAllAuthData();
}
