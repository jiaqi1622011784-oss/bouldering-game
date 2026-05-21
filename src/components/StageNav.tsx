import React from 'react'
import { useGame } from '../context/GameContext'

interface StageNavProps {
  onNext: () => void
  onPrev: () => void
  canNext: boolean
  canPrev: boolean
}

export const StageNav: React.FC<StageNavProps> = ({
  onNext,
  onPrev,
  canNext,
  canPrev
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 museum-header border-t p-4 z-50">
      <div className="max-w-md mx-auto flex justify-between items-center">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className="px-6 py-3 museum-button disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          上一步
        </button>

        <button
          onClick={onNext}
          disabled={!canNext}
          className="px-6 py-3 museum-button-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          下一步
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export const StageIndicator: React.FC = () => {
  const { state, dispatch } = useGame()
  const stages = [
    { key: 'camera', label: '采集岩壁', icon: '📷' },
    { key: 'drawing', label: '标记石块', icon: '✏️' },
    { key: 'preview', label: '岩壁勘探', icon: '◈' },
    { key: 'game', label: '遗迹攀登', icon: '▲' }
  ] as const

  const activeIndex = stages.findIndex(stage => stage.key === state.stage)

  const canGoToStage = (key: (typeof stages)[number]['key']) => {
    if (key === 'camera') return true
    if (key === 'drawing') return !!state.backgroundImage || state.holds.length > 0
    if (key === 'preview') return !!state.backgroundImage || state.holds.length > 0
    if (key === 'game') return state.holds.length > 1
    return false
  }

  return (
    <div className="fixed top-0 left-0 right-0 museum-header border-b z-50">
      <div className="max-w-md mx-auto p-4">
        <div className="flex justify-between items-center">
          {stages.map((stage, index) => {
            const isActive = index === activeIndex
            const isCompleted = index < activeIndex
            const isClickable = index <= activeIndex && canGoToStage(stage.key)

            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => {
                  if (!isClickable) return
                  dispatch({ type: 'SET_STAGE', payload: stage.key })
                }}
                disabled={!isClickable}
                className="flex flex-col items-center flex-1 disabled:cursor-not-allowed"
                title={!canGoToStage(stage.key) ? '请先上传/拍照后再进入下一步' : undefined}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-2 ${
                    isActive
                      ? 'bg-[#b27a39] text-[#fff8ec] border border-[#5c422b]'
                      : isCompleted
                      ? 'bg-[#8a9a58] text-[#fff8ec] border border-[#59663a]'
                      : 'bg-[#e7dac8] text-[#6d5b48] border border-[#6f4f34]/25'
                  }`}
                >
                  {isCompleted ? '✓' : stage.icon}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive
                      ? 'text-[#7a4c1f]'
                      : isCompleted
                      ? 'text-[#59663a]'
                      : 'text-[#7b6b59]'
                  }`}
                >
                  {stage.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
