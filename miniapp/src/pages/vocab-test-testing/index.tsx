/**
 * 词汇测试答题页 — 对齐 web/src/pages/VocabularyTestTesting.tsx。
 *
 * 流程:
 *  1. getVocabStart() 获取首题
 *  2. 选择后调用 getVocabNext() 获取下一题(自适应)
 *  3. 错误累计达上限或无下一题 → submitVocabTest() 提交 → 跳 result
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, Close } from '@nutui/icons-react-taro'
import { CloudButton } from '../../components/button'
import { getVocabNext, submitVocabTest } from '../../api/vocab'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import './index.scss'

interface VocabQuestion {
  id: number
  word: string
  options: string
  correctAnswer: string
  level?: string
  difficultyScore?: number
  audioUrl?: string
}

interface AnswerRecord {
  questionId: number
  answer: string
}

const WRONG_LIMIT = 5

function parseOptions(options: string): string[] {
  try {
    const arr = JSON.parse(options)
    return Array.isArray(arr) ? arr.map((s) => String(s)) : []
  } catch {
    return []
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function VocabTestTesting() {
  const [questions, setQuestions] = useState<VocabQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const answersRef = useRef<AnswerRecord[]>([])
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [timer, setTimer] = useState(8)
  const [showWarning, setShowWarning] = useState(false)
  const audioCtxRef = useRef<Taro.InnerAudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentQuestion = questions[currentIndex] ?? null
  const busy = loading || submitting

  const handleBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.reLaunch({ url: '/pages/material-selection/index' })
    })
  }

  const handleQuit = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.reLaunch({ url: '/pages/material-selection/index' })
    })
  }

  // 加载首题
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const { getVocabStart } = await import('../../api/vocab')
        const res = await getVocabStart()
        if (mounted && res.code === 200) {
          const list: VocabQuestion[] = res.data?.questions || []
          if (list.length > 0) {
            setQuestions([list[0]])
          } else {
            Taro.showToast({ title: '题库暂无题目', icon: 'none' })
            Taro.navigateBack({ delta: 1 })
          }
        } else if (mounted) {
          Taro.showToast({ title: res.msg || '获取题目失败', icon: 'none' })
          Taro.navigateBack({ delta: 1 })
        }
      } catch (e: unknown) {
        if (mounted) {
          const msg = e && typeof e === 'object' && 'msg' in e ? String((e as { msg: string }).msg) : '加载题目失败'
          Taro.showToast({ title: msg, icon: 'none' })
          Taro.navigateBack({ delta: 1 })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // 倒计时
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (busy) return
    if (timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => Math.max(0, prev - 1))
      }, 1000)
    } else {
      setShowWarning(true)
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [timer, busy])

  // 切题时重置计时器
  useEffect(() => {
    if (!busy && currentQuestion) {
      setTimer(8)
      setShowWarning(false)
    }
  }, [currentIndex, busy, currentQuestion])

  // 自动播放当前题音频
  useEffect(() => {
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.stop()
        audioCtxRef.current.destroy()
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null
    }
    if (currentQuestion?.audioUrl && !loading && !submitting) {
      const src = resolveMediaUrl(currentQuestion.audioUrl.split(';')[0]?.trim())
      if (src) {
        const ctx = Taro.createInnerAudioContext()
        ctx.src = src
        ctx.autoplay = true
        ctx.onError(() => {})
        audioCtxRef.current = ctx
      }
    }
    return () => {
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.destroy()
        } catch {
          /* ignore */
        }
      }
    }
  }, [currentQuestion?.id, loading, submitting, currentQuestion])

  const handlePlayAudio = () => {
    if (!currentQuestion?.audioUrl || busy) return
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.stop()
        audioCtxRef.current.destroy()
      } catch {
        /* ignore */
      }
    }
    const src = resolveMediaUrl(currentQuestion.audioUrl.split(';')[0]?.trim())
    if (!src) return
    const ctx = Taro.createInnerAudioContext()
    ctx.src = src
    ctx.autoplay = true
    ctx.onError(() => {
      Taro.showToast({ title: '音频播放失败', icon: 'none' })
    })
    audioCtxRef.current = ctx
  }

  const submitAndGoResult = useCallback(async (payloadAnswers: AnswerRecord[]) => {
    if (!payloadAnswers.length) throw new Error('答案不能为空')
    const res = await submitVocabTest({ answers: payloadAnswers })
    if (res.code !== 200) throw new Error(res.msg || '提交失败')
    // 缓存结果供结果页使用
    try {
      Taro.setStorageSync('vocabulary_test_result', JSON.stringify(res.data))
    } catch {
      /* ignore */
    }
    Taro.redirectTo({ url: '/pages/vocab-test-result/index' })
  }, [])

  const handleAnswerSelect = async (value: string) => {
    if (!currentQuestion || busy) return
    setSelectedAnswer(value)

    const isUnknown = value === '不认识'
    const isCorrect = !isUnknown && value === currentQuestion.correctAnswer
    const nextCorrect = correctCount + (isCorrect ? 1 : 0)
    const nextWrong = wrongCount + (isCorrect ? 0 : 1)
    if (isCorrect) setCorrectCount(nextCorrect)
    else setWrongCount(nextWrong)

    const qid = currentQuestion.id
    const nextAnswers = [...answers, { questionId: qid, answer: value }]
    setAnswers(nextAnswers)
    answersRef.current = nextAnswers

    const shouldFinish = nextWrong > WRONG_LIMIT

    if (shouldFinish) {
      try {
        setSubmitting(true)
        await submitAndGoResult(nextAnswers)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '提交失败'
        Taro.showToast({ title: msg, icon: 'none' })
      } finally {
        setSubmitting(false)
      }
      return
    }

    // 调用 getVocabNext 获取下一题
    try {
      setSubmitting(true)
      const res = await getVocabNext({
        lastQuestionId: qid,
        correct: isCorrect,
        currentDifficultyScore: currentQuestion.difficultyScore ?? 0,
        answeredIds: nextAnswers.map((a) => a.questionId),
      })
      if (res.code === 200 && res.data) {
        const nextQ: VocabQuestion | null = res.data.question || res.data
        if (nextQ && nextQ.id) {
          setQuestions((prev) => [...prev, nextQ])
          setCurrentIndex((prev) => prev + 1)
          setSelectedAnswer(null)
        } else {
          // 无下一题,提交
          await submitAndGoResult(nextAnswers)
        }
      } else {
        // 接口异常,提交已有答案
        await submitAndGoResult(nextAnswers)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载下一题失败'
      Taro.showToast({ title: msg, icon: 'none' })
      // 失败时也尝试提交
      try {
        await submitAndGoResult(nextAnswers)
      } catch {
        /* ignore */
      }
    } finally {
      setSubmitting(false)
    }
  }

  const options = useMemo(() => {
    if (!currentQuestion) return []
    const opts = parseOptions(currentQuestion.options)
    return shuffle(opts)
      .map((label) => ({ label, value: label }))
      .concat([{ label: '不认识', value: '不认识' }])
  }, [currentQuestion])

  const progress =
    questions.length > 0 ? Math.round(((currentIndex + 1) / Math.max(questions.length, currentIndex + 1)) * 100) : 0

  return (
    <View className="vtt">
      {/* 顶部导航 */}
      <View className="vtt__nav">
        <View className="vtt__nav-back" onClick={handleBack}>
          <ArrowLeft size={20} color="#37352f" />
        </View>
        <Text className="vtt__nav-title">词汇量测试</Text>
        <View className="vtt__nav-placeholder" />
      </View>

      {/* 进度条 */}
      <View className="vtt__progress">
        <Text className="vtt__progress-num">
          {questions.length > 0 ? String(currentIndex + 1).padStart(2, '0') : '--'}
        </Text>
        <View className="vtt__progress-bar">
          <View className="vtt__progress-fill" style={{ width: `${progress}%` }} />
        </View>
        <View className="vtt__progress-close" onClick={handleQuit}>
          <Close size={20} color="#787671" />
        </View>
      </View>

      {showWarning && !busy ? (
        <Text className="vtt__warning">超过 8 秒，建议选「不认识」</Text>
      ) : null}

      <ScrollView className="vtt__body" scrollY enableFlex>
        {/* 题目卡片 */}
        <View className="vtt__question-card">
          {busy || !currentQuestion ? (
            <Text className="vtt__loading-text">加载中…</Text>
          ) : (
            <View className="vtt__question-inner">
              <Text className="vtt__word">{currentQuestion.word}</Text>
              {currentQuestion.audioUrl ? (
                <View className="vtt__audio-btn" onClick={handlePlayAudio}>
                  <Text className="vtt__audio-text">播放</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* 选项 */}
        <View className="vtt__options">
          {options.map((option, index) => (
            <CloudButton
              key={index}
              variant={option.label === '不认识' ? 'secondary' : 'outline'}
              className={`vtt__option ${selectedAnswer === option.value ? 'vtt__option--selected' : ''} ${busy ? 'vtt__option--disabled' : ''}`}
              disabled={busy || !currentQuestion}
              onClick={() => handleAnswerSelect(option.value)}
            >
              <Text className="vtt__option-text">{option.label}</Text>
            </CloudButton>
          ))}
        </View>
      </ScrollView>

      {/* 底部统计 */}
      <View className="vtt__footer">
        <View className="vtt__stat">
          <Text className="vtt__stat-value">{correctCount}</Text>
          <Text className="vtt__stat-label">正确</Text>
        </View>
        <View className="vtt__stat-divider" />
        <View className="vtt__stat">
          <Text className="vtt__stat-value">{wrongCount}</Text>
          <Text className="vtt__stat-label">错误</Text>
        </View>
        <View className="vtt__stat-divider" />
        <View className="vtt__stat">
          <Text className="vtt__stat-value vtt__stat-value--accent">{timer}s</Text>
          <Text className="vtt__stat-label">倒计时</Text>
        </View>
      </View>
    </View>
  )
}
