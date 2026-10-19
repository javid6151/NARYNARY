/**
 * Unsubmitted meal records are kept as a draft in this browser (per building, date and meal), so a chef
 * can save midway and come back. Drafts never reach the server; only "Submit Meal Record" posts to the ledger.
 */
import type { IngredientLine } from '../../types';

export interface MealDraft {
  used: IngredientLine[];
  returns: IngredientLine[];
  waste: IngredientLine[];
  actual: string;
  summary: string;
  savedAt: string;
}

const key = (buildingId: string, date: string, meal: string) => `zp.kitchen.draft.${buildingId}.${date}.${meal}`;

export function loadDraft(buildingId: string, date: string, meal: string): MealDraft | null {
  try {
    const raw = localStorage.getItem(key(buildingId, date, meal));
    return raw ? (JSON.parse(raw) as MealDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(buildingId: string, date: string, meal: string, d: Omit<MealDraft, 'savedAt'>) {
  try {
    localStorage.setItem(key(buildingId, date, meal), JSON.stringify({ ...d, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(buildingId: string, date: string, meal: string) {
  try {
    localStorage.removeItem(key(buildingId, date, meal));
  } catch {
    /* storage unavailable */
  }
}
