import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { useCanvas } from '../hooks/useCanvas'
import { renderHold } from '../utils/holdProcessor'
import { loadImageToCanvas } from '../utils/canvasHelpers'
import { ExportData } from '../types/game'
import type { Hold } from '../types/hold'
import { archaeologyLevels } from '../utils/defaultRoute'

interface PreviewProps {
  onBack: () => void
  onRestart: () => void
  onStartGame: () => void
}

function drawPreviewWall(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#EEE3D2')
  gradient.addColorStop(0.55, '#D9C2A3')
  gradient.addColorStop(1, '#B99362')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.strokeStyle = 'rgba(73, 48, 31, 0.28)'
  ctx.lineWidth = 2
  for (let y = 52; y < height; y += 72) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y + Math.sin(y) * 8)
    ctx.stroke()
  }
  ctx.restore()
}

function fitHoldsToPreview(holds: Hold[], width: number, height: number): Hold[] {
  if (holds.length === 0) return []

  const minX = Math.min(...holds.flatMap(hold => hold.polygon.map(point => point.x)))
  const minY = Math.min(...holds.flatMap(hold => hold.polygon.map(point => point.y)))
  const maxX = Math.max(...holds.flatMap(hold => hold.polygon.map(point => point.x)))
  const maxY = Math.max(...holds.flatMap(hold => hold.polygon.map(point => point.y)))
  const routeWidth = Math.max(1, maxX - minX)
  const routeHeight = Math.max(1, maxY - minY)
  const margin = 42
  const scale = Math.min((width - margin * 2) / routeWidth, (height - margin * 2) / routeHeight)
  const offsetX = (width - routeWidth * scale) / 2 - minX * scale
  const offsetY = (height - routeHeight * scale) / 2 - minY * scale

  return holds.map(hold => {
    const polygon = hold.polygon.map(point => ({
      x: point.x * scale + offsetX,
      y: point.y * scale + offsetY,
    }))
    const center = {
      x: hold.center.x * scale + offsetX,
      y: hold.center.y * scale + offsetY,
    }
    return {
      ...hold,
      polygon,
      center,
      boundingBox: {
        minX: Math.min(...polygon.map(point => point.x)),
        minY: Math.min(...polygon.map(point => point.y)),
        maxX: Math.max(...polygon.map(point => point.x)),
        maxY: Math.max(...polygon.map(point => point.y)),
      },
    }
  })
}

export const Preview: React.FC<PreviewProps> = ({ onBack, onRestart, onStartGame }) => {
  const { state, dispatch } = useGame()
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const currentLevel = archaeologyLevels[state.currentLevelIndex] ?? archaeologyLevels[0]

  const { canvasRef } = useCanvas({
    onResize: (canvas) => {
      if (state.backgroundImage) {
        loadImageToCanvas(canvas, state.backgroundImage, { fit: 'contain' })
      }
    }
  })

  // 在 canvas 中渲染结果
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()

    // 清空并绘制背景
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (state.backgroundImage) {
      loadImageToCanvas(canvas, state.backgroundImage, { fit: 'contain' })
    } else {
      drawPreviewWall(ctx, rect.width, rect.height)
    }

    // 使用 requestAnimationFrame 创建动画效果
    const animationDuration = 500 // ms
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / animationDuration, 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3) // easeOutCubic

      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (state.backgroundImage) {
        loadImageToCanvas(canvas, state.backgroundImage, { fit: 'contain' })
      } else {
        drawPreviewWall(ctx, rect.width, rect.height)
      }
      const previewHolds = state.backgroundImage
        ? state.holds
        : fitHoldsToPreview(state.holds, rect.width, rect.height)

      // 绘制岩点（带入场动画）
      previewHolds.forEach((hold, index) => {
        const holdProgress = Math.max(0, (easeProgress * previewHolds.length - index) / 1)
        if (holdProgress > 0) {
          ctx.save()
          ctx.globalAlpha = holdProgress

          // 添加绘制动画
          if (holdProgress < 0.3) {
            const scale = 0.5 + holdProgress * 1.67
            ctx.translate(hold.center.x, hold.center.y)
            ctx.scale(scale, scale)
            ctx.translate(-hold.center.x, -hold.center.y)
          }

          renderHold(ctx, hold)
          ctx.restore()
        }
      })

      // 绘制编号
      if (progress > 0.5) {
        const textProgress = (progress - 0.5) * 2
        previewHolds.forEach((hold, index) => {
          ctx.save()
          ctx.globalAlpha = textProgress
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 16px system-ui, -apple-system, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 3
          ctx.strokeText(String(index + 1), hold.center.x, hold.center.y)
          ctx.fillText(String(index + 1), hold.center.x, hold.center.y)
          ctx.restore()
        })
      }

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    // 延迟开始动画，让用户看到页面切换
    setTimeout(() => {
      requestAnimationFrame(animate)
    }, 200)
  }, [canvasRef, state.backgroundImage, state.holds])

  // 保存到 localStorage
  const handleSave = () => {
    setIsSaving(true)

    try {
      const data: ExportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        backgroundImage: state.backgroundImage || '',
        holds: state.holds.map(hold => ({
          id: hold.id,
          polygon: hold.polygon,
          center: hold.center,
          color: hold.color
        }))
      }

      // 获取已有的保存数据
      const saved = JSON.parse(localStorage.getItem('boulderingRoutes') || '[]')
      saved.push(data)

      // 保持最多 10 条记录
      if (saved.length > 10) {
        saved.splice(0, saved.length - 10)
      }

      localStorage.setItem('boulderingRoutes', JSON.stringify(saved))

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save:', error)
      alert('保存失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }

  // 导出 JSON 文件
  const handleExport = () => {
    const data: ExportData = {
      version: '1.0.0',
      timestamp: Date.now(),
      backgroundImage: state.backgroundImage || '',
      holds: state.holds.map(hold => ({
        id: hold.id,
        polygon: hold.polygon,
        center: hold.center,
        color: hold.color
      }))
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    const date = new Date().toISOString().split('T')[0]
    a.href = url
    a.download = `bouldering-route-${date}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 重新编辑
  const handleEdit = () => {
    onBack()
  }

  const totalHolds = state.holds.length

  return (
    <div className="fixed inset-0 museum-shell flex flex-col">
      {/* Header */}
      <div className="museum-header p-4 border-b">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 text-[#6b4a2f] hover:text-[#3a2a1e] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className="text-lg font-semibold flex items-center gap-2">
            岩壁勘探
          </h1>

          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative bg-[#efe5d3]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Info Panel */}
      <div className="museum-panel p-4 border-t">
        <div className="text-center mb-4">
          <h2 className="text-xl font-semibold mb-2">{currentLevel.title}</h2>
          <p className="text-sm text-[#715f4c] mb-2">{currentLevel.subtitle}</p>
          <div className="flex justify-center gap-4 text-sm text-[#715f4c]">
            <span>遗迹石块: {totalHolds}</span>
            {totalHolds > 0 && <span>石刻线索: {Math.max(0, totalHolds - 1)}</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {archaeologyLevels.map((level, index) => (
            <button
              key={level.id}
              type="button"
              onClick={() => dispatch({ type: 'SET_LEVEL', payload: index })}
              className={`py-2 px-2 text-sm rounded-lg border transition-colors ${
                index === state.currentLevelIndex
                  ? 'bg-[#b27a39] text-[#fff8ec] border-[#6f4f34]'
                  : 'bg-[#efe4d2] text-[#3a2a1e] border-[#6f4f34]/35 hover:bg-[#e4d4bf]'
              }`}
            >
              第 {index + 1} 关
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={handleEdit}
            className="py-3 museum-button flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            调整石块
          </button>

          <button
            onClick={handleExport}
            className="py-3 museum-button flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            导出线索
          </button>
        </div>

        {/* Start Game */}
        <button
          onClick={onStartGame}
          disabled={totalHolds < 2}
          className="w-full mb-3 py-4 museum-button-primary disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          title={totalHolds < 2 ? '请先在描摹页面添加至少两个遗迹石块（营地/入口）' : undefined}
        >
          开始勘探
        </button>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full py-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            saveSuccess
              ? 'bg-[#8a9a58] text-[#fff8ec] border border-[#59663a]'
              : 'museum-button-primary disabled:opacity-60'
          }`}
        >
          {isSaving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              保存中...
            </>
          ) : saveSuccess ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              已保存
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
              </svg>
              保存岩壁
            </>
          )}
        </button>

        {/* New Route Button */}
        <button
          onClick={onRestart}
          className="w-full mt-3 py-3 museum-button flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          创建新岩壁
        </button>
      </div>

      {/* Quick Tip */}
      {state.holds.length === 0 && (
        <div className="bg-yellow-900/20 border-t border-yellow-600/30 p-3">
          <p className="text-yellow-200 text-sm text-center">
            提示：你可以回到编辑页面添加遗迹石块，或者重新开始
          </p>
        </div>
      )}
    </div>
  )
}
