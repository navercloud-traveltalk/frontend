import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { BookCover, Button, Screen } from '../components'
import s from './Complete.module.css'

const CONFETTI = [
  { l: 40, t: 127.1, w: 18.417, h: 30.071, r: -14, c: 'var(--red)' },
  { l: 63.35, t: 240, w: 20.065, h: 30.338, r: 18, c: 'var(--teal)' },
  { l: 305.51, t: 170, w: 21.615, h: 30.456, r: 22, c: 'var(--amber)' },
  { l: 340, t: 280.29, w: 20.065, h: 30.338, r: -18, c: 'var(--red)' },
  { l: 49.18, t: 390, w: 17.559, h: 29.883, r: 12, c: 'var(--teal)' },
  { l: 318, t: 418.33, w: 15.78, h: 29.398, r: -8, c: 'var(--amber)' },
]

/** /books/:id/complete — 책 완성 연출 */
export default function Complete() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['book', id], queryFn: () => api.getBook(id) })
  const b = q.data
  const toShelf = () => { qc.invalidateQueries({ queryKey: ['bookshelf'] }); nav('/', { replace: true }) }

  if (q.isError) {
    return (
      <Screen>
        <div className={s.state}>
          <p>책을 불러오지 못했어요.<br />책은 책장에 잘 꽂혀 있어요.</p>
          <Button onClick={() => q.refetch()}>다시 시도</Button>
          <Button variant="outline" onClick={toShelf}>책장으로</Button>
        </div>
      </Screen>
    )
  }
  if (!b) return <Screen><div className={s.state}><p>완성된 책을 펼치는 중이에요…</p></div></Screen>

  return (
    <Screen>
      <div className={s.content}>
        <div className={s.spot} />
        {CONFETTI.map((c, i) => (
          <div key={i} className={s.confetti} style={{ left: c.l, top: c.t, width: c.w, height: c.h }}>
            <span style={{ background: c.c, transform: `rotate(${c.r}deg)` }} />
          </div>
        ))}
        <div className={s.text}>
          <p className={s.kicker}>책이 완성됐어요</p>
          <h1 className={s.title}>{b.title}</h1>
          <p className={s.meta}>{b.place} · {b.dateRange} · {b.stats.chapters}개의 챕터</p>
        </div>
        <BookCover type={b.coverType} color={b.coverColor} title={b.title} subtitle={`${b.place} · ${b.dateRange}`} photoUrl={b.coverPhotoUrl} width={204} height={286} />
        <div className={s.actions}>
          <Button onClick={toShelf}>책장에 꽂기</Button>
          <Button variant="outline" onClick={() => nav(`/books/${id}/read`)}>지금 읽기</Button>
        </div>
      </div>
    </Screen>
  )
}
