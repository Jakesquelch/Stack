import { friendlyError } from './supabase'

const listeners = new Set<(message: string) => void>()

/** Shows an error briefly at the top of the screen. Every failed save goes through here. */
export function showError(error: unknown) {
  const message = friendlyError(error)
  listeners.forEach((listener) => listener(message))
}

export function onError(listener: (message: string) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
