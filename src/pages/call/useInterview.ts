import { useCallback, useEffect, useReducer, useRef } from 'react'
import { api, ApiError } from '../../api'
import type { Question } from '../../api/types'
import { callReducer, initialCall } from './callReducer'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/** 한 답변은 최대 55초 (음성 인식 API가 60초까지만 받는다) */
const MAX_ANSWER_MS = 55_000
/** 무음이 이만큼 이어지면 자동 종료 */
const SILENCE_MS = 2_000
/** 소리가 이만큼 크면 말하는 중으로 본다 (RMS 0–1) */
const MIN_VOICE_LEVEL = 0.03

/** 질문 음성이 없을 때(음성 합성 실패) 글을 읽을 시간: 글자당 0.12초, 2~8초 */
const readingMs = (text: string) => Math.min(8_000, Math.max(2_000, text.length * 120))

/** 녹음 자체가 문제라 다시 보내도 같은 결과인 오류 → 녹음을 버리고 다시 듣는다 */
const RECORD_AGAIN_CODES = new Set(['AUDIO_INVALID', 'AUDIO_TOO_LONG', 'AUDIO_REQUIRED'])

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m))
}

export function useInterview(tripId: string, day: number) {
  const [state, dispatch] = useReducer(callReducer, initialCall)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timersRef = useRef<{ poll?: number; max?: number; auto?: number }>({})
  const questionRef = useRef<Question | null>(null)
  const lastBlobRef = useRef<Blob | null>(null)
  const noMicRef = useRef(false)
  const sheetRef = useRef(false)
  const pendingRef = useRef<Question | 'wrap' | null>(null)
  const momentsRef = useRef<string[]>([])
  /** submit 이 beginListening 보다 먼저 정의돼서 참조로 부른다 */
  const beginListeningRef = useRef<() => void>(() => {})
  const aliveRef = useRef(true)

  const clearTimers = () => {
    const t = timersRef.current
    window.clearInterval(t.poll)
    window.clearTimeout(t.max)
    window.clearTimeout(t.auto)
    timersRef.current = {}
  }

  /** 녹음을 버리고 멈춘다 (다시 듣기·건너뛰기·끊기 확인 때) */
  const discardRecording = useCallback(() => {
    clearTimers()
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null
      rec.stop()
    }
    recRef.current = null
    chunksRef.current = []
  }, [])

  const stopAll = useCallback(() => {
    discardRecording()
    audioRef.current?.pause()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
  }, [discardRecording])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      stopAll()
    }
  }, [stopAll])

  // 통화 시간
  useEffect(() => {
    if (state.phase === 'incoming' || state.phase === 'wrapUp') return
    const id = window.setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => window.clearInterval(id)
  }, [state.phase])

  const submit = useCallback(
    async (blob: Blob | null) => {
      lastBlobRef.current = blob
      dispatch({ type: 'THINKING' })
      try {
        const res = await api.answerInterview(tripId, day, blob, questionRef.current?.index)
        if (!aliveRef.current) return
        // 건너뛴 질문(skip 요청 또는 전사가 빈 답변)은 답한 질문으로 세지 않는다
        if (blob !== null && !res.skipped) dispatch({ type: 'ANSWERED' })
        lastBlobRef.current = null
        if (res.next) {
          if (sheetRef.current) pendingRef.current = res.next
          else playQuestion(res.next)
        } else {
          momentsRef.current = res.moments ?? []
          if (sheetRef.current) pendingRef.current = 'wrap'
          else finish(res.moments ?? [])
        }
      } catch (e) {
        if (!aliveRef.current) return
        if (e instanceof ApiError && e.status === 400 && e.code && RECORD_AGAIN_CODES.has(e.code)) {
          lastBlobRef.current = null
          dispatch({ type: 'RECORD_AGAIN', message: e.message })
          if (!sheetRef.current) beginListeningRef.current()
          return
        }
        dispatch({ type: 'SEND_ERROR' })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tripId, day],
  )

  const stopRecording = useCallback(() => {
    clearTimers()
    const rec = recRef.current
    if (!rec) {
      // 마이크 없이 체험하는 중
      void submit(new Blob([], { type: 'audio/webm' }))
      return
    }
    if (rec.state === 'inactive') return
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
      recRef.current = null
      chunksRef.current = []
      void submit(blob)
    }
    rec.stop()
  }, [submit])

  const beginListening = useCallback(() => {
    if (!aliveRef.current) return
    dispatch({ type: 'LISTENING' })
    const stream = streamRef.current
    if (!stream || noMicRef.current) {
      // mock 체험: 말한 척 2.5초 뒤 자동으로 넘어간다
      timersRef.current.auto = window.setTimeout(() => stopRecording(), 5500)
      return
    }
    const mime = pickMime()
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    chunksRef.current = []
    rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
    rec.start(250)
    recRef.current = rec

    // 무음 2초 감지
    const ctx = ctxRef.current ?? new AudioContext()
    ctxRef.current = ctx
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    src.connect(analyser)
    const buf = new Uint8Array(analyser.fftSize)
    let voiced = false
    let silentFor = 0
    timersRef.current.poll = window.setInterval(() => {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += ((v - 128) / 128) ** 2
      const rms = Math.sqrt(sum / buf.length)
      if (rms > MIN_VOICE_LEVEL) {
        if (!voiced) dispatch({ type: 'HEARD' })
        voiced = true
        silentFor = 0
      } else if (voiced) {
        silentFor += 100
        if (silentFor >= SILENCE_MS) stopRecording()
      }
    }, 100)
    timersRef.current.max = window.setTimeout(() => stopRecording(), MAX_ANSWER_MS)
  }, [stopRecording])
  beginListeningRef.current = beginListening

  const playQuestion = useCallback(
    (q: Question) => {
      questionRef.current = q
      dispatch({ type: 'AI_SPEAKING', question: q })
      const audio = audioRef.current ?? new Audio()
      audioRef.current = audio
      const done = () => {
        audio.onended = null
        audio.onerror = null
        if (!sheetRef.current) beginListening()
      }
      if (!q.audioUrl) {
        // 질문 음성을 못 만든 경우: 글을 읽을 시간을 준 뒤 듣기로 넘어간다
        audio.pause()
        timersRef.current.auto = window.setTimeout(done, readingMs(q.text))
        return
      }
      audio.onended = done
      audio.onerror = done
      audio.src = q.audioUrl
      // 재생이 막히면 멈추지 않고 곧바로 듣기로 넘어간다
      audio.play().catch(() => window.setTimeout(done, 1200))
    },
    [beginListening],
  )

  const finish = useCallback(
    (moments: string[]) => {
      stopAll()
      dispatch({ type: 'WRAP_UP', moments })
    },
    [stopAll],
  )

  /** "받기": 이 클릭 안에서 마이크 권한 요청 + 오디오 잠금 해제 */
  const accept = useCallback(
    async (opts?: { withoutMic?: boolean }) => {
      dispatch({ type: 'START' })
      // 브라우저는 사용자 동작 없이는 소리를 못 내므로, 클릭 순간에 오디오 요소를 재생해 둔다
      const audio = audioRef.current ?? new Audio()
      audioRef.current = audio
      audio.src = SILENT_WAV
      void audio.play().catch(() => {})
      try {
        ctxRef.current = new AudioContext()
        void ctxRef.current.resume()
      } catch {
        /* AudioContext 없는 환경: 무음 감지만 포기하고 55초 제한으로 동작 */
      }

      noMicRef.current = !!opts?.withoutMic
      if (!opts?.withoutMic) {
        try {
          if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
          streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        } catch (e) {
          const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
          dispatch({
            type: 'MIC_ERROR',
            message: denied
              ? '마이크 사용이 허용되지 않았어요. 주소창 옆 자물쇠에서 마이크를 허용한 뒤 다시 받아 주세요.'
              : '이 기기나 브라우저에서는 마이크를 쓸 수 없어요. 다른 브라우저로 열거나 마이크를 확인해 주세요.',
          })
          return
        }
      }

      try {
        const { question, answered } = await api.startInterview(tripId, day)
        // 이어 하기: 서버가 첫 미답변 질문부터 돌려주고, 이미 답한 수를 알려 준다
        if (aliveRef.current) {
          dispatch({ type: 'SET_ANSWERED', count: answered ?? 0 })
          playQuestion(question)
        }
      } catch (e) {
        if (!aliveRef.current) return
        if (e instanceof ApiError && e.code === 'INTERVIEW_ENDED') dispatch({ type: 'ALREADY_ENDED' })
        else dispatch({ type: 'START_ERROR', message: e instanceof ApiError && e.code ? e.message : undefined })
      }
    },
    [tripId, day, playQuestion],
  )

  const replay = useCallback(() => {
    const q = questionRef.current
    if (!q) return
    discardRecording()
    audioRef.current?.pause()
    playQuestion(q)
  }, [discardRecording, playQuestion])

  const skip = useCallback(() => {
    discardRecording()
    audioRef.current?.pause()
    void submit(null)
  }, [discardRecording, submit])

  const retrySend = useCallback(() => {
    void submit(lastBlobRef.current)
  }, [submit])

  const openHangup = useCallback(() => {
    sheetRef.current = true
    audioRef.current?.pause()
    discardRecording()
    dispatch({ type: 'SHEET', open: true })
  }, [discardRecording])

  const closeHangup = useCallback(() => {
    sheetRef.current = false
    dispatch({ type: 'SHEET', open: false })
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending === 'wrap') finish(momentsRef.current)
    else if (pending) playQuestion(pending)
    else if (questionRef.current && !state.sendError && state.phase !== 'thinking') playQuestion(questionRef.current)
  }, [finish, playQuestion, state.phase, state.sendError])

  /** 「여기까지 저장하고 마치기」: 서버에 알려 남은 질문을 건너뜀 처리한다(실패해도 마무리 화면은 연다) */
  const saveAndEnd = useCallback(() => {
    sheetRef.current = false
    pendingRef.current = null
    void api.endInterview(tripId, day, 'SAVE_EXIT').catch(() => {})
    finish(momentsRef.current)
  }, [finish, tripId, day])

  /** 「저장하지 않고 나가기」: 서버에 알려 이번 인터뷰의 음성·전사를 지우게 한다 */
  const discard = useCallback(() => {
    sheetRef.current = false
    pendingRef.current = null
    stopAll()
    void api.endInterview(tripId, day, 'DISCARD').catch(() => {})
  }, [stopAll, tripId, day])

  return { state, accept, stopRecording, replay, skip, retrySend, openHangup, closeHangup, saveAndEnd, discard, mock: USE_MOCK }
}
