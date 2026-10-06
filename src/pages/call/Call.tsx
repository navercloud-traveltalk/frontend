import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { mockLiveCaption } from '../../api/mock'
import { Avatar, Icon, SceneCard, Screen, ThinkingDots, Waveform } from '../../components'
import { useInterview } from './useInterview'
import s from './Call.module.css'

const mmss = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

/** 듣는 중 화면에 띄우는 실시간 전사. mock 은 준비된 답을 한 글자씩, 실제는 브라우저 음성 인식이 있을 때만. */
function useCaption(active: boolean, questionIndex: number, mock: boolean) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!active) { setText(''); return }
    if (mock) {
      const full = mockLiveCaption(questionIndex)
      let i = 0
      const id = window.setInterval(() => { i += 1; setText(full.slice(0, i)); if (i >= full.length) window.clearInterval(id) }, 110)
      return () => window.clearInterval(id)
    }
    const Rec = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
    if (!Rec) return
    const r = new Rec()
    r.lang = 'ko-KR'; r.interimResults = true; r.continuous = true
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(' '))
    r.onerror = () => {}
    try { r.start() } catch { /* 이미 시작됨 */ }
    return () => { r.onresult = null; try { r.stop() } catch { /* noop */ } }
  }, [active, questionIndex, mock])
  return text
}
interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  start(): void; stop(): void
}

export default function Call() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const trip = useQuery({ queryKey: ['trip', id], queryFn: () => api.getTrip(id) })
  const day = trip.data?.day ?? 1
  const scenes = useQuery({ queryKey: ['scenes', id, day], queryFn: () => api.getScenes(id, day), enabled: !!trip.data })
  const { state: c, accept, stopRecording, replay, skip, retrySend, openHangup, closeHangup, saveAndEnd, discard, mock } = useInterview(id, day)
  const caption = useCaption(c.phase === 'listening', c.question?.index ?? 0, mock)

  const photoCount = scenes.data?.scenes.reduce((n, sc) => n + sc.photoCount, 0)

  if (c.phase === 'incoming') return <Incoming c={c} accept={accept} mock={mock} photoCount={photoCount} onLater={() => nav('/')} />
  if (c.phase === 'wrapUp') return <WrapUp id={id} day={day} c={c} sceneCount={scenes.data?.scenes.length ?? 0} />

  const q = c.question
  const last = !!q && q.index === q.total
  const label = c.phase === 'aiSpeaking' ? (last ? '마지막 질문이에요' : 'AI가 말하는 중') : c.phase === 'listening' ? '듣고 있어요' : '생각하는 중'
  const remaining = (q?.total ?? 0) - c.answered

  return (
    <Screen tone="dark">
      <div className={s.body}>
        <div className={s.head}>
          <p className={s.live}>통화 중 · {mmss(c.elapsed)}</p>
          <p className={s.count}>질문 {q?.index ?? 1} / {q?.total ?? 5}</p>
        </div>
        <Avatar size={68} />
        <div className={s.status}>
          <p className={[s.label, c.phase === 'listening' && s.labelTeal].filter(Boolean).join(' ')}>{label}</p>
          {c.phase === 'aiSpeaking' && <Waveform tone="amber" active />}
          {c.phase === 'listening' && <Waveform tone="teal" active={c.heard} />}
          {c.phase === 'thinking' && <ThinkingDots />}
        </div>

        {q && <div className={s.bubble}><p>{q.text}</p></div>}

        {q?.sceneRef && (
          <div className={s.ref}>
            <p className={s.refLabel}>질문 근거 장면</p>
            <SceneCard gap={q.sceneRef.gap} head={q.sceneRef.head} title={q.sceneRef.title} note={q.sceneRef.note} thumbs={q.sceneRef.thumbs} />
          </div>
        )}

        {c.recordError && c.phase === 'listening' && (
          <div className={s.error} role="alert">
            <p>{c.recordError}</p>
          </div>
        )}

        {c.phase === 'listening' && (
          <div className={s.live2}>
            <p className={s.caption}>{caption || '말씀해 주세요'}</p>
            <p className={s.hint}>{c.heard || mock ? '말이 끝나면 자동으로 넘어가요' : '말씀이 들리면 자동으로 이어져요. 소리가 안 들리면 마이크를 확인해 주세요'}</p>
            <button type="button" className={s.done} onClick={stopRecording}>다 말했어요</button>
          </div>
        )}

        {c.sendError && (
          <div className={s.error}>
            <p>답변을 보내지 못했어요. 녹음은 이 기기에 그대로 남아 있어요.</p>
            <button type="button" onClick={retrySend}>다시 보내기</button>
          </div>
        )}

        <div className={s.actions}>
          <div className={s.sub}>
            <button type="button" onClick={replay} disabled={!q || c.phase === 'thinking'}>다시 듣기</button>
            <button type="button" onClick={skip} disabled={!q || c.phase === 'thinking'}>이 질문 건너뛰기</button>
          </div>
          <button type="button" className={s.hangup} onClick={openHangup} aria-label="통화 끊기"><Icon name="phone-off-25" size={25} /></button>
        </div>
      </div>

      {c.sheetOpen && (
        <div className={s.sheetRoot}>
          <div className={s.dim} onClick={closeHangup} />
          <div className={s.sheet} role="dialog" aria-modal="true" aria-label="인터뷰 종료 확인">
            <span className={s.handle} />
            <div className={s.sheetBody}>
              <div className={s.sheetText}>
                <p className={s.sheetTitle}>인터뷰를 여기서 마칠까요?</p>
                <p className={s.sheetDesc}>지금까지 답한 질문 {c.answered}개는 저장돼요. 남은 질문 {Math.max(0, remaining)}개는 건너뛰어요.</p>
              </div>
              <div className={s.sheetActions}>
                <button type="button" className={s.sheetPrimary} onClick={saveAndEnd}>여기까지 저장하고 마치기</button>
                <button type="button" className={s.sheetOutline} onClick={closeHangup}>계속 이야기하기</button>
                <button type="button" className={s.sheetExit} onClick={() => { discard(); nav('/') }}>저장하지 않고 나가기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Screen>
  )
}

function Incoming({ c, accept, mock, photoCount, onLater }: { c: ReturnType<typeof useInterview>['state']; accept: (o?: { withoutMic?: boolean }) => void; mock: boolean; photoCount?: number; onLater: () => void }) {
  const now = new Date()
  const h = now.getHours()
  const clock = `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`
  return (
    <Screen tone="dark">
      <div className={s.incoming}>
        <p className={s.clock}>{clock}</p>
        <div className={s.caller}>
          <Avatar size={132} />
          <div className={s.callerText}>
            <p className={s.callerName}>여행말 인터뷰어</p>
            <p className={s.callerSub}>{photoCount ? `오늘 사진 ${photoCount}장을 봤어요` : '오늘 사진을 봤어요'}</p>
            <p className={s.callerAsk}>이야기 들려주실래요?</p>
          </div>
          {(c.micError || c.startError) && (
            <div className={s.notice} role="alert">
              <p>{c.micError ?? c.startErrorMessage ?? '인터뷰를 시작하지 못했어요. 올린 사진과 장면은 그대로 저장돼 있어요. 다시 받아 주세요.'}</p>
              {c.micError && mock && <button type="button" onClick={() => accept({ withoutMic: true })}>마이크 없이 체험하기</button>}
            </div>
          )}
        </div>
        <div className={s.incomingActions}>
          <div className={s.round}>
            <button type="button" className={[s.circle, s.decline].join(' ')} onClick={onLater} aria-label="나중에"><Icon name="phone-off-28" size={28} /></button>
            <span>나중에</span>
          </div>
          <div className={s.round}>
            <button type="button" className={[s.circle, s.accept].join(' ')} onClick={() => accept()} disabled={c.starting} aria-label="받기"><Icon name="phone-28" size={28} /></button>
            <span>{c.starting ? '연결 중…' : c.micError || c.startError ? '다시 받기' : '받기'}</span>
          </div>
        </div>
      </div>
    </Screen>
  )
}

function WrapUp({ id, day, c, sceneCount }: { id: string; day: number; c: ReturnType<typeof useInterview>['state']; sceneCount: number }) {
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const make = async () => {
    setBusy(true); setErr(false)
    try {
      const { jobId } = await api.createChapter(id, day)
      nav(`/trips/${id}/today/writing`, { replace: true, state: { jobId } })
    } catch {
      setErr(true); setBusy(false)
    }
  }
  const min = Math.floor(c.elapsed / 60)
  const sec = c.elapsed % 60
  return (
    <Screen tone="dark">
      <div className={s.wrap}>
        <p className={s.live}>통화 종료 · {mmss(c.elapsed)}</p>
        <div className={s.wrapMain}>
          <div className={s.wrapSummary}>
            <Avatar size={68} />
            <div className={s.wrapText}>
              <p className={s.wrapTitle}>{c.alreadyEnded ? '오늘 인터뷰는 이미 마쳤어요' : '오늘 인터뷰는 여기까지예요'}</p>
              <p className={s.wrapSub}>들려주신 이야기로 오늘의 챕터를 쓸게요</p>
            </div>
            {!c.alreadyEnded && (
              <div className={s.stats}>
                <span>질문 {c.answered}개</span><i />
                <span>{min}분 {sec}초</span><i />
                <span>장면 {sceneCount}개</span>
              </div>
            )}
            {c.moments.length > 0 && <div className={s.moments}>{c.moments.map((m) => <span key={m}>{m}</span>)}</div>}
          </div>
          <div className={s.wrapBottom}>
            {err && <p className={s.wrapErr}>챕터를 만들지 못했어요. 인터뷰 내용은 저장돼 있어요.</p>}
            <button type="button" className={s.make} onClick={make} disabled={busy}>{busy ? '챕터를 만드는 중…' : err ? '다시 시도' : '오늘의 챕터 만들기'}</button>
          </div>
        </div>
      </div>
    </Screen>
  )
}
