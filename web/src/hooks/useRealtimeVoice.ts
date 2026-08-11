import { useCallback, useRef, useState } from 'react'

const SAMPLE_RATE = 16000
const FRAME_MS = 20
const FRAME_SAMPLES = Math.floor(SAMPLE_RATE * FRAME_MS / 1000)

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseRealtimeVoiceOptions {
  wsUrl: string
  onUserText?: (text: string) => void
  onAssistantText?: (text: string) => void
  onError?: (message: string) => void
  onConnected?: () => void
  onLatencyUpdate?: (latency: LatencyMetrics) => void
}

export interface LatencyMetrics {
  // 用户说话到 AI 开始回应的延迟
  userToAILatency?: number
  // 最近的网络延迟（毫秒）
  networkLatency?: number
  // 音频播放延迟
  audioPlaybackLatency?: number
  // 总端到端延迟
  totalLatency?: number
  // 样本数量（用于计算平均值）
  sampleCount?: number
}

export function useRealtimeVoice(options: UseRealtimeVoiceOptions) {
  const { wsUrl, onUserText, onAssistantText, onError, onConnected, onLatencyUpdate } = options
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [userText, setUserText] = useState('')
  const [assistantText, setAssistantText] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const captureCtxRef = useRef<AudioContext | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const pcmSendBufRef = useRef<Int16Array>(new Int16Array(0))
  const listeningRef = useRef(false)
  const mutedRef = useRef(false)
  const [muted, setMuted] = useState(false)
  const playbackRateRef = useRef(SAMPLE_RATE)
  const nextPlayTimeRef = useRef(0)
  const playbackSourcesRef = useRef<AudioBufferSourceNode[]>([])
  
  // 延迟监测 - 单次轮次延迟
  const latencyMetricsRef = useRef<LatencyMetrics>({})
  const turnStartTimeRef = useRef<number>(0)  // 用户开始说话的时间
  const aiFirstResponseTimeRef = useRef<number>(0)  // AI 首次回应的时间
  const audioPlayStartTimeRef = useRef<number>(0)  // 音频开始播放的时间
  const networkLatencySamplesRef = useRef<number[]>([])

  const downsample = (input: Float32Array, fromRate: number, toRate: number) => {
    if (fromRate === toRate) return input
    const ratio = fromRate / toRate
    const outLen = Math.floor(input.length / ratio)
    const out = new Float32Array(outLen)
    for (let i = 0; i < outLen; i++) {
      out[i] = input[Math.floor(i * ratio)] || 0
    }
    return out
  }

  const floatToInt16 = (floats: Float32Array) => {
    const out = new Int16Array(floats.length)
    for (let i = 0; i < floats.length; i++) {
      const s = Math.max(-1, Math.min(1, floats[i]))
      out[i] = s < 0 ? s * 32768 : s * 32767
    }
    return out
  }

  const appendPCM = useCallback((int16: Int16Array) => {
    const merged = new Int16Array(pcmSendBufRef.current.length + int16.length)
    merged.set(pcmSendBufRef.current)
    merged.set(int16, pcmSendBufRef.current.length)
    pcmSendBufRef.current = merged
    while (pcmSendBufRef.current.length >= FRAME_SAMPLES) {
      const frame = pcmSendBufRef.current.slice(0, FRAME_SAMPLES)
      pcmSendBufRef.current = pcmSendBufRef.current.slice(FRAME_SAMPLES)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(frame.buffer)
      }
    }
  }, [])

  const stopPlayback = useCallback(() => {
    playbackSourcesRef.current.forEach((s) => {
      try { s.stop() } catch { /* ignore */ }
    })
    playbackSourcesRef.current = []
    nextPlayTimeRef.current = playbackCtxRef.current?.currentTime ?? 0
  }, [])

  const playPCM = useCallback((bytes: Uint8Array) => {
    const rate = playbackRateRef.current
    if (!playbackCtxRef.current || playbackCtxRef.current.sampleRate !== rate) {
      stopPlayback()
      playbackCtxRef.current?.close()
      playbackCtxRef.current = new AudioContext({ sampleRate: rate })
    }
    const ctx = playbackCtxRef.current!
    if (ctx.state === 'suspended') ctx.resume()
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
    const floats = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) floats[i] = int16[i] / 32768
    const buffer = ctx.createBuffer(1, floats.length, rate)
    buffer.copyToChannel(floats, 0)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    const now = ctx.currentTime
    if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now
    src.start(nextPlayTimeRef.current)
    nextPlayTimeRef.current += buffer.duration
    playbackSourcesRef.current.push(src)
    src.onended = () => {
      playbackSourcesRef.current = playbackSourcesRef.current.filter((x) => x !== src)
    }
  }, [stopPlayback])

  const sendJSON = useCallback((obj: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj))
    }
  }, [])

  const stopMic = useCallback(() => {
    processorRef.current?.disconnect()
    if (processorRef.current) processorRef.current.onaudioprocess = null
    processorRef.current = null
    captureCtxRef.current?.close()
    captureCtxRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    pcmSendBufRef.current = new Int16Array(0)
  }, [])

  const cleanup = useCallback((notifyStop: boolean) => {
    listeningRef.current = false
    if (notifyStop) sendJSON({ type: 'listen', state: 'stop' })
    stopMic()
    stopPlayback()
    if (wsRef.current) {
      wsRef.current.onclose = null
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close()
      }
      wsRef.current = null
    }
  }, [sendJSON, stopMic, stopPlayback])

  // 计算和报告延迟指标（单次轮次）
  const updateLatencyMetrics = useCallback(() => {
    const metrics: LatencyMetrics = {}
    
    // 计算用户→AI 延迟（用户说话到 AI 首次回应）
    if (turnStartTimeRef.current > 0 && aiFirstResponseTimeRef.current > 0) {
      metrics.userToAILatency = aiFirstResponseTimeRef.current - turnStartTimeRef.current
    }
    
    // 计算网络延迟（平均值）
    if (networkLatencySamplesRef.current.length > 0) {
      const sum = networkLatencySamplesRef.current.reduce((a, b) => a + b, 0)
      metrics.networkLatency = Math.round(sum / networkLatencySamplesRef.current.length)
      metrics.sampleCount = networkLatencySamplesRef.current.length
    }
    
    // 计算总端到端延迟（用户说话到音频开始播放）
    if (turnStartTimeRef.current > 0 && audioPlayStartTimeRef.current > 0) {
      metrics.totalLatency = audioPlayStartTimeRef.current - turnStartTimeRef.current
    }
    
    latencyMetricsRef.current = metrics
    onLatencyUpdate?.(metrics)
  }, [onLatencyUpdate])

  const handleText = useCallback((raw: string) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(raw) } catch { return }
    switch (msg.type) {
      case 'hello': {
        const ap = (msg.audio_params as Record<string, number>) || {}
        if (ap.sample_rate > 0) playbackRateRef.current = ap.sample_rate
        setStatus('connected')
        sendJSON({ type: 'listen', state: 'start', mode: 'auto' })
        listeningRef.current = true
        onConnected?.()
        break
      }
      case 'stt': {
        const text = String(msg.text || '')
        // 用户开始说话时记录时间（仅第一次）
        if (text && turnStartTimeRef.current === 0) {
          // 重置上一轮的延迟数据
          aiFirstResponseTimeRef.current = 0
          audioPlayStartTimeRef.current = 0
          // 记录新轮次的开始时间
          turnStartTimeRef.current = Date.now()
        }
        setUserText(text)
        onUserText?.(text)
        break
      }
      case 'llm_response': {
        const text = String(msg.text || '')
        // AI 首次回应时记录时间（仅第一次）
        if (text && aiFirstResponseTimeRef.current === 0) {
          aiFirstResponseTimeRef.current = Date.now()
          updateLatencyMetrics()
        }
        setAssistantText(text)
        onAssistantText?.(text)
        break
      }
      case 'tts':
        if (msg.state === 'start') {
          stopPlayback()
          // 音频开始播放时记录时间
          if (audioPlayStartTimeRef.current === 0) {
            audioPlayStartTimeRef.current = Date.now()
            updateLatencyMetrics()
          }
        }
        break
      case 'error': {
        const message = String(msg.message || 'unknown error')
        onError?.(message)
        if (msg.fatal) setStatus('error')
        break
      }
    }
  }, [onAssistantText, onConnected, onError, onUserText, sendJSON, stopPlayback, updateLatencyMetrics])

  const connect = useCallback(async () => {
    if (!wsUrl) return
    setStatus('connecting')
    mutedRef.current = false
    setMuted(false)
    cleanup(false)
    try {
      // 请求麦克风权限
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { 
            echoCancellation: true, 
            noiseSuppression: true, 
            channelCount: 1,
            autoGainControl: true
          },
          video: false,
        })
      } catch (permErr: unknown) {
        const err = permErr as DOMException
        if (err.name === 'NotAllowedError') {
          setStatus('error')
          onError?.('麦克风权限被拒绝。请在浏览器设置中允许访问麦克风。')
          return
        } else if (err.name === 'NotFoundError') {
          setStatus('error')
          onError?.('未找到麦克风设备。请检查硬件连接。')
          return
        } else if (err.name === 'NotReadableError') {
          setStatus('error')
          onError?.('麦克风被其他应用占用。请关闭其他使用麦克风的应用。')
          return
        } else {
          throw err
        }
      }
      
      micStreamRef.current = stream
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      captureCtxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      processor.onaudioprocess = (ev) => {
        if (!listeningRef.current || mutedRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return
        const input = ev.inputBuffer.getChannelData(0)
        const down = downsample(input, ctx.sampleRate, SAMPLE_RATE)
        appendPCM(floatToInt16(down))
      }
      source.connect(processor)
      const mute = ctx.createGain()
      mute.gain.value = 0
      processor.connect(mute)
      mute.connect(ctx.destination)

      const ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        // 重置延迟指标（不在这里重置，而是在每次轮次开始时重置）
        networkLatencySamplesRef.current = []
        
        sendJSON({
          type: 'hello',
          version: 1,
          transport: 'websocket',
          audio_params: {
            format: 'pcm',
            sample_rate: SAMPLE_RATE,
            channels: 1,
            frame_duration: FRAME_MS,
            bit_depth: 16,
          },
          timestamp: Date.now(),
        })
      }
      ws.onmessage = (ev) => {
        // 测量网络延迟（基于消息接收时间）
        const receiveTime = Date.now()
        if (typeof ev.data === 'string') {
          try {
            const msg = JSON.parse(ev.data)
            if (msg.timestamp) {
              const latency = receiveTime - msg.timestamp
              networkLatencySamplesRef.current.push(latency)
              // 保留最近 20 个样本
              if (networkLatencySamplesRef.current.length > 20) {
                networkLatencySamplesRef.current.shift()
              }
            }
          } catch {
            // 忽略解析错误
          }
          handleText(ev.data)
        } else if (ev.data instanceof ArrayBuffer) {
          playPCM(new Uint8Array(ev.data))
        }
      }
      ws.onerror = () => {
        setStatus('error')
        onError?.('WebSocket 连接失败')
      }
      ws.onclose = () => {
        setStatus('disconnected')
        cleanup(false)
      }
    } catch (err: unknown) {
      setStatus('error')
      const errorMsg = err instanceof Error ? err.message : '连接失败'
      onError?.(errorMsg)
      cleanup(false)
    }
  }, [appendPCM, cleanup, handleText, onError, playPCM, sendJSON, wsUrl])

  const disconnect = useCallback(() => {
    cleanup(true)
    setStatus('idle')
  }, [cleanup])

  const interrupt = useCallback(() => {
    sendJSON({ type: 'abort' })
    stopPlayback()
  }, [sendJSON, stopPlayback])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      mutedRef.current = next
      return next
    })
  }, [])

  return {
    status,
    userText,
    assistantText,
    connect,
    disconnect,
    interrupt,
    toggleMute,
    muted,
    isConnected: status === 'connected',
    latencyMetrics: latencyMetricsRef.current,
  }
}
