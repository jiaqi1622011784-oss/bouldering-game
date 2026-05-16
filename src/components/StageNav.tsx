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
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 z-50">
      <div className="max-w-md mx-auto flex justify-between items-center">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          上一步
        </button>

        <button
          onClick={onNext}
          disabled={!canNext}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center gap-2"
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
    { key: 'camera', label: '拍照/上传', icon: '📷' },
    { key: 'drawing', label: '描摹岩点', icon: '✏️' },
    { key: 'preview', label: '预览保存', icon: '👁️' },
    { key: 'game', label: '攀爬游戏', icon: '🧗' }
  ] as const

  const activeIndex = stages.findIndex(stage => stage.key === state.stage)

  const canGoToStage = (key: (typeof stages)[number]['key']) => {
    if (key === 'camera') return true
    if (key === 'drawing') return !!state.backgroundImage
    if (key === 'preview') return !!state.backgroundImage
    if (key === 'game') return state.holds.length > 1
    return false
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 z-50">
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
                      ? 'bg-cyan-600 text-white'
                      : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {isCompleted ? '✓' : stage.icon}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive
                      ? 'text-cyan-400'
                      : isCompleted
                      ? 'text-green-400'
                      : 'text-gray-500'
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
