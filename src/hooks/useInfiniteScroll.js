import { useEffect, useRef, useCallback } from 'react'

export default function useInfiniteScroll(loadMore, hasMore, loading) {
  const sentinelRef = useRef(null)
  const stableLoadMore = useCallback(loadMore, [loadMore])

  useEffect(() => {
    if (!hasMore || loading) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) stableLoadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [stableLoadMore, hasMore, loading])

  return sentinelRef
}
