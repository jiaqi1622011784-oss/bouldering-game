import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useGame } from '../context/GameContext'
import { renderHold } from '../utils/holdProcessor'
import { useCanvas } from '../hooks/useCanvas'
import { loadImageToCanvas, drawPath, getCanvasRelativePoint } from '../utils/canvasHelpers'

interface CanvasEditorProps {
  onComplete: () => void
  onBack: () => void
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ onComplete, onBack }) => {
  const { state, dispatch } = useGame()
  const [showBrushSettings, setShowBrushSettings] = useState(false)
  const [gestureState, setGestureState] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isPanning: false,
    lastTouchDistance: 0,
    lastTouchCenter: { x: 0, y: 0 }
  })
  const [isDrawingMode, setIsDrawingMode] = useState(true)
  const isDrawingModeRef = useRef(true)

  const eraseMode = state.drawing.selectedTool === 'eraser'

  useEffect(() => {
    isDrawingModeRef.current = isDrawingMode
  }, [isDrawingMode])

  const { canvasRef, getContext, clearCanvas } = useCanvas({
    onResize: (canvas) => {
      // 背景图片重新渲染
      if (state.backgroundImage) {
        loadImageToCanvas(canvas, state.backgroundImage, { fit: 'contain' })
      }
    }
  })

  // 加载背景图片
  useEffect(() => {
    if (!canvasRef.current || !state.backgroundImage) return

    loadImageToCanvas(canvasRef.current, state.backgroundImage, { fit: 'contain' })
  }, [canvasRef, state.backgroundImage])

  // 绘制当前状态和路径
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return

    const draw = async () => {
      // 清空画布
      clearCanvas()

      // 重新加载背景图片（因为 clearCanvas 清空了）
      if (state.backgroundImage) {
        await loadImageToCanvas(canvas, state.backgroundImage, { fit: 'contain' })
      }

      // 绘制已生成的岩点
      state.holds.forEach(hold => {
        renderHold(ctx, hold, { scale: gestureState.scale })
      })

      // 绘制正在绘制的路径
      if (state.drawing.currentPath) {
        drawPath(ctx, state.drawing.currentPath, {
          strokeStyle: eraseMode ? '#EF4444' : '#22D3EE',
          lineWidth: state.drawing.brushSize * gestureState.scale,
          closed: false
        })
      }
    }

    draw().catch(console.error)
  }, [canvasRef, getContext, clearCanvas, state.backgroundImage, state.holds, state.drawing, eraseMode, gestureState.scale])

  // 处理指针事件
  const isPointerDown = useRef(false)

  const handlePointerDown = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isDrawingModeRef.current) return

    isPointerDown.current = true

    const point = getCanvasRelativePoint(canvasRef.current, event.nativeEvent, gestureState.scale)

    dispatch({ type: 'START_DRAWING' })
    dispatch({ type: 'UPDATE_DRAWING_PATH', payload: { x: point.x, y: point.y } })
  }, [canvasRef, dispatch, gestureState.scale])

  const handlePointerMove = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPointerDown.current || !canvasRef.current || !isDrawingModeRef.current) return

    event.preventDefault()

    const point = getCanvasRelativePoint(canvasRef.current, event.nativeEvent, gestureState.scale)
    dispatch({ type: 'UPDATE_DRAWING_PATH', payload: { x: point.x, y: point.y } })
  }, [canvasRef, gestureState.scale, dispatch])

  const handlePointerUp = useCallback(() => {
    if (!isPointerDown.current || !isDrawingModeRef.current) return

    isPointerDown.current = false
    dispatch({ type: 'END_DRAWING' })
  }, [dispatch])

  // 双指手势（缩放和平移）
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length === 2) {
      // 双指 -> 缩放模式
      setIsDrawingMode(false)
      setGestureState(prev => ({
        ...prev,
        isPanning: false,
        lastTouchDistance: getTouchDistance(event.touches),
        lastTouchCenter: getTouchCenter(event.touches)
      }))
    } else {
      setIsDrawingMode(true)
      // 单指开始绘制
      handlePointerDown(event)
    }
  }, [handlePointerDown])

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length === 2) {
      event.preventDefault()

      const currentDistance = getTouchDistance(event.touches)
      const currentCenter = getTouchCenter(event.touches)

      setGestureState(prev => {
        const scaleFactor = currentDistance / prev.lastTouchDistance
        const newScale = Math.max(0.5, Math.min(3, prev.scale * scaleFactor))

        return {
          ...prev,
          scale: newScale,
          lastTouchDistance: currentDistance,
          lastTouchCenter: currentCenter
        }
      })
    } else if (event.touches.length === 1) {
      handlePointerMove(event)
    }
  }, [handlePointerMove])

  const handleTouchEnd = useCallback(() => {
    handlePointerUp()
    setIsDrawingMode(true)
  }, [handlePointerUp])

  // 工具函数
  function getTouchDistance(touches: React.TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function getTouchCenter(touches: React.TouchList): { x: number; y: number } {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    }
  }

  // 撤销
  const handleUndo = useCallback(() => {
    if (state.holds.length === 0) return
    const newHolds = state.holds.slice(0, -1)
    dispatch({ type: 'LOAD_STATE', payload: { holds: newHolds } })
  }, [state.holds, dispatch])

  // 清空
  const handleClear = useCallback(() => {
    if (window.confirm('确定要清空所有遗迹石块吗？')) {
      dispatch({ type: 'CLEAR_HOLDS' })
    }
  }, [dispatch])

  // 完成编辑
  const handleComplete = useCallback(() => {
    if (state.holds.length === 0) {
      if (!window.confirm('尚未标记任何遗迹石块，是否继续？')) {
        return
      }
    }
    onComplete()
  }, [state.holds.length, onComplete])

  // 删除选中岩点
  const handleDeleteSelected = useCallback(() => {
    if (!state.selectedHoldId) return
    dispatch({ type: 'REMOVE_HOLD', payload: state.selectedHoldId })
    dispatch({ type: 'SELECT_HOLD', payload: null })
  }, [state.selectedHoldId, dispatch])

  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className="text-lg font-semibold flex items-center gap-2">
            <span>✏️</span>
            标记遗迹石块
          </h1>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {state.holds.length} 个石块
            </span>
            <button
              onClick={handleUndo}
              disabled={state.holds.length === 0}
              className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="撤销 (Ctrl+Z)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ touchAction: 'none' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Gesture Info */}
        {!isDrawingMode && (
          <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-2 rounded-lg text-sm">
            缩放中: {(gestureState.scale * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* Bottom Toolbar */}
      <div className="bg-gray-800 border-t border-gray-700">
        {/* Brush Settings */}
        {showBrushSettings && (
          <div className="border-b border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">画笔设置</h3>
              <button
                onClick={() => setShowBrushSettings(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Brush Size */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">大小: {state.drawing.brushSize}px</label>
              <input
                type="range"
                min="5"
                max="50"
                value={state.drawing.brushSize}
                onChange={(e) => dispatch({ type: 'SET_BRUSH_SIZE', payload: parseInt(e.target.value) })}
                className="w-full"
              />
              <div
                className="w-10 h-10 mx-auto border border-gray-600 rounded-full flex items-center justify-center"
                style={{
                  borderWidth: `${state.drawing.brushSize}px`,
                  borderStyle: 'solid',
                  borderColor: eraseMode ? '#EF4444' : '#22D3EE'
                }}
              />
            </div>

            {/* Tool Selection */}
            <div className="mt-4">
              <label className="text-sm text-gray-400">工具</label>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => dispatch({ type: 'SET_TOOL', payload: 'brush' })}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    state.drawing.selectedTool === 'brush'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  绘制
                </button>
                <button
                  onClick={() => dispatch({ type: 'SET_TOOL', payload: 'eraser' })}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    state.drawing.selectedTool === 'eraser'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  橡皮擦
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Main Actions */}
        <div className="p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowBrushSettings(!showBrushSettings)}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              画笔设置
            </button>
            <button
              onClick={handleClear}
              disabled={state.holds.length === 0}
              className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              清空
            </button>
            <button
              onClick={handleComplete}
              className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-lg font-medium transition-colors text-white"
            >
              完成标记
            </button>
          </div>
        </div>
      </div>
      {/* Delete Selected Modal */}
      {state.selectedHoldId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">删除石块</h3>
            <p className="text-gray-300 mb-6">确定要删除这个遗迹石块吗？</p>
            <div className="flex gap-2">
              <button
                onClick={() => dispatch({ type: 'SELECT_HOLD', payload: null })}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteSelected}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
