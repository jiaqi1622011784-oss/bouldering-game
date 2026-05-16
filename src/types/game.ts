import type { Point } from './hold'

export type Stage = 'camera' | 'drawing' | 'preview' | 'game'

export interface ExportHold {
  id: string
  polygon: Point[]
  center: Point
  color: string
}

export interface ExportData {
  version: string
  timestamp: number
  backgroundImage: string
  holds: ExportHold[]
}
