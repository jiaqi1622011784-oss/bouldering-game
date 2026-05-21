import React, { useEffect, useState } from 'react'
import { GameProvider } from './context/GameContext'
import { useGame } from './context/GameContext'
import { CameraCapture } from './components/CameraCapture'
import { CanvasEditor } from './components/CanvasEditor'
import { Preview } from './components/Preview'
import { ClimbGame } from './components/ClimbGame'
import { StageIndicator } from './components/StageNav'

const AppContent: React.FC = () => {
  const [mounted, setMounted] = useState(false)
  const { state, dispatch } = useGame()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleImageCaptured = () => {
    dispatch({ type: 'SET_STAGE', payload: 'drawing' })
  }

  const handleDrawingComplete = () => {
    dispatch({ type: 'SET_STAGE', payload: 'preview' })
  }

  const handleEditRoute = () => {
    dispatch({ type: 'SET_STAGE', payload: 'drawing' })
  }

  const handleStartGame = () => {
    dispatch({ type: 'SET_STAGE', payload: 'game' })
  }

  const handleMiniGameComplete = (result: { success: boolean; collectedFragments: number; progress: number }) => {
    console.info('Archaeology climb mini-game complete:', result)
  }

  const handleBackToCamera = () => {
    // 回到采集页面（保留当前图片与遗迹石块，方便用户切回；如需清空请用“创建新岩壁”）
    dispatch({ type: 'SET_STAGE', payload: 'camera' })
  }

  const handleRestart = () => {
    if (window.confirm('确定要创建新的遗迹岩壁吗？当前勘探进度将会丢失。')) {
      dispatch({ type: 'RESET' })
    }
  }

  if (!mounted) {
    return <div className="min-h-screen museum-shell" />
  }

  return (
    <div className="h-screen museum-shell">
      <div className="flex flex-col h-full pb-4">
        <StageIndicator />

        <div className="flex-1 relative">
          {state.stage === 'camera' && (
            <CameraCapture
              onCapture={handleImageCaptured}
              onCancel={handleRestart}
            />
          )}

          {state.stage === 'drawing' && (
            <CanvasEditor
              onComplete={handleDrawingComplete}
              onBack={handleBackToCamera}
            />
          )}

          {state.stage === 'preview' && (
            <Preview
              onBack={handleEditRoute}
              onRestart={handleRestart}
              onStartGame={handleStartGame}
            />
          )}

          {state.stage === 'game' && (
            <ClimbGame
              onBack={() => dispatch({ type: 'SET_STAGE', payload: 'preview' })}
              onRestart={handleRestart}
              onComplete={handleMiniGameComplete}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  )
}

export default App
