import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { GameState, Hold, Point } from '../types/hold'
import { HoldGenerationOptions, generateHold } from '../utils/holdProcessor'
import { archaeologyLevels } from '../utils/defaultRoute'

// 初始状态
const initialState: GameState = {
  stage: 'preview',
  backgroundImage: null,
  holds: archaeologyLevels[0].holds,
  currentLevelIndex: 0,
  drawing: {
    isDrawing: false,
    currentPath: null,
    rawPath: null,
    brushSize: 20,
    selectedTool: 'brush'
  },
  selectedHoldId: null
}

// Action 类型
type Action =
  | { type: 'SET_STAGE'; payload: 'camera' | 'drawing' | 'preview' | 'game' }
  | { type: 'SET_BACKGROUND_IMAGE'; payload: string | null }
  | { type: 'START_DRAWING' }
  | { type: 'UPDATE_DRAWING_PATH'; payload: Point }
  | { type: 'END_DRAWING'; payload?: HoldGenerationOptions }
  | { type: 'ADD_HOLD'; payload: Hold }
  | { type: 'REMOVE_HOLD'; payload: string }
  | { type: 'SELECT_HOLD'; payload: string | null }
  | { type: 'SET_BRUSH_SIZE'; payload: number }
  | { type: 'SET_TOOL'; payload: 'brush' | 'eraser' }
  | { type: 'CLEAR_HOLDS' }
  | { type: 'LOAD_STATE'; payload: Partial<GameState> }
  | { type: 'SET_LEVEL'; payload: number }
  | { type: 'NEXT_LEVEL' }
  | { type: 'RESET' }

// Reducer
function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'RESET':
      return initialState

    case 'SET_STAGE':
      return { ...state, stage: action.payload }

    case 'SET_BACKGROUND_IMAGE':
      return {
        ...state,
        backgroundImage: action.payload,
        holds: action.payload === null ? archaeologyLevels[state.currentLevelIndex]?.holds ?? [] : state.holds
      }

    case 'SET_LEVEL': {
      const levelIndex = Math.max(0, Math.min(archaeologyLevels.length - 1, action.payload))
      return {
        ...state,
        currentLevelIndex: levelIndex,
        backgroundImage: null,
        holds: archaeologyLevels[levelIndex].holds,
        selectedHoldId: null,
        stage: 'preview',
      }
    }

    case 'NEXT_LEVEL': {
      const levelIndex = Math.min(archaeologyLevels.length - 1, state.currentLevelIndex + 1)
      return {
        ...state,
        currentLevelIndex: levelIndex,
        backgroundImage: null,
        holds: archaeologyLevels[levelIndex].holds,
        selectedHoldId: null,
        stage: 'preview',
      }
    }

    case 'START_DRAWING':
      return {
        ...state,
        drawing: {
          ...state.drawing,
          isDrawing: true,
          currentPath: null,
          rawPath: { points: [], closed: false, timestamp: Date.now() }
        }
      }

    case 'UPDATE_DRAWING_PATH':
      if (!state.drawing.isDrawing) return state

      const rawPath = state.drawing.rawPath
      if (!rawPath) return state

      // 防止重复添加过于接近的点
      const lastPoint = rawPath.points[rawPath.points.length - 1]
      if (lastPoint && distance(lastPoint, action.payload) < 3) {
        return state
      }

      rawPath.points.push(action.payload)

      return {
        ...state,
        drawing: {
          ...state.drawing,
          rawPath,
          currentPath: rawPath.points
        }
      }

    case 'END_DRAWING':
      if (!state.drawing.isDrawing || !state.drawing.currentPath) return state

      // 检测是否应该闭合路径
      const shouldClose = shouldAutoClosePath(state.drawing.currentPath)
      if (shouldClose && state.drawing.currentPath.length > 10) {
        // 添加第一个点来闭合路径
        state.drawing.currentPath.push(state.drawing.currentPath[0])
      }

      // 只有在路径长度足够时才生成岩点
      const shouldGenerate = state.drawing.currentPath.length > 5
      let newHold: Hold | null = null

      if (shouldGenerate) {
        try {
          newHold = generateHold(state.drawing.currentPath, action.payload)
        } catch (error) {
          console.error('Failed to generate hold:', error)
        }
      }

      return {
        ...state,
        holds: newHold ? [...state.holds, newHold] : state.holds,
        drawing: {
          ...state.drawing,
          isDrawing: false,
          currentPath: null,
          rawPath: null
        }
      }

    case 'ADD_HOLD':
      return { ...state, holds: [...state.holds, action.payload] }

    case 'REMOVE_HOLD':
      return {
        ...state,
        holds: state.holds.filter(hold => hold.id !== action.payload)
      }

    case 'SELECT_HOLD':
      return { ...state, selectedHoldId: action.payload }

    case 'SET_BRUSH_SIZE':
      return {
        ...state,
        drawing: { ...state.drawing, brushSize: action.payload }
      }

    case 'SET_TOOL':
      return {
        ...state,
        drawing: { ...state.drawing, selectedTool: action.payload }
      }

    case 'CLEAR_HOLDS':
      return { ...state, holds: [], selectedHoldId: null }

    case 'LOAD_STATE':
      return { ...state, ...action.payload }

    default:
      return state
  }
}

// 计算距离
function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy)
}

// 检测是否应该闭合路径
function shouldAutoClosePath(points: Point[], threshold: number = 25): boolean {
  if (points.length < 10) return false

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  return distance(firstPoint, lastPoint) < threshold
}

// Context
export const GameContext = createContext<{
  state: GameState
  dispatch: React.Dispatch<Action>
} | null>(null)

// Provider
export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}

// Hook
export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
