/**
 * Secure Storage Helpers
 *
 * Thin wrappers around expo-secure-store for persisting
 * credentials across app restarts without exposing them in JS state.
 */

import * as SecureStore from 'expo-secure-store';

const PREFIX = 'mc_';

export async function savePassword(accountId: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(`${PREFIX}pwd_${accountId}`, password);
}

export async function getPassword(accountId: string): Promise<string | null> {
  return SecureStore.getItemAsync(`${PREFIX}pwd_${accountId}`);
}

export async function deletePassword(accountId: string): Promise<void> {
  await SecureStore.deleteItemAsync(`${PREFIX}pwd_${accountId}`);
}

export async function saveAccount(accountId: string, accountJson: string): Promise<void> {
  await SecureStore.setItemAsync(`${PREFIX}acct_${accountId}`, accountJson);
}

export async function getAccount(accountId: string): Promise<string | null> {
  return SecureStore.getItemAsync(`${PREFIX}acct_${accountId}`);
}

export async function deleteAccount(accountId: string): Promise<void> {
  await SecureStore.deleteItemAsync(`${PREFIX}acct_${accountId}`);
}

/** Persist which account is the active one so the app can auto-restore it. */
export async function saveActiveAccountId(id: string): Promise<void> {
  await SecureStore.setItemAsync(`${PREFIX}active`, id);
}

export async function getActiveAccountId(): Promise<string | null> {
  return SecureStore.getItemAsync(`${PREFIX}active`);
}

export async function clearActiveAccountId(): Promise<void> {
  await SecureStore.deleteItemAsync(`${PREFIX}active`);
}
