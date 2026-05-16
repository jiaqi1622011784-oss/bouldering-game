import type { Point } from '../types/hold'
import { distance, isPointInPolygon } from './blobDetection'

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scale(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s }
}

export function length(v: Point): number {
  return Math.sqrt(v.x * v.x + v.y * v.y)
}

export function normalize(v: Point): Point {
  const len = length(v)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

export function uniquePoints(points: Point[], epsilon = 0.001): Point[] {
  const out: Point[] = []
  for (const p of points) {
    if (!out.some(q => Math.abs(q.x - p.x) < epsilon && Math.abs(q.y - p.y) < epsilon)) {
      out.push(p)
    }
  }
  return out
}

/**
 * 计算凸包（Monotonic Chain）。返回按逆时针排列的多边形顶点。
 */
export function convexHull(points: Point[]): Point[] {
  const pts = [...points]
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))

  if (pts.length <= 1) return pts

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

  const lower: Point[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  const upper: Point[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

export function isCOMStable(com: Point, supportPoints: Point[]): { stable: boolean; hull: Point[] } {
  const unique = uniquePoints(supportPoints)
  if (unique.length < 3) {
    return { stable: false, hull: unique }
  }
  const hull = convexHull(unique)
  if (hull.length < 3) {
    return { stable: false, hull }
  }
  return { stable: isPointInPolygon(com, hull), hull }
}

export function canReach(anchor: Point, target: Point, maxDistance: number): boolean {
  return distance(anchor, target) <= maxDistance
}

export interface SimplePose {
  leftHand: Point
  rightHand: Point
  leftFoot: Point
  rightFoot: Point
  shoulder: Point
  hip: Point
  torso: Point
  head: Point
  com: Point
}

/**
 * 一个足够“Klifur 风格”的简化姿态模型：
 * - 肩 = 双手中点
 * - 髋 = 双脚中点
 * - 躯干中心 = 肩髋中点
 * - 头 = 沿着(髋->肩)方向在肩上方延伸
 * - COM = 头/躯干/四肢的加权平均
 */
export function computeSimplePose(limbs: Pick<SimplePose, 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot'>): SimplePose {
  const shoulder = midpoint(limbs.leftHand, limbs.rightHand)
  const hip = midpoint(limbs.leftFoot, limbs.rightFoot)
  const torso = midpoint(shoulder, hip)

  const upDir = normalize(sub(shoulder, hip))
  const head = add(shoulder, scale(upDir, 35))

  // 权重：躯干最重，头其次，四肢略轻
  const wTorso = 0.55
  const wHead = 0.1
  const wLimb = (1 - wTorso - wHead) / 4 // 0.0875

  const com = add(
    add(
      add(scale(torso, wTorso), scale(head, wHead)),
      add(scale(limbs.leftHand, wLimb), scale(limbs.rightHand, wLimb))
    ),
    add(scale(limbs.leftFoot, wLimb), scale(limbs.rightFoot, wLimb))
  )

  return { ...limbs, shoulder, hip, torso, head, com }
}

