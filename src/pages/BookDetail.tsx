import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { BookCover, Button, CoverSheet, Icon, RestyleSheet, Screen, Toast } from '../components'
import { BottomSheet } from '../components/BottomSheet'
import s from './BookDetail.module.css'

/** /books/:id — 책 상세 */
export default function BookDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['book', id], queryFn: () => api.getBook(id) })
  const [sheet, setSheet] = useState<null | 'style' | 'pdf' | 'cover'>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const say = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2200) }
  const b = q.data

  const makePdf = async () => {
    setPdfBusy(true)
    await new Promise((r) => setTimeout(r, 1500)) // 시연용: 실제 PDF 변환은 서버 담당
    setPdfBusy(false)
    setSheet(null)
    say('PDF가 준비됐어요')
  }

  return (
    <Screen>
      <div className={s.head}>
        <button type="button" onClick={() => nav('/')} aria-label="책장으로"><img src="/img/chevron-left.svg" width={24} height={24} alt="" /></button>
        <h1>{b?.title ?? ' '}</h1>
      </div>
      {q.isError ? (
        <div className={s.state}><p>책을 불러오지 못했어요.<br />책은 책장에 그대로 있어요.</p><Button onClick={() => q.refetch()}>다시 시도</Button></div>
      ) : !b ? (
        <div className={s.state}><p>책을 펼치는 중이에요…</p></div>
      ) : (
        <>
          <div className={s.content}>
            <div className={s.cover}>
              <BookCover type={b.coverType} color={b.coverColor} title={b.title} subtitle={`${b.place} · ${b.dateRange.slice(0, 7)}`} photoUrl={b.coverPhotoUrl} width={156} height={220} />
            </div>
            <div className={s.meta}>
              {[`${b.stats.days}일`, `챕터 ${b.stats.chapters}개`, `사진 ${b.stats.photos}장`, `목소리 ${b.stats.voiceMinutes}분`].map((t) => (
                <div key={t} className={s.stat}><p>{t}</p><i /></div>
              ))}
            </div>
            <div className={s.toc}>
              <h2>목차</h2>
              {b.chapters.map((c) => (
                <button key={c.n} type="button" className={s.item} onClick={() => nav(`/books/${id}/read?n=${c.n}`)}>
                  <span className={s.no}>{String(c.n).padStart(2, '0')}</span>
                  <span className={s.itemTitle}>{c.day}일차 · {c.title}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={s.actions}>
            <Button onClick={() => nav(`/books/${id}/read`)}>읽기</Button>
            <div className={s.tools}>
              <button type="button" onClick={() => setSheet('style')}><Icon name="pen-line" size={20} style={{ color: 'var(--teal)' }} /><span>문체 바꾸기</span></button>
              <button type="button" onClick={() => setSheet('pdf')}><Icon name="file-down" size={20} style={{ color: 'var(--teal)' }} /><span>PDF로 내보내기</span></button>
              <button type="button" onClick={() => setSheet('cover')}><Icon name="book-image" size={20} style={{ color: 'var(--teal)' }} /><span>표지 바꾸기</span></button>
            </div>
          </div>
          <RestyleSheet open={sheet === 'style'} bookId={id} onClose={() => setSheet(null)} onDone={() => { setSheet(null); say('문체를 바꿨어요') }} />
          <CoverSheet open={sheet === 'cover'} book={b} onClose={() => setSheet(null)} onDone={() => { setSheet(null); qc.invalidateQueries({ queryKey: ['book', id] }); qc.invalidateQueries({ queryKey: ['bookshelf'] }); say('표지를 바꿨어요') }} />
          <BottomSheet open={sheet === 'pdf'} onClose={() => !pdfBusy && setSheet(null)} title="PDF로 내보내기">
            <p className={s.pdfText}>사진과 이야기를 한 권의 PDF로 만들어 드려요. 1분쯤 걸려요.</p>
            <Button disabled={pdfBusy} onClick={makePdf}>{pdfBusy ? 'PDF를 만드는 중…' : 'PDF 만들기'}</Button>
          </BottomSheet>
        </>
      )}
      <Toast message={toast} />
    </Screen>
  )
}
