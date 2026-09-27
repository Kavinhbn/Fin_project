// ─── Stale-while-revalidate cache (in memory only; no localStorage) ───
import { useCallback, useEffect, useRef, useState } from 'react'

const store = new Map<string, unknown>()

// Mounted useResource hooks register here so invalidate() can make them refetch.
interface Subscriber { key: string; refetch: () => void }
const subscribers = new Set<Subscriber>()

export interface Resource<T> {
  data: T | undefined
  error: Error | undefined
  loading: boolean
  reload: () => void
  setData: (next: T) => void
}

export function invalidate(prefix: string): void {
  for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key)
  for (const s of [...subscribers]) if (s.key.startsWith(prefix)) s.refetch()
}

export function useResource<T>(key: string, fetcher: () => Promise<T>): Resource<T> {
  const [data, setDataState] = useState<T | undefined>(() => store.get(key) as T | undefined)
  const [error, setError] = useState<Error | undefined>()
  const [loading, setLoading] = useState<boolean>(!store.has(key))
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const runId = useRef(0)

  // Each run supersedes the previous one; stale responses are ignored.
  const run = useCallback(() => {
    const id = ++runId.current
    setError(undefined)
    fetcherRef.current()
      .then((next) => {
        if (id !== runId.current) return
        store.set(key, next)
        setDataState(next)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (id !== runId.current) return
        setError(e instanceof Error ? e : new Error(String(e)))
        setLoading(false)
      })
  }, [key])

  useEffect(() => {
    setDataState(store.get(key) as T | undefined)
    setLoading(!store.has(key))
    run()
    const sub: Subscriber = { key, refetch: run }
    subscribers.add(sub)
    return () => { subscribers.delete(sub); runId.current++ }
  }, [key, run])

  const setData = useCallback((next: T) => {
    runId.current++ // a newer local value beats any in-flight fetch
    store.set(key, next)
    setDataState(next)
    setError(undefined)
    setLoading(false)
  }, [key])

  const reload = useCallback(() => { setLoading(true); run() }, [run])

  return { data, error, loading, reload, setData }
}
