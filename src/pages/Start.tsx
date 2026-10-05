import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { saveSession } from '../lib/session'
import { Screen } from '../components'
import s from './Start.module.css'

export default function Start() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const trimmed = name.trim()

  const create = useMutation({
    mutationFn: () => api.createUser(trimmed),
    onSuccess: (u) => {
      saveSession({ userId: u.userId, nickname: u.nickname })
      nav('/', { replace: true })
    },
  })

  const empty = trimmed.length === 0
  const showError = touched && empty
  const submit = () => {
    setTouched(true)
    if (!empty && !create.isPending) create.mutate()
  }

  return (
    <Screen>
      <div className={s.content}>
        <div className={s.brand}>
          <h1 className={s.logo}>여행말</h1>
          <p className={s.tagline}>사진과 목소리가 한 권의 여행책이 됩니다</p>
          <div className={s.art}>
            <img src="/img/start-book.svg" width={196} height={86} alt="" />
          </div>
        </div>

        <form className={s.form} onSubmit={(e) => { e.preventDefault(); submit() }}>
          <label className={s.label} htmlFor="nickname">뭐라고 불러 드릴까요?</label>
          <input
            id="nickname"
            className={[s.input, !empty && s.filled, showError && s.invalid].filter(Boolean).join(' ')}
            value={name}
            maxLength={12}
            placeholder="닉네임"
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          <div className={s.guide}>
            {create.isError ? (
              <p className={s.error}>책장을 만들지 못했어요. 입력한 이름은 그대로 있어요. 다시 시도해 주세요.</p>
            ) : showError ? (
              <p className={s.error}>닉네임을 한 글자 이상 입력해 주세요</p>
            ) : (
              <>
                {!empty && <p className={s.preview}>{trimmed}님의 책장</p>}
                <p className={s.hint}>책장에 이 이름이 적혀요. 나중에 바꿀 수 있어요.</p>
              </>
            )}
          </div>
          <button type="submit" className={s.submit} disabled={empty || create.isPending}>
            {create.isPending ? '책장을 만드는 중…' : create.isError ? '다시 시도' : '책장 만들기'}
          </button>
        </form>

        <div className={s.spacer} />
        <p className={s.footer}>가입이나 로그인 없이 바로 시작해요</p>
      </div>
    </Screen>
  )
}
