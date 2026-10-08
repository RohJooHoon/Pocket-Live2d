import { LEGAL_CONSENT_STORAGE_KEY, LEGAL_CONSENT_VERSION } from '../config';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** localStorage, or null when the browser blocks it (private mode, disabled storage). */
export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasAcceptedCurrentTerms(store: KeyValueStore | null): boolean {
  try {
    return store?.getItem(LEGAL_CONSENT_STORAGE_KEY) === LEGAL_CONSENT_VERSION;
  } catch {
    return false;
  }
}

/** Remembers the acceptance; without storage the visitor is simply asked again next time. */
export function recordAcceptance(store: KeyValueStore | null): void {
  try {
    store?.setItem(LEGAL_CONSENT_STORAGE_KEY, LEGAL_CONSENT_VERSION);
  } catch {
    // Storage can be full or blocked; consent still applies to this visit.
  }
}
