export interface Point {
  x: number
  y: number
}

export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Hold {
  id: string
  polygon: Point[]
  center: Point
  color: string
  strokeColor: string
  glowColor: string
  boundingBox: BoundingBox
  createdAt: number
}

export interface RawPath {
  points: Point[]
  closed: boolean
  timestamp: number
}

export interface DrawingState {
  isDrawing: boolean
  currentPath: Point[] | null
  rawPath: RawPath | null
  brushSize: number
  selectedTool: 'brush' | 'eraser'
}

export interface GameState {
  stage: 'camera' | 'drawing' | 'preview' | 'game'
  backgroundImage: string | null
  holds: Hold[]
  currentLevelIndex: number
  drawing: DrawingState
  selectedHoldId: string | null
}
