import { useEffect, useState } from 'react'
import { onError } from '../lib/errors'

export function ErrorToast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const listener = (m: string) => {
      setMessage(m)
      clearTimeout(timer)
      timer = setTimeout(() => setMessage(null), 5000)
    }
    const unsubscribe = onError(listener)
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  if (!message) return null
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        className="w-full max-w-md rounded-xl bg-rose-600 px-4 py-3 text-left font-medium text-white shadow-lg"
        onClick={() => setMessage(null)}
      >
        {message}
      </button>
    </div>
  )
}
