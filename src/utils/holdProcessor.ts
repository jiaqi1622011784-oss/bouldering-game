import { Hold, Point } from '../types/hold'
import { calculateCenter, calculateBoundingBox, distance } from './blobDetection'

export interface HoldGenerationOptions {
  // 平滑算法参数
  smoothTolerance?: number
  // 多边形简化参数
  simplifyTolerance?: number
  targetVertexCount?: number
  // 形状增强参数
  deformationIntensity?: number
  // 颜色参数
  colorPalette?: string[]
}

const DEFAULT_OPTIONS: Required<HoldGenerationOptions> = {
  smoothTolerance: 5,
  simplifyTolerance: 10,
  targetVertexCount: 12,
  deformationIntensity: 0.1,
  colorPalette: [
    '#8B7355', // 风化石块
    '#A68A64', // 古砖
    '#6F6254', // 裂隙岩面
    '#B18B52', // 暗金沙土
    '#7C6B58', // 石灰残片
    '#C49A4A', // 符文碎片
  ],
}

/**
 * 主要的岩点生成函数
 */
export function generateHold(
  rawPath: Point[],
  options: HoldGenerationOptions = {}
): Hold {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (rawPath.length < 3) {
    throw new Error('Path must have at least 3 points to form a polygon')
  }

  // 1. 路径平滑
  const smoothed = smoothPath(rawPath, opts.smoothTolerance)

  // 2. 多边形简化
  const simplified = simplifyPolygon(smoothed, opts.targetVertexCount)

  // 3. 修正多边形
  const fixed = fixPolygonOrientation(simplified)

  // 4. 添加形状特征
  const enhanced = addShapeFeatures(fixed, opts.deformationIntensity)

  // 5. 计算属性
  const center = calculateCenter(enhanced)
  const boundingBox = calculateBoundingBox(enhanced)

  // 6. 生成颜色
  const color = generateRandomColor(opts.colorPalette)
  const strokeColor = adjustBrightness(color, -20)
  const glowColor = adjustBrightness(color, 30)

  return {
    id: generateId(),
    polygon: enhanced,
    center,
    color,
    strokeColor,
    glowColor,
    boundingBox,
    createdAt: Date.now(),
  }
}

/**
 * 路径平滑（使用 Douglas-Peucker 算法）
 */
export function smoothPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  let maxDistance = 0
  let maxIndex = 0

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], firstPoint, lastPoint)
    if (d > maxDistance) {
      maxDistance = d
      maxIndex = i
    }
  }

  if (maxDistance > tolerance) {
    const leftPart = smoothPath(points.slice(0, maxIndex + 1), tolerance)
    const rightPart = smoothPath(points.slice(maxIndex), tolerance)
    return [...leftPart.slice(0, -1), ...rightPart]
  } else {
    return [firstPoint, lastPoint]
  }
}

/**
 * 计算点到直线的垂直距离
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  if (lineStart.x === lineEnd.x && lineStart.y === lineEnd.y) {
    return distance(point, lineStart)
  }

  const A = lineEnd.x - lineStart.x
  const B = lineEnd.y - lineStart.y
  const C = lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  const denominator = Math.sqrt(A * A + B * B)

  if (denominator === 0) return distance(point, lineStart)

  return Math.abs(A * point.y - B * point.x + C) / denominator
}

/**
 * 多边形简化（减少顶点数）
 */
export function simplifyPolygon(points: Point[], targetCount: number): Point[] {
  if (points.length <= targetCount) return points

  const ratio = targetCount / points.length
  const simplified: Point[] = []

  for (let i = 0; i < points.length; i += Math.ceil(1 / ratio)) {
    simplified.push(points[i])
  }

  if (simplified.length < 3) {
    simplified.push(points[points.length - 1])
  }

  return simplified
}

/**
 * 修正多边形方向（确保为逆时针方向）
 */
export function fixPolygonOrientation(points: Point[]): Point[] {
  const area = polygonArea(points)

  // 如果面积为负，说明是顺时针，需要反转
  if (area < 0) {
    return [...points].reverse()
  }

  return points
}

/**
 * 计算多边形面积（带符号）
 */
function polygonArea(points: Point[]): number {
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
 * 添加形状特征（轻微形变）
 */
export function addShapeFeatures(points: Point[], intensity: number): Point[] {
  const center = calculateCenter(points)
  const enhanced: Point[] = []

  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const prev = points[(i - 1 + points.length) % points.length]
    const next = points[(i + 1) % points.length]

    // 计算法线方向
    const tangent = normalize({
      x: next.x - prev.x,
      y: next.y - prev.y,
    })

    const normal = {
      x: -tangent.y,
      y: tangent.x,
    }

    // 计算到中心的距离
    const toCenter = distance(point, center)
    const distanceFactor = Math.min(toCenter / 100, 2)

    // 添加随机形变
    const deformation = (Math.random() - 0.5) * intensity * 20 * distanceFactor

    enhanced.push({
      x: point.x + normal.x * deformation,
      y: point.y + normal.y * deformation,
    })
  }

  return enhanced
}

/**
 * 归一化向量
 */
function normalize(v: Point): Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

/**
 * 随机选择颜色
 */
function generateRandomColor(palette: string[]): string {
  return palette[Math.floor(Math.random() * palette.length)]
}

/**
 * 调整颜色亮度
 */
function adjustBrightness(color: string, amount: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * amount)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `hold_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * 检测路径是否应该自动闭合
 */
export function shouldClosePath(points: Point[], threshold: number = 20): boolean {
  if (points.length < 10) return false

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  return distance(firstPoint, lastPoint) < threshold
}

/**
 * 渲染岩点到 Canvas
 */
export function renderHold(
  ctx: CanvasRenderingContext2D,
  hold: Hold,
  options: {
    showCenter?: boolean
    showBoundingBox?: boolean
    scale?: number
    glowIntensity?: number
  } = {}
) {
  const {
    showCenter = false,
    showBoundingBox = false,
    scale = 1,
    glowIntensity = 20,
  } = options

  const polygon = hold.polygon

  // 保存状态
  ctx.save()

  // Glow 效果
  ctx.shadowBlur = glowIntensity
  ctx.shadowColor = hold.glowColor

  // 填充
  ctx.fillStyle = hold.color
  ctx.beginPath()
  ctx.moveTo(polygon[0].x * scale, polygon[0].y * scale)
  for (let i = 1; i < polygon.length; i++) {
    ctx.lineTo(polygon[i].x * scale, polygon[i].y * scale)
  }
  ctx.closePath()
  ctx.fill()

  // 描边
  ctx.strokeStyle = hold.strokeColor
  ctx.lineWidth = 2
  ctx.stroke()

  // 恢复状态（清除 glow）
  ctx.restore()

  // 中心点标记
  if (showCenter) {
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(hold.center.x * scale, hold.center.y * scale, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // 包围盒
  if (showBoundingBox) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(
      hold.boundingBox.minX * scale,
      hold.boundingBox.minY * scale,
      (hold.boundingBox.maxX - hold.boundingBox.minX) * scale,
      (hold.boundingBox.maxY - hold.boundingBox.minY) * scale
    )
  }
}
