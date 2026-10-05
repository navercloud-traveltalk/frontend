import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Book, CoverColor, CoverType } from '../api/types'
import { BookCover } from './BookCover'
import { BottomSheet } from './BottomSheet'
import { Button } from './Button'
import { Chip } from './Chip'
import s from './CoverSheet.module.css'

const TYPES: { v: CoverType; l: string }[] = [{ v: 'photo', l: '사진 띠' }, { v: 'frame', l: '액자' }, { v: 'cloth', l: '천' }, { v: 'type', l: '타이포' }]
const COLORS: { v: CoverColor; l: string }[] = [{ v: 'red', l: '붉은색' }, { v: 'teal', l: '청록' }, { v: 'navy', l: '남색' }]

/** 표지 바꾸기: 4종 × 3색을 고르면 미리 보이고, 적용하면 서버에 저장한다. */
export function CoverSheet({ open, book, onClose, onDone }: { open: boolean; book: Book; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<CoverType>(book.coverType)
  const [color, setColor] = useState<CoverColor>(book.coverColor === 'slate' ? 'navy' : book.coverColor)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { if (open) { setType(book.coverType); setColor(book.coverColor === 'slate' ? 'navy' : book.coverColor); setFailed(false) } }, [open, book])

  const apply = async () => {
    setBusy(true); setFailed(false)
    try {
      await api.updateCover(book.id, { coverType: type, coverColor: color })
      onDone()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  const photo = book.coverPhotoUrl ?? '/img/cover-main.png'
  return (
    <BottomSheet open={open} onClose={() => !busy && onClose()} title="표지 바꾸기">
      <div className={s.preview}>
        <BookCover type={type} color={color} title={book.title} subtitle={`${book.place} · ${book.dateRange.slice(0, 7)}`} photoUrl={photo} width={117} height={148} titleSize={13} />
      </div>
      <p className={s.label}>표지 종류</p>
      <div className={s.chips}>{TYPES.map((t) => <Chip key={t.v} selected={type === t.v} onClick={() => setType(t.v)}>{t.l}</Chip>)}</div>
      {type !== 'photo' && (<><p className={s.label}>표지 색</p><div className={s.chips}>{COLORS.map((c) => <Chip key={c.v} selected={color === c.v} onClick={() => setColor(c.v)}>{c.l}</Chip>)}</div></>)}
      {failed && <p className={s.err}>표지를 바꾸지 못했어요. 지금 표지는 그대로예요.</p>}
      <Button disabled={busy} onClick={apply}>{busy ? '표지를 바꾸는 중…' : failed ? '다시 시도' : '이 표지로 바꾸기'}</Button>
    </BottomSheet>
  )
}
