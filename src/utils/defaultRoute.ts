import type { Hold, Point } from '../types/hold'

const STONE_PALETTE = ['#8B7355', '#A68A64', '#6F6254', '#B18B52', '#7C6B58']

function makeStoneHold(id: string, center: Point, radius: number, colorIndex: number): Hold {
  const polygon: Point[] = [
    { x: center.x - radius * 1.2, y: center.y - radius * 0.2 },
    { x: center.x - radius * 0.45, y: center.y - radius * 0.9 },
    { x: center.x + radius * 0.65, y: center.y - radius * 0.75 },
    { x: center.x + radius * 1.15, y: center.y + radius * 0.1 },
    { x: center.x + radius * 0.35, y: center.y + radius * 0.85 },
    { x: center.x - radius * 0.8, y: center.y + radius * 0.65 },
  ]

  const minX = Math.min(...polygon.map(p => p.x))
  const minY = Math.min(...polygon.map(p => p.y))
  const maxX = Math.max(...polygon.map(p => p.x))
  const maxY = Math.max(...polygon.map(p => p.y))
  const color = STONE_PALETTE[colorIndex % STONE_PALETTE.length]

  return {
    id,
    polygon,
    center,
    color,
    strokeColor: '#3F3327',
    glowColor: 'rgba(202, 138, 4, 0.35)',
    boundingBox: { minX, minY, maxX, maxY },
    createdAt: 0,
  }
}

export const defaultArchaeologyHolds: Hold[] = [
  makeStoneHold('relic_hold_01', { x: 180, y: 700 }, 24, 0),
  makeStoneHold('relic_hold_02', { x: 135, y: 615 }, 22, 1),
  makeStoneHold('relic_hold_03', { x: 235, y: 585 }, 23, 2),
  makeStoneHold('relic_hold_04', { x: 285, y: 500 }, 22, 3),
  makeStoneHold('relic_hold_05', { x: 190, y: 445 }, 24, 4),
  makeStoneHold('relic_hold_06', { x: 115, y: 360 }, 21, 1),
  makeStoneHold('relic_hold_07', { x: 230, y: 320 }, 23, 3),
  makeStoneHold('relic_hold_08', { x: 310, y: 245 }, 22, 0),
  makeStoneHold('relic_hold_09', { x: 210, y: 170 }, 25, 4),
  makeStoneHold('relic_hold_10', { x: 285, y: 95 }, 24, 2),
]

export interface ArchaeologyLevel {
  id: string
  title: string
  subtitle: string
  holds: Hold[]
}

export const archaeologyLevels: ArchaeologyLevel[] = [
  {
    id: 'outer-wall',
    title: '第一关：外墙裂隙',
    subtitle: '沿着风化砖缝向上，找到古墓外门。',
    holds: defaultArchaeologyHolds,
  },
  {
    id: 'broken-terrace',
    title: '第二关：断阶岩台',
    subtitle: '路线横移更明显，注意不要过度伸展。',
    holds: [
      makeStoneHold('terrace_hold_01', { x: 160, y: 710 }, 24, 1),
      makeStoneHold('terrace_hold_02', { x: 235, y: 650 }, 22, 3),
      makeStoneHold('terrace_hold_03', { x: 150, y: 590 }, 23, 0),
      makeStoneHold('terrace_hold_04', { x: 260, y: 520 }, 21, 2),
      makeStoneHold('terrace_hold_05', { x: 330, y: 455 }, 23, 4),
      makeStoneHold('terrace_hold_06', { x: 225, y: 390 }, 22, 1),
      makeStoneHold('terrace_hold_07', { x: 135, y: 320 }, 22, 3),
      makeStoneHold('terrace_hold_08', { x: 245, y: 255 }, 24, 0),
      makeStoneHold('terrace_hold_09', { x: 335, y: 180 }, 21, 4),
      makeStoneHold('terrace_hold_10', { x: 250, y: 105 }, 25, 2),
    ],
  },
  {
    id: 'inner-gate',
    title: '第三关：内门石刻',
    subtitle: '石块间距更紧张，需要按顺序稳步上攀。',
    holds: [
      makeStoneHold('gate_hold_01', { x: 205, y: 720 }, 24, 2),
      makeStoneHold('gate_hold_02', { x: 130, y: 660 }, 22, 0),
      makeStoneHold('gate_hold_03', { x: 275, y: 630 }, 21, 3),
      makeStoneHold('gate_hold_04', { x: 220, y: 550 }, 23, 1),
      makeStoneHold('gate_hold_05', { x: 110, y: 485 }, 21, 4),
      makeStoneHold('gate_hold_06', { x: 215, y: 420 }, 22, 0),
      makeStoneHold('gate_hold_07', { x: 315, y: 360 }, 21, 2),
      makeStoneHold('gate_hold_08', { x: 245, y: 285 }, 23, 3),
      makeStoneHold('gate_hold_09', { x: 150, y: 215 }, 22, 1),
      makeStoneHold('gate_hold_10', { x: 260, y: 150 }, 21, 4),
      makeStoneHold('gate_hold_11', { x: 200, y: 80 }, 24, 2),
    ],
  },
]
