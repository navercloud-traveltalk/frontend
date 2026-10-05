import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Evidence } from '../api/types'
import { Button, Icon, RestyleSheet, Screen, Toast } from '../components'
import { BottomSheet } from '../components/BottomSheet'
import { getSettings, saveSettings } from '../lib/settings'
import { playVoice, stopVoice } from '../lib/voice'
import s from './Reader.module.css'

const SIZES: { v: 15 | 17 | 19; l: string }[] = [{ v: 15, l: '작게' }, { v: 17, l: '보통' }, { v: 19, l: '크게' }]
const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`

/** /books/:id/read — 리더. 밑줄 친 문장을 누르면 근거 시트가 열린다. */
export default function Reader() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [sp, setSp] = useSearchParams()
  const n = Number(sp.get('n') ?? 1)
  const q = useQuery({ queryKey: ['chapter-content', id, n], queryFn: () => api.getBookChapter(id, n) })
  const c = q.data

  const [evidence, setEvidence] = useState<Evidence | null>(null)
  const [sheet, setSheet] = useState<null | 'style' | 'size'>(null)
  const [fs, setFs] = useState(getSettings().fontSize)
  const [marked, setMarked] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const touch = useRef<number | null>(null)

  useEffect(() => () => stopVoice(), [])
  useEffect(() => { setEvidence(null); stopVoice(); setPlaying(null) }, [n])

  const say = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2000) }
  const go = (to: number) => { if (c && to >= 1 && to <= c.total) setSp({ n: String(to) }, { replace: true }) }

  const play = async (key: string, url: string, text: string) => {
    if (playing === key) { stopVoice(); setPlaying(null); return }
    setPlaying(key)
    try {
      await playVoice(url, text)
    } catch {
      say('음성을 재생하지 못했어요')
    } finally {
      setPlaying((p) => (p === key ? null : p))
    }
  }

  return (
    <Screen>
      <div
        className={s.page}
        style={{ ['--fs' as string]: `${fs}px`, opacity: evidence || sheet ? 0.46 : 1 }}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
        onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 60) go(n + (dx < 0 ? 1 : -1)) }}
      >
        <div className={s.bar}>
          <button type="button" onClick={() => nav(`/books/${id}`)} aria-label="책 상세로"><img src="/img/chevron-left.svg" width={24} height={24} alt="" /></button>
          <button type="button" className={s.aa} onClick={() => setSheet('size')} aria-label="글자 크기">Aa</button>
          <button type="button" onClick={() => { setMarked((m) => !m); say(marked ? '책갈피를 뺐어요' : '책갈피를 꽂았어요') }} aria-label="책갈피" aria-pressed={marked}>
            <Icon name="bookmark" size={22} style={{ color: marked ? 'var(--red)' : 'var(--ink)' }} />
          </button>
        </div>

        {q.isError ? (
          <div className={s.state}><p>이 쪽을 불러오지 못했어요.<br />책은 그대로 저장돼 있어요.</p><Button onClick={() => q.refetch()}>다시 시도</Button></div>
        ) : !c ? (
          <div className={s.state}><p>페이지를 펼치는 중이에요…</p></div>
        ) : (
          <>
            <div className={s.titleBox}>
              <p className={s.label}>{c.label}</p>
              <h1 className={s.title}>{c.title}</h1>
            </div>
            {c.photoUrl && <div className={s.photo} style={{ backgroundImage: `url(${c.photoUrl})` }} />}
            {c.photoCaption && <p className={s.caption}>{c.photoCaption}</p>}
            <div className={s.text}>
              {c.paragraphs.map((p, i) => (
                <p key={i}>
                  {p.sentences.map((st, j) =>
                    st.evidence ? (
                      <span key={j} role="button" tabIndex={0} className={s.ev} onClick={() => setEvidence(st.evidence!)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setEvidence(st.evidence!)}>{st.text}</span>
                    ) : (
                      <span key={j}>{st.text}</span>
                    ),
                  )}
                </p>
              ))}
            </div>
            {c.pullQuote && (
              <div className={s.quote}>
                <p className={s.quoteText}>{c.pullQuote.text}</p>
                {c.pullQuote.audioUrl && <button type="button" className={s.voice} onClick={() => play('quote', c.pullQuote!.audioUrl!, c.pullQuote!.transcript)}>
                  <Icon name="play" size={16} />
                  {playing === 'quote' ? '재생 중 · 누르면 멈춰요' : `그때 내 목소리 ${mmss(c.pullQuote.seconds)}`}
                </button>}
              </div>
            )}
            <div className={s.progress}>
              <div className={s.bar3}><span style={{ width: `${(c.page / c.pages) * 100}%` }} /></div>
              <p>{c.page} / {c.pages}</p>
            </div>
          </>
        )}
      </div>

      {/* 이 쪽을 건너뛰는 화살표 (키보드·데스크톱용) */}
      <div className={s.nav} aria-hidden={!c}>
        <button type="button" disabled={!c || n <= 1} onClick={() => go(n - 1)} aria-label="이전 쪽" />
        <button type="button" disabled={!c || n >= (c?.total ?? 1)} onClick={() => go(n + 1)} aria-label="다음 쪽" />
      </div>

      <BottomSheet open={!!evidence} onClose={() => { setEvidence(null); stopVoice(); setPlaying(null) }} title="이 문장의 근거" minHeight={440}>
        {evidence && (
          <div className={s.evBody}>
            {evidence.photoUrl && (
              <div className={s.evPhoto}>
                <span className={s.evImg} style={{ backgroundImage: `url(${evidence.photoUrl})` }} />
                <div className={s.evInfo}><p>{evidence.photoLabel}</p><p>{evidence.photoNote}</p></div>
              </div>
            )}
            {evidence.transcript && (
              <div className={s.evTalk}>
                <div className={s.bubble}>
                  <p>{evidence.transcript}</p>
                  {evidence.audioUrl && (
                    <button type="button" className={s.round} onClick={() => play('ev', evidence.audioUrl!, evidence.transcript ?? '')} aria-label="그때 내 목소리 듣기">
                      <Icon name="play" size={16} />
                    </button>
                  )}
                </div>
                <p className={s.interview}>{playing === 'ev' ? '재생 중 · 누르면 멈춰요' : evidence.interviewLabel}</p>
              </div>
            )}
            <p className={s.principle}>여행말은 사진과 내가 한 말에 있는 내용만 씁니다.</p>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={sheet === 'size'} onClose={() => setSheet(null)} title="글자 크기">
        <div className={s.sizes}>
          {SIZES.map(({ v, l }) => (
            <button key={v} type="button" className={[s.size, fs === v && s.sizeOn].filter(Boolean).join(' ')} onClick={() => { setFs(v); saveSettings({ fontSize: v }) }}>
              <span style={{ fontSize: v }}>가</span>{l}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => setSheet('style')}>문체 바꾸기</Button>
      </BottomSheet>
      <RestyleSheet open={sheet === 'style'} bookId={id} current={c?.style} onClose={() => setSheet(null)} onDone={() => { setSheet(null); qc.invalidateQueries({ queryKey: ['chapter-content', id] }); say('문체를 바꿨어요') }} />
      <Toast message={toast} />
    </Screen>
  )
}


