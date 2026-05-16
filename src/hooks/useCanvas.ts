import { useRef, useEffect, useCallback } from 'react'
import { setupCanvasForDPR, clearCanvas as clearCanvasUtil } from '../utils/canvasHelpers'

export interface UseCanvasOptions {
  autoSetupDPR?: boolean
  onResize?: (canvas: HTMLCanvasElement) => void
}

export function useCanvas(options: UseCanvasOptions = {}) {
  const { autoSetupDPR = true, onResize } = options
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  // 获取 canvas 上下文
  const getContext = useCallback(() => {
    if (!canvasRef.current) return null
    return canvasRef.current.getContext('2d')
  }, [])

  // 清空画布
  const clearCanvas = useCallback(() => {
    if (!canvasRef.current) return
    clearCanvasUtil(canvasRef.current)
  }, [])

  // 设置 canvas 尺寸
  const resizeCanvas = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    if (autoSetupDPR) {
      const dpr = setupCanvasForDPR(canvas)
      // 重置变换矩阵
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    } else {
      // 只设置逻辑尺寸
      canvas.width = Math.floor(rect.width)
      canvas.height = Math.floor(rect.height)
    }

    onResize?.(canvas)
  }, [autoSetupDPR, onResize])

  // 使用 RAF 绘制
  const requestDraw = useCallback((draw: (timestamp: number) => void) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    const animate = (timestamp: number) => {
      draw(timestamp)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [])

  // 停止 RAF
  const stopDraw = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  // 处理 resize
  useEffect(() => {
    const handleResize = () => {
      resizeCanvas()
    }

    resizeCanvas()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      stopDraw()
    }
  }, [resizeCanvas, stopDraw])

  return {
    canvasRef,
    getContext,
    clearCanvas,
    resizeCanvas,
    requestDraw,
    stopDraw,
  }
}
