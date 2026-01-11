/**
 * Tauri invoke wrapper hook
 *
 * Provides a typed wrapper around Tauri's invoke function
 * with automatic error handling via Result types.
 */

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";

// Result type per architecture requirements
export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export type InvokeStatus = "idle" | "loading" | "success" | "error";

interface UseTauriInvokeResult<T> {
  status: InvokeStatus;
  data: T | null;
  error: Error | null;
  execute: () => Promise<Result<T>>;
  reset: () => void;
}

/**
 * Hook for invoking Tauri commands with Result type pattern
 *
 * @param command - The Tauri command name (snake_case)
 * @param args - Optional arguments to pass to the command
 * @returns Object with status, data, error, execute function, and reset function
 *
 * @example
 * const { status, data, execute } = useTauriInvoke<VersionInfo>('get_version');
 * useEffect(() => { execute(); }, []);
 */
export function useTauriInvoke<T, A = unknown>(
  command: string,
  args?: A
): UseTauriInvokeResult<T> {
  const [status, setStatus] = useState<InvokeStatus>("idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (): Promise<Result<T>> => {
    setStatus("loading");
    setError(null);

    try {
      const result = await invoke<T>(command, args as Record<string, unknown>);
      setData(result);
      setStatus("success");
      return { ok: true, data: result };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setStatus("error");
      return { ok: false, error: err };
    }
  }, [command, args]);

  const reset = useCallback(() => {
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  return { status, data, error, execute, reset };
}

/**
 * Simple one-shot invoke with Result type
 * Use this for actions that don't need reactive state
 *
 * @example
 * const result = await tauriInvoke<ScanResult>('scan_folder', { path: '/tmp' });
 * if (result.ok) { console.log(result.data); }
 */
export async function tauriInvoke<T, A = unknown>(
  command: string,
  args?: A
): Promise<Result<T>> {
  try {
    const result = await invoke<T>(command, args as Record<string, unknown>);
    return { ok: true, data: result };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { ok: false, error: err };
  }
}
