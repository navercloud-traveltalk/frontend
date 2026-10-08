import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { NextStep } from '../api/types'

const SEGMENT: Record<NextStep, string> = {
  upload: 'upload',
  analyzing: 'upload', // 분석 진행은 업로드 화면이 이어서 보여 준다
  scenes: 'scenes',
  call: 'call',
  writing: 'writing',
  draft: 'draft',
}

/** 일차의 다음 단계 화면 경로 */
export const stepPath = (tripId: string, step: NextStep) => `/trips/${tripId}/today/${SEGMENT[step]}`

/** 서버가 정한 다음 단계로 보내는 경로(/trips/:id/today) */
export const resumePath = (tripId: string) => `/trips/${tripId}/today`

/** 책장 카드 버튼 문구 */
export const STEP_LABEL: Record<NextStep, string> = {
  upload: '오늘 사진 올리기',
  analyzing: '사진 정리 이어 보기',
  scenes: '장면 보고 인터뷰하기',
  call: '인터뷰 이어 하기',
  writing: '이야기 쓰기 이어 하기',
  draft: '오늘의 챕터 다시 보기',
}

/**
 * 여행 정보 + 지금 일차의 진행 상태. 화면에 들어올 때마다 서버에서 새로 받는다(캐시된 옛 단계로 판단하지 않게).
 * allowed 를 주면, 새로 받은 단계가 이 화면이 아닐 때 한 번만 그 단계 화면으로 보낸다(이미 끝낸 단계를 다시 하지 않게).
 */
export function useTripStep(tripId: string, allowed?: NextStep[]) {
  const nav = useNavigate()
  const trip = useQuery({ queryKey: ['trip', tripId], queryFn: () => api.getTrip(tripId), refetchOnMount: 'always' })
  const info = trip.data?.days?.find((d) => d.day === trip.data!.day)
  const fresh = trip.isFetchedAfterMount && !trip.isFetching
  const checked = useRef(false)
  useEffect(() => {
    if (!allowed || checked.current || !fresh || !trip.data) return
    checked.current = true
    // days 가 없는 응답(목 데이터·이전 서버)이면 지금처럼 그대로 둔다
    if (info && !allowed.includes(info.nextStep)) nav(stepPath(tripId, info.nextStep), { replace: true })
  }, [allowed, fresh, info, nav, trip.data, tripId])
  return { trip, info, ready: fresh }
}
