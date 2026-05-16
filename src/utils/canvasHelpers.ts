import { Point } from '../types/hold'

/**
 * 获取 Canvas 中相对坐标
 */
export function getCanvasRelativePoint(
  canvas: HTMLCanvasElement,
  event: MouseEvent | TouchEvent | PointerEvent,
  scale: number = 1
): Point {
  const rect = canvas.getBoundingClientRect()
  let clientX: number
  let clientY: number

  if ('touches' in event && event.touches.length > 0) {
    clientX = event.touches[0].clientX
    clientY = event.touches[0].clientY
  } else if ('clientX' in event) {
    clientX = event.clientX
    clientY = event.clientY
  } else {
    throw new Error('Unsupported event type')
  }
  return {
    x: (clientX - rect.left) * scale,
    y: (clientY - rect.top) * scale,
  }
}

/**
 * 加载图片到 Canvas
 */
export function loadImageToCanvas(
  canvas: HTMLCanvasElement,
  imageUrl: string,
  options: {
    fit?: 'contain' | 'cover' | 'fill'
  } = {}
): Promise<void> {
  const { fit = 'contain' } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get 2D context'))
        return
      }

      // 使用逻辑尺寸（CSS尺寸）计算，而不是像素尺寸
      const rect = canvas.getBoundingClientRect()
      const logicalWidth = rect.width
      const logicalHeight = rect.height

      // 清空画布（使用像素尺寸）
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 计算宽高比
      const canvasAspect = logicalWidth / logicalHeight
      const imageAspect = img.width / img.height

      let drawWidth: number
      let drawHeight: number
      let offsetX = 0
      let offsetY = 0

      switch (fit) {
        case 'cover':
          if (imageAspect > canvasAspect) {
            drawHeight = logicalHeight
            drawWidth = img.width * (drawHeight / img.height)
            offsetX = (logicalWidth - drawWidth) / 2
          } else {
            drawWidth = logicalWidth
            drawHeight = img.height * (drawWidth / img.width)
            offsetY = (logicalHeight - drawHeight) / 2
          }
          break

        case 'contain':
        default:
          if (imageAspect > canvasAspect) {
            drawWidth = logicalWidth
            drawHeight = img.height * (drawWidth / img.width)
            offsetY = (logicalHeight - drawHeight) / 2
          } else {
            drawHeight = logicalHeight
            drawWidth = img.width * (drawHeight / img.height)
            offsetX = (logicalWidth - drawWidth) / 2
          }
          break

        case 'fill':
          drawWidth = logicalWidth
          drawHeight = logicalHeight
          break
      }

      // 绘制图片（坐标会被DPR缩放自动处理）
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

      resolve()
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    img.src = imageUrl
  })
}

/**
 * 在 Canvas 上绘制画笔预览
 */
export function drawBrushPreview(
  ctx: CanvasRenderingContext2D,
  position: Point | null,
  brushSize: number,
  color: string = 'rgba(255, 255, 255, 0.5)'
): void {
  if (!position) return

  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(position.x, position.y, brushSize / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * 在 Canvas 上绘制点列表形成路径
 */
export function drawPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  options: {
    strokeStyle?: string
    lineWidth?: number
    lineCap?: CanvasLineCap
    lineJoin?: CanvasLineJoin
    closed?: boolean
  } = {}
): void {
  if (points.length < 2) return

  const {
    strokeStyle = '#FFFFFF',
    lineWidth = 2,
    lineCap = 'round',
    lineJoin = 'round',
    closed = false,
  } = options

  ctx.save()
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.lineCap = lineCap
  ctx.lineJoin = lineJoin

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }

  if (closed && points.length > 2) {
    ctx.closePath()
  }

  ctx.stroke()
  ctx.restore()
}

/**
 * 获取 Canvas 的缩放因子（用于高 DPR 屏幕）
 */
export function getDevicePixelRatioScale(canvas: HTMLCanvasElement): number {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  return Math.max(dpr, canvas.width / rect.width, canvas.height / rect.height)
}

/**
 * 设置 Canvas 尺寸（考虑 DPR）
 */
export function setupCanvasForDPR(canvas: HTMLCanvasElement): number {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  // 设置实际像素尺寸
  canvas.width = Math.floor(rect.width * dpr)
  canvas.height = Math.floor(rect.height * dpr)

  // 重置变换矩阵并应用缩放
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  return dpr
}

/**
 * 清空 Canvas
 */
export function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

/**
 * 导出 Canvas 为 Data URL
 */
export function canvasToDataURL(canvas: HTMLCanvasElement, type: string = 'image/png', quality?: number): string {
  return canvas.toDataURL(type, quality)
}

/**
 * 从 Data URL 创建 Image
 */
export function dataURLToImage(dataURL: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataURL
  })
}

/**
 * 获取 Canvas 的平均颜色（用于判断背景深浅）
 */
export async function getCanvasAverageColor(canvas: HTMLCanvasElement): Promise<string> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return '#808080'

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  let r = 0, g = 0, b = 0
  const sampleRate = 100

  for (let i = 0; i < data.length; i += 4 * sampleRate) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }

  const sampleCount = data.length / (4 * sampleRate)
  r = Math.floor(r / sampleCount)
  g = Math.floor(g / sampleCount)
  b = Math.floor(b / sampleCount)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
