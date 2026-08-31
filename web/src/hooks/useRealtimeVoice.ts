import { useCallback, useRef, useState } from 'react'
import i18n from '../i18n'

const SAMPLE_RATE = 16000
const FRAME_MS = 20
const FRAME_SAMPLES = Math.floor((SAMPLE_RATE * FRAME_MS) / 1000)

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
  userToAILatency?: number
  networkLatency?: number
  audioPlaybackLatency?: number
  totalLatency?: number
  sampleCount?: number
}

/**
 * Thin PCM bridge to CloudSteps realtime WS (ling-base Agent).
 *
 * Client → server: binary PCM16LE @ 16kHz; JSON {type:"abort"|"stop"}
 * Server → client: binary PCM16LE @ output rate; JSON ready/stt/assistant/error
 */
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
  const streamingRef = useRef(false)
  const mutedRef = useRef(false)
  const [muted, setMuted] = useState(false)
  const playbackRateRef = useRef(24000)
  const nextPlayTimeRef = useRef(0)
  const playbackSourcesRef = useRef<AudioBufferSourceNode[]>([])

  const latencyMetricsRef = useRef<LatencyMetrics>({})
  const turnStartTimeRef = useRef(0)
  const aiFirstResponseTimeRef = useRef(0)
  const audioPlayStartTimeRef = useRef(0)
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
      try {
        s.stop()
      } catch {
        /* ignore */
      }
    })
    playbackSourcesRef.current = []
    nextPlayTimeRef.current = playbackCtxRef.current?.currentTime ?? 0
  }, [])

  const playPCM = useCallback(
    (bytes: Uint8Array) => {
      const rate = playbackRateRef.current
      if (!playbackCtxRef.current || playbackCtxRef.current.sampleRate !== rate) {
        stopPlayback()
        playbackCtxRef.current?.close()
        playbackCtxRef.current = new AudioContext({ sampleRate: rate })
      }
      const ctx = playbackCtxRef.current!
      if (ctx.state === 'suspended') void ctx.resume()
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

      if (audioPlayStartTimeRef.current === 0) {
        audioPlayStartTimeRef.current = Date.now()
      }
    },
    [stopPlayback]
  )

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

  const cleanup = useCallback(
    (notifyStop: boolean) => {
      streamingRef.current = false
      if (notifyStop) sendJSON({ type: 'stop' })
      stopMic()
      stopPlayback()
      if (wsRef.current) {
        wsRef.current.onclose = null
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close()
        }
        wsRef.current = null
      }
    },
    [sendJSON, stopMic, stopPlayback]
  )

  const updateLatencyMetrics = useCallback(() => {
    const metrics: LatencyMetrics = {}
    if (turnStartTimeRef.current > 0 && aiFirstResponseTimeRef.current > 0) {
      metrics.userToAILatency = aiFirstResponseTimeRef.current - turnStartTimeRef.current
    }
    if (networkLatencySamplesRef.current.length > 0) {
      const sum = networkLatencySamplesRef.current.reduce((a, b) => a + b, 0)
      metrics.networkLatency = Math.round(sum / networkLatencySamplesRef.current.length)
      metrics.sampleCount = networkLatencySamplesRef.current.length
    }
    if (turnStartTimeRef.current > 0 && audioPlayStartTimeRef.current > 0) {
      metrics.totalLatency = audioPlayStartTimeRef.current - turnStartTimeRef.current
    }
    latencyMetricsRef.current = metrics
    onLatencyUpdate?.(metrics)
  }, [onLatencyUpdate])

  const handleText = useCallback(
    (raw: string) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw)
      } catch {
        return
      }
      switch (msg.type) {
        case 'ready': {
          const outRate = Number(msg.output_sample_rate || 0)
          if (outRate > 0) playbackRateRef.current = outRate
          streamingRef.current = true
          setStatus('connected')
          onConnected?.()
          break
        }
        case 'stt': {
          const text = String(msg.text || '')
          if (text && turnStartTimeRef.current === 0) {
            aiFirstResponseTimeRef.current = 0
            audioPlayStartTimeRef.current = 0
            turnStartTimeRef.current = Date.now()
          }
          setUserText(text)
          onUserText?.(text)
          break
        }
        case 'assistant': {
          const text = String(msg.text || '')
          if (text && aiFirstResponseTimeRef.current === 0) {
            aiFirstResponseTimeRef.current = Date.now()
            updateLatencyMetrics()
          }
          if (msg.final) {
            setAssistantText(text)
            if (text) onAssistantText?.(text)
          } else if (text) {
            setAssistantText((prev) => prev + text)
          }
          break
        }
        case 'barge_in': {
          stopPlayback()
          break
        }
        case 'error': {
          const message = String(msg.message || 'unknown error')
          onError?.(message)
          if (msg.fatal) setStatus('error')
          break
        }
      }
    },
    [onAssistantText, onConnected, onError, onUserText, stopPlayback, updateLatencyMetrics]
  )

  const connect = useCallback(async () => {
    if (!wsUrl) return
    setStatus('connecting')
    mutedRef.current = false
    setMuted(false)
    cleanup(false)
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
            autoGainControl: true,
          },
          video: false,
        })
      } catch (permErr: unknown) {
        const err = permErr as DOMException
        if (err.name === 'NotAllowedError') {
          setStatus('error')
          onError?.(i18n.t('voice.microphone_denied'))
          return
        }
        if (err.name === 'NotFoundError') {
          setStatus('error')
          onError?.(i18n.t('voice.microphone_not_found'))
          return
        }
        if (err.name === 'NotReadableError') {
          setStatus('error')
          onError?.(i18n.t('voice.microphone_in_use'))
          return
        }
        throw err
      }

      micStreamRef.current = stream
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      captureCtxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      processor.onaudioprocess = (ev) => {
        if (!streamingRef.current || mutedRef.current || wsRef.current?.readyState !== WebSocket.OPEN) {
          return
        }
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
        networkLatencySamplesRef.current = []
      }
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          handleText(ev.data)
        } else if (ev.data instanceof ArrayBuffer) {
          if (audioPlayStartTimeRef.current === 0) {
            audioPlayStartTimeRef.current = Date.now()
            updateLatencyMetrics()
          }
          playPCM(new Uint8Array(ev.data))
        }
      }
      ws.onerror = () => {
        setStatus('error')
        onError?.(i18n.t('voice.websocket_failed'))
      }
      ws.onclose = () => {
        setStatus('disconnected')
        cleanup(false)
      }
    } catch (err: unknown) {
      setStatus('error')
      const errorMsg = err instanceof Error ? err.message : i18n.t('voice.connection_failed')
      onError?.(errorMsg)
      cleanup(false)
    }
  }, [appendPCM, cleanup, handleText, onError, playPCM, updateLatencyMetrics, wsUrl])

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
