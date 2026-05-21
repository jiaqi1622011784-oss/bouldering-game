import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameProvider, useGame } from '../context/GameContext'
import { useCanvas } from '../hooks/useCanvas'
import type { Hold, Point } from '../types/hold'
import { getCanvasRelativePoint } from '../utils/canvasHelpers'
import { isCOMStable } from '../utils/gamePhysics'
import { archaeologyLevels } from '../utils/defaultRoute'

type LimbKey = 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot'

interface ClimbGameProps {
  onBack: () => void
  onRestart: () => void
  onComplete?: (result: { success: boolean; collectedFragments: number; progress: number }) => void
}

interface Transform {
  scale: number
  offsetX: number
  offsetY: number
}

interface LimbEndState {
  pos: Point
  holdId: string | null
  lastStablePos: Point
}

interface RigState {
  shoulder: Point
  hip: Point
  head: Point
  leftElbow: Point
  rightElbow: Point
  leftKnee: Point
  rightKnee: Point
  limbs: Record<LimbKey, LimbEndState>
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

// ----------------------------
// 向量/几何工具
// ----------------------------
function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y }
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y }
}

function mul(a: Point, s: number): Point {
  return { x: a.x * s, y: a.y * s }
}

function len(a: Point): number {
  return Math.sqrt(a.x * a.x + a.y * a.y)
}

function normalize(a: Point): Point {
  const l = len(a)
  if (l === 0) return { x: 0, y: 0 }
  return { x: a.x / l, y: a.y / l }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function midpoint(a: Point, b: Point): Point {
  return mul(add(a, b), 0.5)
}

function dist(a: Point, b: Point): number {
  return len(sub(a, b))
}

function perp(v: Point): Point {
  return { x: -v.y, y: v.x }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

function clampPointToReach(root: Point, target: Point, maxReach: number): Point {
  const d = dist(root, target)
  if (d <= maxReach) return target
  const dir = normalize(sub(target, root))
  return add(root, mul(dir, maxReach))
}

function angleToDistance(aLen: number, bLen: number, thetaRad: number) {
  const d2 = aLen * aLen + bLen * bLen - 2 * aLen * bLen * Math.cos(thetaRad)
  return Math.sqrt(Math.max(0, d2))
}

// ----------------------------
// 岩点抽离（布局变换）
// ----------------------------
function applyTransform(p: Point, t: Transform): Point {
  return { x: p.x * t.scale + t.offsetX, y: p.y * t.scale + t.offsetY }
}

function computeHoldsBounds(holds: Hold[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const h of holds) {
    for (const p of h.polygon) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  return { minX, minY, maxX, maxY }
}

function computeArenaTransform(canvas: HTMLCanvasElement, holds: Hold[]): Transform {
  const rect = canvas.getBoundingClientRect()
  const logicalW = rect.width
  const logicalH = rect.height
  const bounds = computeHoldsBounds(holds)
  const w = Math.max(1, bounds.maxX - bounds.minX)
  const h = Math.max(1, bounds.maxY - bounds.minY)

  const margin = 80
  const availableW = Math.max(50, logicalW - margin * 2)
  const availableH = Math.max(50, logicalH - margin * 2)
  const scale = Math.min(availableW / w, availableH / h)

  const offsetX = (logicalW - w * scale) / 2 - bounds.minX * scale
  const offsetY = (logicalH - h * scale) / 2 - bounds.minY * scale

  return { scale, offsetX, offsetY }
}

function transformHold(hold: Hold, t: Transform): Hold {
  const polygon = hold.polygon.map(p => applyTransform(p, t))
  const center = applyTransform(hold.center, t)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of polygon) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return {
    ...hold,
    polygon,
    center,
    boundingBox: { minX, minY, maxX, maxY }
  }
}

function nearestHoldWithin(holds: Hold[], p: Point, radius: number): Hold | null {
  let best: Hold | null = null
  let bestD = Infinity
  for (const h of holds) {
    const d = dist(p, h.center)
    if (d <= radius && d < bestD) {
      best = h
      bestD = d
    }
  }
  return best
}

function renderHoldSimple(ctx: CanvasRenderingContext2D, hold: Hold) {
  const poly = hold.polygon
  if (poly.length < 3) return

  ctx.save()
  ctx.shadowBlur = 6
  ctx.shadowColor = 'rgba(61, 45, 30, 0.35)'

  const shade = Math.abs(Math.round(hold.center.x + hold.center.y)) % 4
  ctx.fillStyle = ['#8B7355', '#A68A64', '#766653', '#B08A55'][shade]
  ctx.beginPath()
  ctx.moveTo(poly[0].x, poly[0].y)
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#3B3025'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.strokeStyle = 'rgba(245, 222, 179, 0.28)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(hold.center.x - 9, hold.center.y - 3)
  ctx.lineTo(hold.center.x + 8, hold.center.y + 2)
  ctx.stroke()
  ctx.restore()
}

function drawMarker(ctx: CanvasRenderingContext2D, center: Point, label: string, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(center.x, center.y, 16, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#0B1220'
  ctx.beginPath()
  ctx.arc(center.x, center.y, 12, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = color
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, center.x, center.y)
  ctx.restore()
}

function drawRuinsBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#F1E8DA')
  gradient.addColorStop(0.45, '#D5BE9B')
  gradient.addColorStop(1, '#B68D5F')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.globalAlpha = 0.28
  ctx.strokeStyle = '#5C4028'
  ctx.lineWidth = 2
  for (let y = 56; y < height; y += 74) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y + Math.sin(y) * 10)
    ctx.stroke()
  }
  for (let x = 48; x < width; x += 86) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + Math.sin(x) * 14, height)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = 'rgba(55, 38, 26, 0.48)'
  ctx.lineWidth = 3
  const cracks = [
    [{ x: width * 0.18, y: height * 0.18 }, { x: width * 0.23, y: height * 0.28 }, { x: width * 0.19, y: height * 0.41 }],
    [{ x: width * 0.78, y: height * 0.24 }, { x: width * 0.72, y: height * 0.33 }, { x: width * 0.80, y: height * 0.49 }],
    [{ x: width * 0.48, y: height * 0.58 }, { x: width * 0.43, y: height * 0.68 }, { x: width * 0.50, y: height * 0.79 }],
  ]
  for (const crack of cracks) {
    ctx.beginPath()
    ctx.moveTo(crack[0].x, crack[0].y)
    for (let i = 1; i < crack.length; i++) ctx.lineTo(crack[i].x, crack[i].y)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.fillStyle = 'rgba(197, 150, 81, 0.16)'
  ctx.strokeStyle = 'rgba(74, 55, 35, 0.42)'
  ctx.lineWidth = 2
  ctx.strokeRect(width * 0.5 - 54, 18, 108, 60)
  ctx.fillRect(width * 0.5 - 50, 22, 100, 56)
  ctx.fillStyle = 'rgba(48, 37, 28, 0.42)'
  ctx.font = 'bold 18px serif'
  ctx.textAlign = 'center'
  ctx.fillText('古墓入口', width * 0.5, 56)
  ctx.restore()
}

function drawFragment(ctx: CanvasRenderingContext2D, center: Point, collected: boolean) {
  if (collected) return
  ctx.save()
  ctx.translate(center.x + 26, center.y - 24)
  ctx.rotate(Math.PI / 4)
  ctx.shadowBlur = 14
  ctx.shadowColor = '#FBBF24'
  ctx.fillStyle = '#D6A13D'
  ctx.strokeStyle = '#4B371F'
  ctx.lineWidth = 2
  ctx.fillRect(-8, -8, 16, 16)
  ctx.strokeRect(-8, -8, 16, 16)
  ctx.restore()
}

// ----------------------------
// 解析 IK（2-bone）
// ----------------------------
function solveTwoBoneIK(
  root: Point,
  target: Point,
  len1: number,
  len2: number,
  bendSign: 1 | -1,
  angleMinDeg: number,
  angleMaxDeg: number
): { joint: Point; clampedTarget: Point; reachable: boolean } {
  const thetaMin = (angleMinDeg * Math.PI) / 180
  const thetaMax = (angleMaxDeg * Math.PI) / 180
  const maxD = angleToDistance(len1, len2, thetaMin) // 越直越长
  const minD = angleToDistance(len1, len2, thetaMax) // 越弯越短

  const toT = sub(target, root)
  const d0 = len(toT)
  const d = clamp(d0, minD + 0.001, maxD - 0.001)
  const reachable = d0 <= maxD + 0.001

  const dir = d0 === 0 ? { x: 1, y: 0 } : mul(toT, 1 / d0)
  const clampedTarget = add(root, mul(dir, d))

  // 余弦定理：求 root 处夹角（dir 与 上臂方向的夹角）
  const cosA = clamp((len1 * len1 + d * d - len2 * len2) / (2 * len1 * d), -1, 1)
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA))

  const perpDir = perp(dir)
  const jointDir = add(mul(dir, cosA), mul(perpDir, sinA * bendSign))
  const joint = add(root, mul(jointDir, len1))

  return { joint, clampedTarget, reachable }
}

function computeCOMFromRig(rig: RigState): Point {
  const torsoCenter = midpoint(rig.shoulder, rig.hip)
  const wTorso = 0.55
  const wHead = 0.1
  const wLimb = (1 - wTorso - wHead) / 4
  return add(
    add(mul(torsoCenter, wTorso), mul(rig.head, wHead)),
    add(
      add(mul(rig.limbs.leftHand.pos, wLimb), mul(rig.limbs.rightHand.pos, wLimb)),
      add(mul(rig.limbs.leftFoot.pos, wLimb), mul(rig.limbs.rightFoot.pos, wLimb))
    )
  )
}

function drawRig(
  ctx: CanvasRenderingContext2D,
  rig: RigState,
  hull: Point[],
  com: Point,
  stable: boolean,
  color: string,
  draggingLimb: LimbKey | null,
  maxArmReach: number,
  maxLegReach: number,
  dragHint?: { limb: LimbKey; root: Point; target: Point; reachable: boolean }
) {
  // 支撑多边形
  if (hull.length >= 3) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(hull[0].x, hull[0].y)
    for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y)
    ctx.closePath()
    ctx.fillStyle = stable ? 'rgba(34, 197, 94, 0.10)' : 'rgba(239, 68, 68, 0.12)'
    ctx.strokeStyle = stable ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'
    ctx.lineWidth = 2
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  // 拖拽延长线：从 root 指向 pointer（可达=青色，不可达=红色）
  if (dragHint) {
    ctx.save()
    ctx.setLineDash([6, 6])
    ctx.strokeStyle = dragHint.reachable ? 'rgba(34,211,238,0.9)' : 'rgba(239,68,68,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(dragHint.root.x, dragHint.root.y)
    ctx.lineTo(dragHint.target.x, dragHint.target.y)
    ctx.stroke()
    ctx.restore()
  }

  const stroke = color
  const leftHandPos = clampPointToReach(rig.shoulder, rig.limbs.leftHand.pos, maxArmReach)
  const rightHandPos = clampPointToReach(rig.shoulder, rig.limbs.rightHand.pos, maxArmReach)
  const leftFootPos = clampPointToReach(rig.hip, rig.limbs.leftFoot.pos, maxLegReach)
  const rightFootPos = clampPointToReach(rig.hip, rig.limbs.rightFoot.pos, maxLegReach)
  const drawBone = (a: Point, b: Point, width = 6) => {
    ctx.save()
    ctx.strokeStyle = stroke
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.restore()
  }

  // 躯干
  drawBone(rig.shoulder, rig.hip, 7)

  // 手臂
  drawBone(rig.shoulder, rig.leftElbow)
  drawBone(rig.leftElbow, leftHandPos)
  drawBone(rig.shoulder, rig.rightElbow)
  drawBone(rig.rightElbow, rightHandPos)

  // 腿
  drawBone(rig.hip, rig.leftKnee)
  drawBone(rig.leftKnee, leftFootPos)
  drawBone(rig.hip, rig.rightKnee)
  drawBone(rig.rightKnee, rightFootPos)

  // 头
  ctx.save()
  ctx.beginPath()
  ctx.arc(rig.head.x, rig.head.y, 14, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.9
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#0B1220'
  ctx.stroke()
  ctx.restore()

  const drawJoint = (p: Point, radius: number, fill: string) => {
    ctx.save()
    ctx.beginPath()
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#0B1220'
    ctx.stroke()
    ctx.restore()
  }

  // 端点
  drawJoint(leftHandPos, 11, draggingLimb === 'leftHand' ? '#FBBF24' : color)
  drawJoint(rightHandPos, 11, draggingLimb === 'rightHand' ? '#FBBF24' : color)
  drawJoint(leftFootPos, 11, draggingLimb === 'leftFoot' ? '#FBBF24' : color)
  drawJoint(rightFootPos, 11, draggingLimb === 'rightFoot' ? '#FBBF24' : color)

  // 内部关节
  drawJoint(rig.leftElbow, 6, '#E5E7EB')
  drawJoint(rig.rightElbow, 6, '#E5E7EB')
  drawJoint(rig.leftKnee, 6, '#E5E7EB')
  drawJoint(rig.rightKnee, 6, '#E5E7EB')
  drawJoint(rig.shoulder, 6, '#E5E7EB')
  drawJoint(rig.hip, 6, '#E5E7EB')

  // COM
  drawJoint(com, 6, stable ? '#22C55E' : '#EF4444')
}

// ----------------------------
// 主组件：响应式拖拽攀爬
// ----------------------------
export const ClimbGame: React.FC<ClimbGameProps> = ({ onBack, onRestart, onComplete }) => {
  const { state, dispatch } = useGame()
  const rawHolds = state.holds
  const currentLevel = archaeologyLevels[state.currentLevelIndex] ?? archaeologyLevels[0]
  const isLastLevel = state.currentLevelIndex >= archaeologyLevels.length - 1

  const [characterColor, setCharacterColor] = useState('#D6A13D')
  const [message, setMessage] = useState<string | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const [failedAt, setFailedAt] = useState<number | null>(null)
  const [startAt, setStartAt] = useState(() => Date.now())
  const [stepCount, setStepCount] = useState(0)
  const [nextHoldIndex, setNextHoldIndex] = useState(1)
  const [missCount, setMissCount] = useState(0)
  const [collectedFragments, setCollectedFragments] = useState<Set<string>>(() => new Set())

  const [arenaTransform, setArenaTransform] = useState<Transform | null>(null)
  const handleArenaResize = useCallback((canvas: HTMLCanvasElement) => {
    if (rawHolds.length > 0) {
      setArenaTransform(computeArenaTransform(canvas, rawHolds))
    }
  }, [rawHolds])
  const { canvasRef, getContext, resizeCanvas } = useCanvas({
    onResize: handleArenaResize
  })

  const arenaHolds = useMemo(() => {
    if (!arenaTransform) return []
    return rawHolds.map(h => transformHold(h, arenaTransform))
  }, [rawHolds, arenaTransform])

  const fragmentTargetIds = useMemo(() => {
    if (rawHolds.length < 5) return new Set<string>()
    const indexes = [
      Math.floor(rawHolds.length * 0.35),
      Math.floor(rawHolds.length * 0.6),
      Math.floor(rawHolds.length * 0.82),
    ]
    return new Set(indexes.map(i => rawHolds[clamp(i, 1, rawHolds.length - 2)]?.id).filter(Boolean))
  }, [rawHolds])

  const reachForLimb = useCallback((limb: LimbKey) => {
    const s = arenaTransform?.scale ?? 1
    return (limb === 'leftHand' || limb === 'rightHand') ? 136 * s : 154 * s
  }, [arenaTransform?.scale])

  const rootForLimb = useCallback((rig: RigState, limb: LimbKey) => {
    return (limb === 'leftHand' || limb === 'rightHand') ? rig.shoulder : rig.hip
  }, [])

  // 单指拖拽（始终只允许一个 limb 被拖拽）
  const draggingRef = useRef<{
    pointerId: number
    limb: LimbKey
    startPos: Point
    startHoldId: string | null
  } | null>(null)
  const lastPickedLimbRef = useRef<LimbKey | null>(null)

  // 主数据：使用 ref，避免高频 setState
  const rigRef = useRef<RigState | null>(null)
  const stableInfoRef = useRef<{ stable: boolean; hull: Point[]; com: Point; supportCount: number }>({
    stable: false,
    hull: [],
    com: { x: 0, y: 0 },
    supportCount: 0
  })

  const clearMessageSoon = useCallback(() => {
    window.setTimeout(() => setMessage(null), 1400)
  }, [])

  const resetRound = useCallback(() => {
    if (arenaHolds.length < 2) return
    const s = arenaTransform?.scale ?? 1

    const h0 = arenaHolds[0]
    const h1 = arenaHolds[1] ?? h0
    const h2 = arenaHolds[2] ?? h1
    const h3 = arenaHolds[3] ?? h2

    const torsoLen = 95 * s
    const shoulder = midpoint(h2.center, h3.center)
    const hip = add(shoulder, { x: 0, y: torsoLen })
    const head = add(shoulder, { x: 0, y: -35 * s })

    rigRef.current = {
      shoulder,
      hip,
      head,
      leftElbow: midpoint(shoulder, h2.center),
      rightElbow: midpoint(shoulder, h3.center),
      leftKnee: midpoint(hip, h0.center),
      rightKnee: midpoint(hip, h1.center),
      limbs: {
        leftHand: { pos: h2.center, holdId: h2.id, lastStablePos: h2.center },
        rightHand: { pos: h3.center, holdId: h3.id, lastStablePos: h3.center },
        leftFoot: { pos: h0.center, holdId: h0.id, lastStablePos: h0.center },
        rightFoot: { pos: h1.center, holdId: h1.id, lastStablePos: h1.center },
      }
    }

    setFinishedAt(null)
    setFailedAt(null)
    setStartAt(Date.now())
    setStepCount(0)
    setMissCount(0)
    setCollectedFragments(new Set())
    setNextHoldIndex(Math.min(4, rawHolds.length - 1))
    setMessage('拖拽手脚到可触及的遗迹石块，过远会被绳索限制')
    window.setTimeout(() => setMessage(null), 1800)
  }, [arenaHolds, arenaTransform?.scale, rawHolds.length])

  const handleWin = useCallback((fragmentCount: number) => {
    setFinishedAt(Date.now())
    setMessage('古墓机关已被激活。')
    onComplete?.({
      success: true,
      collectedFragments: fragmentCount,
      progress: 100,
    })
  }, [onComplete])

  // 初始化一次
  const hasInitialized = useRef(false)
  useEffect(() => {
    if (!arenaTransform || arenaHolds.length < 2) return
    if (hasInitialized.current) return
    hasInitialized.current = true
    resetRound()
  }, [arenaTransform, arenaHolds.length, resetRound])

  // 当岩点变化时，强制触发一次 resize -> transform 重新计算
  useEffect(() => {
    if (rawHolds.length > 0) resizeCanvas()
  }, [rawHolds.length, resizeCanvas])

  // 命中：四肢端点
  const hitTestLimb = useCallback((p: Point, rig: RigState): LimbKey | null => {
    const r = 18
    const keys: LimbKey[] = ['leftHand', 'rightHand', 'leftFoot', 'rightFoot']
    const hits = keys
      .map(limb => ({ limb, distance: dist(rig.limbs[limb].pos, p) }))
      .filter(hit => hit.distance <= r)
      .sort((a, b) => a.distance - b.distance)

    if (hits.length === 0) return null
    if (hits.length === 1) return hits[0].limb

    const lastIndex = hits.findIndex(hit => hit.limb === lastPickedLimbRef.current)
    return hits[(lastIndex + 1) % hits.length].limb
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || finishedAt || failedAt) return
    const rig = rigRef.current
    if (!rig) return

    const p = getCanvasRelativePoint(canvasRef.current, e.nativeEvent, 1)
    const limb = hitTestLimb(p, rig)
    if (!limb) return
    lastPickedLimbRef.current = limb

    draggingRef.current = {
      pointerId: e.pointerId,
      limb,
      startPos: { ...rig.limbs[limb].pos },
      startHoldId: rig.limbs[limb].holdId
    }

    // 拖拽时视为暂时未抓稳
    rig.limbs[limb].holdId = null
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [canvasRef, failedAt, finishedAt, hitTestLimb])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    const rig = rigRef.current
    const dragging = draggingRef.current
    if (!rig || !dragging || dragging.pointerId !== e.pointerId) return

    const p = getCanvasRelativePoint(canvasRef.current, e.nativeEvent, 1)
    const root = rootForLimb(rig, dragging.limb)
    rig.limbs[dragging.limb].pos = clampPointToReach(root, p, reachForLimb(dragging.limb))
  }, [canvasRef, reachForLimb, rootForLimb])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    const rig = rigRef.current
    const dragging = draggingRef.current
    if (!rig || !dragging || dragging.pointerId !== e.pointerId) return
    draggingRef.current = null

    const limb = dragging.limb
    const p = rig.limbs[limb].pos

    // 20px 自动吸附抓握
    const snapRadius = 20
    const hold = nearestHoldWithin(arenaHolds, p, snapRadius)

    if (hold) {
      const root = rootForLimb(rig, limb)
      if (dist(root, hold.center) > reachForLimb(limb) + snapRadius) {
        const fallback = dragging.startHoldId ? rig.limbs[limb].lastStablePos : dragging.startPos
        rig.limbs[limb].pos = fallback
        rig.limbs[limb].holdId = dragging.startHoldId
        setMessage('距离太远，绳索限制了这次伸展')
        clearMessageSoon()
        return
      }

      rig.limbs[limb].pos = hold.center
      rig.limbs[limb].holdId = hold.id
      rig.limbs[limb].lastStablePos = hold.center

      // 进度：只在抓到“下一点”时推进（不限制玩家抓其它点用于调整）
      const targetIndex = rawHolds.findIndex(h => h.id === hold.id)
      const nextFragments = new Set(collectedFragments)
      if (fragmentTargetIds.has(hold.id) && !nextFragments.has(hold.id)) {
        nextFragments.add(hold.id)
        setCollectedFragments(nextFragments)
        setMessage(`发现文明残片：${nextFragments.size}/${fragmentTargetIds.size}`)
        clearMessageSoon()
      }
      if (targetIndex === nextHoldIndex) {
        setStepCount(c => c + 1)
        setNextHoldIndex(i => i + 1)
        if (targetIndex === rawHolds.length - 1) {
          handleWin(nextFragments.size)
        }
      }
      return
    }

    // 不够：弹回（回到上一次抓稳的位置；如果从未抓稳，就回到按下时的位置）
    const fallback = dragging.startHoldId ? rig.limbs[limb].lastStablePos : dragging.startPos
    rig.limbs[limb].pos = fallback
    rig.limbs[limb].holdId = dragging.startHoldId
    setMissCount(count => {
      const next = count + 1
      if (next >= 3) {
        setFailedAt(Date.now())
        setMessage('岩壁松动，你被迫撤回营地。')
      } else {
        setMessage(`碎石滑落，抓握失败 ${next}/3`)
        clearMessageSoon()
      }
      return next
    })
  }, [arenaHolds, canvasRef, clearMessageSoon, collectedFragments, fragmentTargetIds, handleWin, nextHoldIndex, rawHolds, reachForLimb, rootForLimb])

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    onPointerUp(e)
  }, [onPointerUp])

  // 每帧：计算身体跟随 + IK（一次） + 渲染
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return

    let raf = 0
    let lastT = performance.now()

    const loop = (t: number) => {
      const rig = rigRef.current
      if (!rig) {
        raf = requestAnimationFrame(loop)
        return
      }

      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        raf = requestAnimationFrame(loop)
        return
      }

      // DPR 对齐：使用 CSS 像素绘制
      const dprScale = canvas.width / rect.width
      if (Number.isFinite(dprScale) && dprScale > 0) {
        ctx.setTransform(dprScale, 0, 0, dprScale, 0, 0)
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }

      const dt = clamp((t - lastT) / 1000, 1 / 240, 1 / 30)
      lastT = t
      const smooth = 1 - Math.exp(-dt * 18) // 身体跟随平滑度

      const s = arenaTransform?.scale ?? 1
      const torsoLen = 95 * s
      const upperArm = 70 * s
      const forearm = 70 * s
      const upperLeg = 80 * s
      const lowerLeg = 80 * s

      // 目标：让肩/髋跟随手脚的整体质心，但保持可控（不会“乱飞”）
      const handMid = midpoint(rig.limbs.leftHand.pos, rig.limbs.rightHand.pos)
      const footMid = midpoint(rig.limbs.leftFoot.pos, rig.limbs.rightFoot.pos)
      const upDir = normalize(sub(handMid, footMid))
      const downDir = mul(upDir, -1)

      let shoulderTarget = add(handMid, mul(downDir, 28 * s))
      let hipTarget = add(footMid, mul(upDir, 35 * s))

      // 让躯干长度固定
      const torsoDir = normalize(sub(hipTarget, shoulderTarget))
      hipTarget = add(shoulderTarget, mul(torsoDir, torsoLen))

      // 平滑更新根节点
      rig.shoulder = lerpPoint(rig.shoulder, shoulderTarget, smooth)
      rig.hip = lerpPoint(rig.hip, hipTarget, smooth)

      // 修正：确保四肢尽量“够得到”（避免玩家拖远导致身体飞走）
      const correctRootToward = (root: Point, target: Point, maxReach: number): Point => {
        const d = dist(root, target)
        if (d <= maxReach) return root
        const dir = normalize(sub(target, root))
        const move = (d - maxReach) * 0.65
        return add(root, mul(dir, move))
      }

      // 迭代 2 次，效果更稳但仍轻量
      for (let i = 0; i < 2; i++) {
        rig.shoulder = correctRootToward(rig.shoulder, rig.limbs.leftHand.pos, upperArm + forearm)
        rig.shoulder = correctRootToward(rig.shoulder, rig.limbs.rightHand.pos, upperArm + forearm)
        rig.hip = correctRootToward(rig.hip, rig.limbs.leftFoot.pos, upperLeg + lowerLeg)
        rig.hip = correctRootToward(rig.hip, rig.limbs.rightFoot.pos, upperLeg + lowerLeg)

        // 重新施加躯干长度
        const dir = normalize(sub(rig.hip, rig.shoulder))
        rig.hip = add(rig.shoulder, mul(dir, torsoLen))
      }

      // 头部：沿躯干反方向
      const headDir = normalize(sub(rig.shoulder, rig.hip))
      rig.head = add(rig.shoulder, mul(headDir, 35 * s))

      // IK：肘/膝（带关节角度限制 + 防反关节的 bendSign）
      // 左肢 bendSign=+1，右肢 bendSign=-1（简单约定）
      const leftArm = solveTwoBoneIK(rig.shoulder, rig.limbs.leftHand.pos, upperArm, forearm, 1, 15, 160)
      const rightArm = solveTwoBoneIK(rig.shoulder, rig.limbs.rightHand.pos, upperArm, forearm, -1, 15, 160)
      const leftLeg = solveTwoBoneIK(rig.hip, rig.limbs.leftFoot.pos, upperLeg, lowerLeg, 1, 10, 170)
      const rightLeg = solveTwoBoneIK(rig.hip, rig.limbs.rightFoot.pos, upperLeg, lowerLeg, -1, 10, 170)

      rig.leftElbow = leftArm.joint
      rig.rightElbow = rightArm.joint
      rig.leftKnee = leftLeg.joint
      rig.rightKnee = rightLeg.joint

      // 支撑点：当前抓稳的手脚（holdId != null）
      const support: Point[] = []
      for (const k of ['leftHand', 'rightHand', 'leftFoot', 'rightFoot'] as const) {
        if (rig.limbs[k].holdId) support.push(rig.limbs[k].pos)
      }

      const com = computeCOMFromRig(rig)
      const stableInfo = support.length >= 3 ? isCOMStable(com, support) : { stable: false, hull: [] as Point[] }
      stableInfoRef.current = { stable: stableInfo.stable, hull: stableInfo.hull, com, supportCount: support.length }

      // 渲染
      ctx.clearRect(0, 0, rect.width, rect.height)

      drawRuinsBackground(ctx, rect.width, rect.height)

      // 遗迹石块
      for (const h of arenaHolds) renderHoldSimple(ctx, h)

      // 文明残片
      for (const h of arenaHolds) {
        if (fragmentTargetIds.has(h.id)) {
          drawFragment(ctx, h.center, collectedFragments.has(h.id))
        }
      }

      // 起/终/下一点
      if (arenaHolds[0]) drawMarker(ctx, arenaHolds[0].center, '营', '#65A30D')
      if (arenaHolds[arenaHolds.length - 1]) drawMarker(ctx, arenaHolds[arenaHolds.length - 1].center, '门', '#D97706')
      if (arenaHolds[nextHoldIndex]) drawMarker(ctx, arenaHolds[nextHoldIndex].center, `${nextHoldIndex + 1}`, '#FBBF24')

      const dragging = draggingRef.current
      const draggingLimb = dragging?.limb ?? null
      const dragHint = (() => {
        if (!draggingLimb) return undefined
        const target = rig.limbs[draggingLimb].pos
        const root = rootForLimb(rig, draggingLimb)
        const reachable = dist(root, target) <= reachForLimb(draggingLimb) + 0.001
        return { limb: draggingLimb, root, target, reachable }
      })()

      drawRig(
        ctx,
        rig,
        stableInfo.hull,
        com,
        stableInfo.stable,
        characterColor,
        draggingLimb,
        reachForLimb('leftHand'),
        reachForLimb('leftFoot'),
        dragHint
      )

      // 顶部提示：不稳定但不掉落
      if (support.length >= 3 && !stableInfo.stable) {
        ctx.save()
        ctx.fillStyle = 'rgba(127,29,29,0.88)'
        ctx.font = 'bold 14px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('重心偏移：调整姿态，避开松动岩面', rect.width / 2, 28)
        ctx.restore()
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [arenaHolds, arenaTransform?.scale, canvasRef, characterColor, collectedFragments, fragmentTargetIds, getContext, nextHoldIndex, reachForLimb, rootForLimb])

  const elapsed = (finishedAt ?? failedAt ?? Date.now()) - startAt
  const stabilityLabel = (() => {
    const s = stableInfoRef.current
    if (s.supportCount < 3) return '支撑点不足'
    return s.stable ? '稳定' : '失稳'
  })()

  return (
    <div className="fixed inset-0 museum-shell flex flex-col">
      {/* Header */}
      <div className="museum-header p-4 border-b">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="p-2 text-[#6b4a2f] hover:text-[#3a2a1e] transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className="text-lg font-semibold flex items-center gap-2">
            <span>{currentLevel.title}</span>
          </h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => resetRound()}
              className="px-3 py-2 museum-button text-sm"
            >
              重新勘探
            </button>
            <button
              onClick={onRestart}
              className="px-3 py-2 museum-button text-sm"
            >
              新岩壁
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative bg-[#efe5d3]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />

        {message && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#f8efe2]/90 border border-[#6f4f34]/35 px-4 py-2 rounded-lg text-sm text-[#3a2a1e] shadow-sm">
            {message}
          </div>
        )}

        {finishedAt && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="museum-panel border rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
              <h2 className="text-2xl font-semibold mb-2 text-[#7a4c1f]">你抵达了遗迹入口。</h2>
              <p className="text-[#715f4c] text-sm mb-4">古墓机关已被激活，新的道路开启了。</p>
              <div className="text-[#4d3a2a] text-sm space-y-1 mb-5">
                <div>勘探用时：{formatTime(elapsed)}</div>
                <div>攀爬步数：{stepCount}</div>
                <div>文明残片：{collectedFragments.size}/{fragmentTargetIds.size}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onBack}
                  className="flex-1 py-2 museum-button"
                >
                  返回岩壁
                </button>
                {isLastLevel ? (
                  <button
                    onClick={() => resetRound()}
                    className="flex-1 py-2 museum-button-primary"
                  >
                    重新攀登
                  </button>
                ) : (
                  <button
                    onClick={() => dispatch({ type: 'NEXT_LEVEL' })}
                    className="flex-1 py-2 museum-button-primary"
                  >
                    下一关
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {failedAt && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="museum-panel border rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
              <h2 className="text-2xl font-semibold mb-2 text-[#8a4a36]">勘探中断</h2>
              <p className="text-[#4d3a2a] text-sm mb-5">碎石滑落，绳索失衡，你被迫撤回营地。</p>
              <div className="flex gap-2">
                <button
                  onClick={onBack}
                  className="flex-1 py-2 museum-button"
                >
                  返回岩壁
                </button>
                <button
                  onClick={() => resetRound()}
                  className="flex-1 py-2 museum-button-danger"
                >
                  重新开始
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control panel */}
      <div className="museum-panel border-t p-4">
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex items-center justify-between text-sm text-[#4d3a2a]">
            <div>石刻线索：#{Math.min(nextHoldIndex + 1, rawHolds.length)}</div>
            <div>用时：{formatTime(elapsed)}</div>
            <div>残片：{collectedFragments.size}/{fragmentTargetIds.size}</div>
            <div>松动：{missCount}/3</div>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="text-[#715f4c]">调查员标记</label>
            <input
              type="color"
              value={characterColor}
              onChange={(e) => setCharacterColor(e.target.value)}
              className="h-9 w-14 bg-transparent"
              disabled={!!finishedAt || !!failedAt}
              title="调查员颜色"
            />
            <div className={`text-xs ${stabilityLabel === '稳定' ? 'text-[#59663a]' : 'text-[#8a4a36]'}`}>
              {stabilityLabel}
            </div>
          </div>

          {arenaHolds.length < 2 && (
            <p className="text-xs text-[#715f4c]">
              需要至少 2 个遗迹石块（营地/入口）才能开始勘探。
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export const ArchaeologyClimbMiniGame: React.FC<Pick<ClimbGameProps, 'onComplete'>> = ({ onComplete }) => {
  const [gameKey, setGameKey] = useState(0)

  return (
    <GameProvider key={gameKey}>
      <ClimbGame
        onBack={() => undefined}
        onRestart={() => setGameKey(key => key + 1)}
        onComplete={onComplete}
      />
    </GameProvider>
  )
}
