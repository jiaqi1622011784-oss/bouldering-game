import { useRef, useEffect, useCallback } from 'react'

export type AnimationFrameCallback = (timestamp: number) => void
export type RAFState = {
  isRunning: boolean
  frameId: number | null
  startTime: number | null
  elapsed: number
}

export interface UseAnimationFrameOptions {
  autoStart?: boolean
  dependencies?: Array<any>
}

export function useAnimationFrame(
  callback: AnimationFrameCallback,
  options: UseAnimationFrameOptions = {}
) {
  const { autoStart = true, dependencies = [] } = options

  const rafState = useRef<RAFState>({
    isRunning: false,
    frameId: null,
    startTime: null,
    elapsed: 0,
  })

  const start = useCallback(() => {
    if (rafState.current.isRunning) return

    rafState.current.isRunning = true
    rafState.current.startTime = performance.now()
    rafState.current.elapsed = 0

    const animate = (timestamp: number) => {
      if (!rafState.current.isRunning) return

      if (rafState.current.startTime === null) {
        rafState.current.startTime = timestamp
      }

      rafState.current.elapsed = timestamp - rafState.current.startTime
      callback(timestamp)

      rafState.current.frameId = requestAnimationFrame(animate)
    }

    rafState.current.frameId = requestAnimationFrame(animate)
  }, [callback])

  const stop = useCallback(() => {
    if (!rafState.current.isRunning) return

    rafState.current.isRunning = false

    if (rafState.current.frameId !== null) {
      cancelAnimationFrame(rafState.current.frameId)
      rafState.current.frameId = null
    }
  }, [])

  const toggle = useCallback(() => {
    if (rafState.current.isRunning) {
      stop()
    } else {
      start()
    }
  }, [start, stop])

  const reset = useCallback(() => {
    stop()
    rafState.current.elapsed = 0
    rafState.current.startTime = null
  }, [stop])

  useEffect(() => {
    if (autoStart) {
      start()
    }

    return () => {
      if (rafState.current.frameId !== null) {
        cancelAnimationFrame(rafState.current.frameId)
      }
      rafState.current.isRunning = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, ...dependencies])

  const getState = useCallback(() => ({
    isRunning: rafState.current.isRunning,
    elapsed: rafState.current.elapsed,
    frameId: rafState.current.frameId,
  }), [])

  return {
    start,
    stop,
    toggle,
    reset,
    getState,
  } as const
}

// 更轻量级的版本，不包含控制函数
export function useSimpleAnimationFrame(
  callback: AnimationFrameCallback,
  dependencies: Array<any> = []
) {
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const animate = (timestamp: number) => {
      callback(timestamp)
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback, ...dependencies])
}
