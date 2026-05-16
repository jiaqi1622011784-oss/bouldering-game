import { Point, BoundingBox } from '../types/hold'

/**
 * 计算两点之间的欧氏距离
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 计算多边形的面积（带符号）
 * 正值为顺时针，负值为逆时针
 */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0

  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return area / 2
}

/**
 * 计算多边形的中心点（重心）
 */
export function calculateCenter(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return { ...points[0] }

  const center = { x: 0, y: 0 }
  for (const point of points) {
    center.x += point.x
    center.y += point.y
  }
  center.x /= points.length
  center.y /= points.length

  return center
}

/**
 * 计算包围盒
 */
export function calculateBoundingBox(points: Point[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, minY, maxX, maxY }
}

/**
 * 判断点是否在多边形内（射线法）
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]
    const pj = polygon[j]

    if (((pi.y > point.y) !== (pj.y > point.y)) &&
        (point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x)) {
      inside = !inside
    }
  }

  return inside
}

/**
 * 边界框碰撞检测
 */
export function checkBoundingBoxCollision(
  box1: BoundingBox,
  box2: BoundingBox
): boolean {
  return !(
    box1.maxX < box2.minX ||
    box1.minX > box2.maxX ||
    box1.maxY < box2.minY ||
    box1.minY > box2.maxY
  )
}

/**
 * 获取路径的周长
 */
export function getPathLength(points: Point[]): number {
  if (points.length < 2) return 0

  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i])
  }
  return length
}
