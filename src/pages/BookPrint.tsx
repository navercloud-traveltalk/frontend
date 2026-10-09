import { useEffect, useRef, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Button } from '../components'
import s from './BookPrint.module.css'

/** 사진이 끝내 안 오더라도 인쇄 창은 띄운다 */
const IMAGE_WAIT_MS = 10000

/** 문서 안의 사진·글꼴이 모두 준비될 때까지 기다린다(덜 받은 채 인쇄하면 빈칸으로 나온다) */
async function waitForAssets(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img')).filter((im) => !im.complete)
  const loaded = Promise.all(imgs.map((im) => new Promise<void>((r) => {
    im.addEventListener('load', () => r(), { once: true })
    im.addEventListener('error', () => r(), { once: true })
  })))
  await Promise.race([loaded, new Promise((r) => setTimeout(r, IMAGE_WAIT_MS))])
  await document.fonts.ready
}

/**
 * /books/:id/print — 책 한 권(표지·목차·모든 챕터)을 인쇄용으로 펼친다.
 * 준비되면 브라우저 인쇄 창을 열고, 사용자가 대상에서 「PDF로 저장」을 고르면 PDF 가 된다(서버 변환 없음).
 */
export default function BookPrint() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const book = useQuery({ queryKey: ['book', id], queryFn: () => api.getBook(id) })
  const b = book.data
  // 리더와 같은 캐시 키라 이미 읽은 챕터는 다시 받지 않는다
  const chapters = useQueries({
    queries: (b?.chapters ?? []).map((c) => ({ queryKey: ['chapter-content', id, c.n], queryFn: () => api.getBookChapter(id, c.n) })),
  })
  const loaded = !!b && chapters.every((q) => q.data)
  const failed = book.isError || chapters.some((q) => q.isError)

  const root = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const printedOnce = useRef(false)

  useEffect(() => {
    if (!loaded || !root.current) return
    let alive = true
    void waitForAssets(root.current).then(() => alive && setReady(true))
    return () => { alive = false }
  }, [loaded])

  // 저장되는 PDF 파일 이름이 책 제목이 되도록 문서 제목을 잠시 바꾼다
  useEffect(() => {
    if (!b) return
    const prev = document.title
    document.title = b.title
    return () => { document.title = prev }
  }, [b])

  // 준비되면 한 번은 저절로 인쇄 창을 연다. 닫은 뒤에는 「PDF로 저장」 버튼으로 다시 연다.
  useEffect(() => {
    if (!ready || printedOnce.current) return
    printedOnce.current = true
    window.print()
  }, [ready])

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <button type="button" className={s.back} onClick={() => nav(`/books/${id}`)} aria-label="책으로"><img src="/img/chevron-left.svg" width={24} height={24} alt="" /></button>
        <div className={s.toolText}>
          <p className={s.toolTitle}>PDF로 내보내기</p>
          <p className={s.toolHint}>{failed ? '책을 불러오지 못했어요.' : ready ? '인쇄 창의 대상에서 「PDF로 저장」을 고르세요.' : '책을 한 권으로 모으는 중이에요…'}</p>
        </div>
        {failed
          ? <Button className={s.toolBtn} onClick={() => { void book.refetch(); chapters.forEach((q) => q.isError && q.refetch()) }}>다시 시도</Button>
          : <Button className={s.toolBtn} disabled={!ready} onClick={() => window.print()}>PDF로 저장</Button>}
      </div>

      {b && (
        <div ref={root} className={s.doc}>
          <section className={s.cover}>
            {b.coverPhotoUrl && <img className={s.coverPhoto} src={b.coverPhotoUrl} alt="" />}
            <h1 className={s.coverTitle}>{b.title}</h1>
            <p className={s.coverSub}>{b.place} · {b.dateRange}</p>
            <p className={s.coverStats}>{b.stats.days}일 · 챕터 {b.stats.chapters}개 · 사진 {b.stats.photos}장 · 목소리 {b.stats.voiceMinutes}분</p>
          </section>

          <section className={s.toc}>
            <h2>목차</h2>
            {b.chapters.map((c) => (
              <p key={c.n} className={s.tocItem}><span>{String(c.n).padStart(2, '0')}</span>{c.day}일차 · {c.title}</p>
            ))}
          </section>

          {chapters.map((q, i) => {
            const c = q.data
            if (!c) return null
            return (
              <section key={c.n ?? i} className={s.chapter}>
                <p className={s.label}>{c.label}</p>
                <h2 className={s.title}>{c.title}</h2>
                {c.photoUrl && (
                  <figure className={s.figure}>
                    <img src={c.photoUrl} alt="" />
                    {c.photoCaption && <figcaption>{c.photoCaption}</figcaption>}
                  </figure>
                )}
                <div className={s.text}>
                  {/* 서버 문장에는 사이 공백이 없다(리더와 같이 화면에서 넣는다) */}
                  {c.paragraphs.map((p, j) => <p key={j}>{p.sentences.map((st) => st.text).join(' ')}</p>)}
                </div>
                {c.pullQuote && <blockquote className={s.quote}>{c.pullQuote.text}</blockquote>}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
