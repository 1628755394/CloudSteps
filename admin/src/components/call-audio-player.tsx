import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import {
  decorativeWaveformBars,
  loadProgressiveWavWaveform,
} from '@/lib/progressive-wav-waveform'
import { cn } from '@/lib/utils'

const BAR_COUNT = 100
const PLACEHOLDER_BAR = 14

type CallAudioPlayerProps = {
  audioUrl: string
  hasAudio?: boolean
  durationSeconds?: number | null
  title?: string
  className?: string
  seekToSeconds?: number | null
  onTimeUpdate?: (seconds: number) => void
}

export function CallAudioPlayer({
  audioUrl,
  hasAudio = true,
  durationSeconds,
  title = '音频',
  className,
  seekToSeconds,
  onTimeUpdate,
}: CallAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
  const scrubbing = useRef(false)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onTimeUpdateRef.current = onTimeUpdate

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [metaDuration, setMetaDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [waveformProgress, setWaveformProgress] = useState(0)
  const [waveformLoading, setWaveformLoading] = useState(false)

  const duration = durationSeconds ?? metaDuration ?? 0

  useEffect(() => {
    if (!audioUrl?.trim()) {
      setWaveformData([])
      setWaveformProgress(0)
      setWaveformLoading(false)
      return
    }

    const ac = new AbortController()
    setWaveformData([])
    setWaveformProgress(0)
    setWaveformLoading(true)
    setError(null)

    void loadProgressiveWavWaveform(
      audioUrl.trim(),
      ({ bars, progress }) => {
        setWaveformData(bars)
        setWaveformProgress(progress)
        if (progress >= 1) setWaveformLoading(false)
      },
      { barCount: BAR_COUNT, signal: ac.signal }
    ).catch(() => {
      if (ac.signal.aborted) return
      setWaveformData(decorativeWaveformBars(BAR_COUNT))
      setWaveformProgress(1)
      setWaveformLoading(false)
    })

    return () => ac.abort()
  }, [audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const emit = (t: number) => {
      setCurrentTime(t)
      onTimeUpdateRef.current?.(t)
    }
    const onTime = () => {
      if (scrubbing.current) return
      emit(audio.currentTime)
    }
    const onEnd = () => {
      setIsPlaying(false)
      emit(0)
    }
    const onLoad = () => setIsLoading(true)
    const onCanPlay = () => setIsLoading(false)
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) setMetaDuration(audio.duration)
    }
    const onErr = () => {
      setError('音频加载失败')
      setIsLoading(false)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('loadstart', onLoad)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('error', onErr)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('loadstart', onLoad)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('error', onErr)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (
      !audio ||
      seekToSeconds == null ||
      !Number.isFinite(seekToSeconds) ||
      scrubbing.current
    )
      return
    if (Math.abs(audio.currentTime - seekToSeconds) <= 0.12) return
    try {
      scrubbing.current = true
      audio.currentTime = Math.max(0, seekToSeconds)
      setCurrentTime(audio.currentTime)
      onTimeUpdateRef.current?.(audio.currentTime)
    } catch {
      /* ignore seek before metadata */
    } finally {
      scrubbing.current = false
    }
  }, [seekToSeconds])

  const togglePlayPause = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else await audio.play()
  }

  const handleWaveformClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const waveform = waveformRef.current
    if (!audio || !waveform || !duration) return
    const rect = waveform.getBoundingClientRect()
    const percentage = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    )
    const next = percentage * duration
    scrubbing.current = true
    audio.currentTime = next
    setCurrentTime(next)
    onTimeUpdateRef.current?.(next)
    scrubbing.current = false
    if (!isPlaying) await audio.play()
  }

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0')}`

  if (!hasAudio || !audioUrl) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const receivedBars = Math.floor(waveformProgress * BAR_COUNT)

  const barHeight = (i: number) => {
    if (i < receivedBars && waveformData[i] != null)
      return Math.max(20, waveformData[i])
    return PLACEHOLDER_BAR
  }

  return (
    <div className={cn('rounded-lg border bg-card p-4 shadow-sm', className)}>
      <div className='mb-3 flex items-center justify-between'>
        <h3 className='text-base font-semibold'>{title}</h3>
        <div className='font-mono text-sm text-muted-foreground'>
          {formatTime(currentTime)} / {formatTime(duration)}
          {waveformLoading ? (
            <span className='ml-2 text-xs'>
              波形 {Math.round(waveformProgress * 100)}%
            </span>
          ) : null}
        </div>
      </div>
      <audio ref={audioRef} src={audioUrl} preload='metadata' />
      {error ? (
        <div className='mb-3 text-sm text-destructive'>{error}</div>
      ) : null}
      <div className='flex items-center gap-3'>
        <button
          type='button'
          onClick={() => void togglePlayPause()}
          disabled={isLoading}
          className='flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
        >
          {isPlaying ? (
            <Pause className='size-4' />
          ) : (
            <Play className='size-4' />
          )}
        </button>
        <div
          ref={waveformRef}
          onClick={(e) => void handleWaveformClick(e)}
          className='group relative h-14 flex-1 cursor-pointer overflow-hidden rounded bg-muted'
        >
          {waveformLoading ? (
            <div
              className='pointer-events-none absolute inset-y-0 left-0 z-[5] bg-primary/10 transition-[width] duration-150'
              style={{ width: `${waveformProgress * 100}%` }}
            />
          ) : null}
          <div className='absolute inset-0 z-10 flex items-center justify-around px-1'>
            {Array.from({ length: BAR_COUNT }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'w-0.5 rounded-full transition-[height] duration-75',
                  (i / BAR_COUNT) * 100 < progress
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30',
                  i >= receivedBars && 'opacity-40'
                )}
                style={{ height: `${barHeight(i)}%` }}
              />
            ))}
          </div>
          <div
            className='absolute top-0 bottom-0 z-20 w-0.5 bg-destructive'
            style={{ left: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
