import { invoke } from '@tauri-apps/api/core';

export function tauriInvoke<TResponse>(
    command: string,
    args?: Record<string, unknown>,
): Promise<TResponse> {
    return invoke<TResponse>(command, args);
}