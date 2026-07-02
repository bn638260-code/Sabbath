import {
  convertFileSrc,
  invoke,
  type InvokeArgs,
  type InvokeOptions,
} from "@tauri-apps/api/core"

declare global {
  interface Window {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }
}

export function isTauriRuntime(): boolean {
  if (import.meta.env.MODE === "test") return true

  return (
    typeof window !== "undefined" &&
    (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined)
  )
}

export async function invokeTauri<T>(
  command: string,
  args?: InvokeArgs,
  options?: InvokeOptions
): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error(`Tauri command "${command}" is unavailable outside the desktop runtime.`)
  }

  if (options === undefined) {
    return invoke<T>(command, args)
  }

  return invoke<T>(command, args, options)
}

export function convertTauriFileSrc(filePath: string): string {
  if (!isTauriRuntime()) return filePath
  return convertFileSrc(filePath)
}
