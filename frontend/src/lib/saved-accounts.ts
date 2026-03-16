import type { User } from '@/lib/api';

const SAVED_ACCOUNTS_KEY = 'savedAuthAccounts';
const MAX_SAVED_ACCOUNTS = 10;

export interface SavedAuthAccount {
  key: string;
  token: string;
  user: User;
  savedAt: string;
  lastUsedAt: string;
}

function parseSavedAccounts(raw: string | null): SavedAuthAccount[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SavedAuthAccount => {
      return (
        item &&
        typeof item.key === 'string' &&
        typeof item.token === 'string' &&
        item.user &&
        typeof item.user.id === 'number' &&
        typeof item.user.email === 'string' &&
        typeof item.user.full_name === 'string'
      );
    });
  } catch {
    return [];
  }
}

function persist(accounts: SavedAuthAccount[]) {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getSavedAccounts(): SavedAuthAccount[] {
  const accounts = parseSavedAccounts(localStorage.getItem(SAVED_ACCOUNTS_KEY));
  return [...accounts].sort((a, b) => {
    return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
  });
}

export function makeSavedAccountKey(user: User): string {
  return `${user.id}:${user.email.toLowerCase()}`;
}

export function upsertSavedAccount(token: string, user: User) {
  const key = makeSavedAccountKey(user);
  const currentAccounts = getSavedAccounts();
  const accounts = currentAccounts.filter((account) => account.key !== key);
  const now = new Date().toISOString();

  const existing = currentAccounts.find((account) => account.key === key);

  const next: SavedAuthAccount = {
    key,
    token,
    user,
    savedAt: existing?.savedAt || now,
    lastUsedAt: now,
  };

  const merged = [next, ...accounts].slice(0, MAX_SAVED_ACCOUNTS);
  persist(merged);
}

export function removeSavedAccount(accountKey: string) {
  const accounts = getSavedAccounts().filter((account) => account.key !== accountKey);
  persist(accounts);
}

export function touchSavedAccount(accountKey: string) {
  const accounts = getSavedAccounts();
  const index = accounts.findIndex((account) => account.key === accountKey);
  if (index < 0) return;

  const now = new Date().toISOString();
  const updated = { ...accounts[index], lastUsedAt: now };
  const next = [updated, ...accounts.filter((account) => account.key !== accountKey)];
  persist(next);
}
