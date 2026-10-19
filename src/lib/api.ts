/**
 * Low-level data access helpers shared by every feature `api.ts`.
 *
 * - `rpc()` calls a Postgres function (all writes go through security-definer RPCs).
 *   Function names and argument names are checked against the generated `Database` types.
 * - `q()` unwraps a PostgREST query (reads are protected by RLS).
 * - Errors are normalized into `ApiError` with a stable code; raw SQL errors never reach the UI.
 *
 * Components should not call these directly; they call the typed functions in `src/features/<domain>/api.ts`.
 */
import type { Database, Json } from './database.types';
import { supabase } from './supabase';

export type ErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'
  | 'BUSINESS_RULE_VIOLATION' | 'RATE_LIMITED' | 'INTERNAL_ERROR';

export class ApiError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Codes that SQL functions raise as `'<CODE>: message'` (see `app_error` in the first migration). */
const CODES: ErrorCode[] = [
  'VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'BUSINESS_RULE_VIOLATION', 'RATE_LIMITED',
];

/** Normalizes Supabase/Postgres errors into stable app codes; never surfaces raw SQL. */
export function toApiError(err: { message?: string; code?: string } | null | undefined): ApiError {
  const msg = err?.message ?? 'Something went wrong';
  const m = /^([A-Z_]+):\s*(.*)$/s.exec(msg);
  if (m && (CODES as string[]).includes(m[1])) return new ApiError(m[1] as ErrorCode, m[2]);
  if (err?.code === '42501') return new ApiError('FORBIDDEN', 'You do not have permission to do this.');
  if (err?.code === '23505') return new ApiError('CONFLICT', 'This record already exists.');
  if (/JWT|session/i.test(msg)) return new ApiError('UNAUTHENTICATED', 'Your session expired. Please sign in again.');
  console.error('Unexpected API error', err);
  return new ApiError('INTERNAL_ERROR', 'Something went wrong. Please try again.');
}

type Functions = Database['public']['Functions'];
export type RpcName = keyof Functions;

/**
 * Arguments for an RPC. Names come from the generated types; values may also be `null`
 * (Postgres functions accept SQL NULL even where the generator marks a parameter as required),
 * and `jsonb` parameters accept any serializable value.
 */
export type RpcArgs<F extends RpcName> = {
  [K in keyof Functions[F]['Args']]: Json extends Functions[F]['Args'][K] ? unknown : Functions[F]['Args'][K] | null;
};

/**
 * Calls a Postgres function. `jsonb` results come back typed as `Json`; the feature `api.ts`
 * that owns the call states the concrete shape (documented next to the SQL function).
 */
export async function rpc<F extends RpcName>(
  fn: F,
  args: RpcArgs<F> = {} as RpcArgs<F>,
): Promise<Functions[F]['Returns']> {
  // `as never`: the loosened argument type above is intentionally wider than supabase-js's.
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) throw toApiError(error);
  return data as Functions[F]['Returns'];
}

/** Unwraps a PostgREST query builder result. */
export async function q<T>(
  p: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>,
): Promise<T> {
  const { data, error } = await p;
  if (error) throw toApiError(error);
  return data as T;
}

/** New idempotency key. Create one per user intent and reuse it on retry so the server records the action once. */
export const newKey = () => crypto.randomUUID();
