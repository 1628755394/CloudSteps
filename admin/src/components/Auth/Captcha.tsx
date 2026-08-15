import { useState, useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { get, post } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'

export interface CaptchaData {
  id: string
  type: 'image' | 'math' | 'jigsaw' | 'rotate'
  data: any
  expires: string
}

interface CaptchaProps {
  onVerify: (captchaId: string, captchaType: string, captchaData: any) => void
  onError?: (error: string) => void
}

const Captcha = ({ onVerify, onError }: CaptchaProps) => {
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  
  // Image captcha
  const [imageCode, setImageCode] = useState('')

  // Math captcha
  const [mathAnswer, setMathAnswer] = useState('')

  // Jigsaw captcha
  const [jigsawOffset, setJigsawOffset] = useState(0)
  const jigsawDragRef = useRef<HTMLDivElement>(null)
  const jigsawDragStartXRef = useRef(0)

  // Rotate captcha
  const [rotateAngle, setRotateAngle] = useState(0)

  // Load captcha
  const loadCaptcha = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await get<CaptchaData>(
        `${getApiBaseURL()}/auth/captcha`
      )
      
      if (response.code === 200 && response.data) {
        const raw = response.data as any
        // click 类型在移动端 H5 不好操作，自动跳过
        if (raw.type === 'click') {
          loadCaptcha()
          return
        }
        const adapted: CaptchaData = {
          id: raw.id,
          type: raw.type || 'image',
          data: raw.data || {},
          expires: raw.expires || '',
        }

        setCaptcha(adapted)
        // Reset states based on type
        setImageCode('')
        setMathAnswer('')
        setJigsawOffset(0)
        setRotateAngle(0)
        setVerified(false)
      } else {
        throw new Error(response.msg || 'Failed to load captcha')
      }
    } catch (err: any) {
      const errorMsg = err?.msg || err?.message || 'Failed to load captcha'
      setError(errorMsg)
      onError?.(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCaptcha()
  }, [])

  // Verify captcha - 直接回调，不预先消费验证码，让登录接口统一验证
  const verifyCaptcha = async (data: any) => {
    if (!captcha) return
    // 直接触发回调，把 id 和 code 传给登录接口去验证
    onVerify(captcha.id, captcha.type, data)
    setVerified(true)
  }

  // Handle image captcha submit
  const handleImageSubmit = () => {
    if (!imageCode.trim()) {
      setError('请输入验证码')
      return
    }
    if (!captcha?.id) {
      setError('验证码已过期，请刷新')
      loadCaptcha()
      return
    }
    verifyCaptcha(imageCode.trim())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading captcha...</span>
      </div>
    )
  }

  if (!captcha) {
    return (
      <div className="text-center p-4">
        <p className="text-sm text-red-500 mb-2">{error || 'Failed to load captcha'}</p>
        <button
          onClick={loadCaptcha}
          className="text-sm text-blue-600 hover:text-blue-700 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Image Captcha */}
      {captcha.type === 'image' && (
        <div className="space-y-4">
          {verified ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-600 dark:text-green-400">验证成功</span>
            </div>
          ) : (
            <>
              {/* 第一行：验证码图片 + 换一张 */}
              <div className="flex items-center gap-3">
                <img
                  src={captcha.data?.image?.startsWith('data:') ? captcha.data.image : `data:image/png;base64,${captcha.data?.image}`}
                  alt="验证码"
                  className="h-12 flex-1 object-contain border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={loadCaptcha}
                  title="点击刷新"
                />
                <button
                  type="button"
                  onClick={loadCaptcha}
                  className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="w-3 h-3" />
                  换一张
                </button>
              </div>

              {/* 第二行：输入框 */}
              <input
                type="text"
                value={imageCode}
                onChange={(e) => setImageCode(e.target.value)}
                placeholder="请输入验证码"
                autoFocus
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white placeholder:tracking-normal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && imageCode.trim()) {
                    handleImageSubmit()
                  }
                }}
              />

              {/* 第三行：确认按钮 */}
              <button
                type="button"
                onClick={handleImageSubmit}
                disabled={!imageCode.trim()}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                确认验证
              </button>
            </>
          )}
        </div>
      )}

      {/* Math Captcha */}
      {captcha.type === 'math' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-mono">
              {captcha.data?.question}
            </span>
            <button
              type="button"
              onClick={loadCaptcha}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              换一题
            </button>
          </div>
          {verified ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <span className="text-sm text-green-600 dark:text-green-400">验证成功</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                value={mathAnswer}
                onChange={(e) => setMathAnswer(e.target.value)}
                placeholder="请输入答案"
                autoFocus
                className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && mathAnswer.trim()) {
                    verifyCaptcha(Number(mathAnswer))
                  }
                }}
              />
              <button
                type="button"
                onClick={() => mathAnswer.trim() && verifyCaptcha(Number(mathAnswer))}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                确认
              </button>
            </div>
          )}
        </div>
      )}

      {/* Jigsaw Captcha */}
      {captcha.type === 'jigsaw' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              拖动拼图块到缺口
            </label>
            <button
              type="button"
              onClick={loadCaptcha}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              换一张
            </button>
          </div>
          {verified ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <span className="text-sm text-green-600 dark:text-green-400">验证成功</span>
            </div>
          ) : (
            <>
              <div
                className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 select-none"
                style={{ width: captcha.data?.width || 300, height: captcha.data?.height || 150 }}
              >
                {captcha.data?.background && (
                  <img src={captcha.data.background} alt="jigsaw bg" className="w-full h-full" />
                )}
                <div
                  ref={jigsawDragRef}
                  onPointerDown={(e) => {
                    jigsawDragStartXRef.current = e.clientX - jigsawOffset
                    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons !== 1) return
                    const raw = e.clientX - jigsawDragStartXRef.current
                    const max = (captcha.data?.width || 300) - (captcha.data?.pieceSize || 40)
                    setJigsawOffset(Math.max(0, Math.min(raw, max)))
                  }}
                  onPointerUp={() => verifyCaptcha(jigsawOffset)}
                  className="absolute top-0 cursor-grab active:cursor-grabbing touch-none"
                  style={{ left: jigsawOffset, width: captcha.data?.pieceSize || 40, height: captcha.data?.height || 150 }}
                >
                  {captcha.data?.piece && (
                    <img src={captcha.data.piece} alt="piece" className="w-full h-full" draggable={false} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Rotate Captcha */}
      {captcha.type === 'rotate' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              旋转图片到正确方向 ({rotateAngle}°)
            </label>
            <button
              type="button"
              onClick={loadCaptcha}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              换一张
            </button>
          </div>
          {verified ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <span className="text-sm text-green-600 dark:text-green-400">验证成功</span>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                {captcha.data?.image && (
                  <img
                    src={captcha.data.image}
                    alt="rotate captcha"
                    className="rounded-lg border border-slate-200 dark:border-slate-700"
                    style={{ transform: `rotate(${rotateAngle}deg)`, transition: 'transform 0.1s' }}
                  />
                )}
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={rotateAngle}
                onChange={(e) => setRotateAngle(Number(e.target.value))}
                className="w-full"
              />
              <button
                type="button"
                onClick={() => verifyCaptcha(rotateAngle)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                确认
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}

export default Captcha
