import { useState } from 'react'
import { Volume2, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { generateWordAudioUrls } from '@/utils/lingechoTts'

interface Props {
  word: string
  /** 中文释义，用于第三条音频（英文 英文 中文） */
  translation?: string
  /** 生成成功后回调，返回 3 个 url 用 ; 拼接的字符串 */
  onGenerated: (audioUrl: string) => void
}

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function LingechoTTS({ word, translation, onGenerated }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!word.trim()) return
    setStatus('loading')
    setError('')
    try {
      const audioUrl = await generateWordAudioUrls(word.trim(), translation)
      onGenerated(audioUrl)
      setStatus('success')
    } catch (e: any) {
      setError(e?.message || '生成失败')
      setStatus('error')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={status === 'loading' || !word.trim()}
        title="通过 Lingecho 生成音频"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50
          border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-600 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
      >
        {status === 'loading'
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Volume2 className="w-3.5 h-3.5" />}
        {status === 'loading' ? '生成中...' : '生成音频'}
      </button>

      {status === 'success' && (
        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <CheckCircle className="w-3.5 h-3.5" /> 已生成
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1 text-xs text-red-500" title={error}>
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </span>
      )}
    </div>
  )
}
