import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useGame } from '../context/GameContext'

interface CameraCaptureProps {
  onCapture: (imageUrl: string) => void
  onCancel?: () => void
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onCancel
}) => {
  const [mode, setMode] = useState<'camera' | 'upload'>('camera')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { dispatch } = useGame()

  // 获取摄像头设备列表
  const getCameraDevices = useCallback(async () => {
    try {
      // 先请求一次权限
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
      tempStream.getTracks().forEach(track => track.stop())

      // 枚举设备
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')

      setDevices(videoDevices)
      setSelectedDeviceId(videoDevices[0]?.deviceId || null)
    } catch (error) {
      console.error('Failed to get camera devices:', error)
    }
  }, [])

  // 启动摄像头
  const startCamera = useCallback(async (deviceId?: string) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('您的浏览器不支持摄像头功能')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 停止之前的流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: !deviceId ? 'environment' : undefined,
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // iOS Safari 需要 playsInline
        videoRef.current.setAttribute('playsinline', 'true')

        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return

          videoRef.current.onloadedmetadata = () => resolve()
          videoRef.current.onerror = (e) => reject(e)

          // 超时处理
          setTimeout(() => {
            if (videoRef.current && videoRef.current.readyState < 2) {
              reject(new Error('Camera loading timeout'))
            }
          }, 5000)
        })
      }
    } catch (err) {
      console.error('Camera error:', err)
      let errorMessage = '无法访问摄像头'

      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            errorMessage = '请授予摄像头权限'
            break
          case 'NotFoundError':
            errorMessage = '未找到摄像头设备'
            break
          case 'NotReadableError':
            errorMessage = '摄像头被其他应用占用'
            break
          case 'OverconstrainedError':
            errorMessage = '摄像头不支持所需的分辨率'
            break
        }
      }

      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 拍照
  const takePhoto = useCallback(() => {
    if (!videoRef.current) return

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    // 使用视频实际尺寸
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // 绘制视频帧到 canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // 转换为 data URL
    const imageUrl = canvas.toDataURL('image/jpeg', 0.9)

    // 保存到 state 并停止摄像头
    dispatch({ type: 'SET_BACKGROUND_IMAGE', payload: imageUrl })
    onCapture(imageUrl)

    // 停止摄像头
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [onCapture, dispatch])

  // 处理文件上传
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }

    setIsLoading(true)
    setError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string
      if (imageUrl) {
        dispatch({ type: 'SET_BACKGROUND_IMAGE', payload: imageUrl })
        onCapture(imageUrl)
      }
      setIsLoading(false)
    }
    reader.onerror = () => {
      setError('读取文件失败')
      setIsLoading(false)
    }
    reader.readAsDataURL(file)
  }, [onCapture, dispatch])

  // 切换摄像头
  const switchCamera = useCallback(() => {
    if (devices.length <= 1) return

    const currentIndex = devices.findIndex(d => d.deviceId === selectedDeviceId)
    const nextIndex = (currentIndex + 1) % devices.length
    const nextDevice = devices[nextIndex]

    setSelectedDeviceId(nextDevice.deviceId)
    startCamera(nextDevice.deviceId)
  }, [devices, selectedDeviceId, startCamera])

  // 初始化
  useEffect(() => {
    if (mode === 'camera' && devices.length === 0) {
      getCameraDevices()
    }
  }, [mode, devices.length, getCameraDevices])

  // 启动默认摄像头
  useEffect(() => {
    if (mode === 'camera' && devices.length > 0 && !streamRef.current) {
      const deviceId = selectedDeviceId || devices[0]?.deviceId
      startCamera(deviceId || undefined)
    }
  }, [mode, devices, selectedDeviceId, startCamera])

  // 清理
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="relative bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h1 className="text-lg font-semibold">
            {mode === 'camera' ? '采集岩壁' : '上传遗迹岩壁'}
          </h1>

          <button
            onClick={switchCamera}
            disabled={devices.length <= 1}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="切换摄像头"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Mode Switch */}
        <div className="mt-4 bg-gray-700 rounded-lg p-1 flex">
          <button
            onClick={() => setMode('camera')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              mode === 'camera'
                ? 'bg-gray-600 text-white font-medium'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              拍摄
            </div>
          </button>

          <button
            onClick={() => setMode('upload')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              mode === 'upload'
                ? 'bg-gray-600 text-white font-medium'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              上传
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {mode === 'camera' ? (
          <>
            {/* Video Preview */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} // 镜像效果
            />

            {/* Camera Frame Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4/5 h-2/3 border-2 border-white/50 rounded-lg" />
            </div>

            {/* Shutter Button */}
            <button
              onClick={takePhoto}
              disabled={isLoading}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-white/10 hover:bg-white/20 border-4 border-white/50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-14 h-14 bg-white rounded-full mx-auto" />
            </button>
          </>
        ) : (
          <>
            {/* Upload Area */}
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <div
                className="w-full max-w-sm aspect-square border-2 border-dashed border-gray-600 rounded-2xl flex flex-col items-center justify-center hover:border-cyan-500 hover:bg-gray-800/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gray-400 text-center px-4">
                  点击上传遗迹岩壁图片
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  支持 JPG, PNG 格式
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white">加载中...</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-900/80 border border-red-600 rounded-lg p-3 text-red-200">
            <p className="text-sm">{error}</p>
            <button
              onClick={() => {
                setError(null)
                if (mode === 'camera') {
                  startCamera(selectedDeviceId || undefined)
                }
              }}
              className="mt-2 text-xs underline hover:text-white"
            >
              重试
            </button>
          </div>
        )}
      </div>

      {/* Footer Hint */}
      <div className="bg-gray-800 p-3 border-t border-gray-700">
        <p className="text-center text-gray-400 text-sm">
          {mode === 'camera'
            ? '对准遗迹岩壁，点击白色按钮采集'
            : '请选择一张清晰的岩壁或遗迹照片'}
        </p>
      </div>
    </div>
  )
}
