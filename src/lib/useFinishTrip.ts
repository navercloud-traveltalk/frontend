import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { BookshelfResponse, FinishTripResponse, InProgressTrip, TripInfo } from '../api/types'
import { BINDING_PREVIEW_KEY, type BindingPreview } from './useBindingPreview'

/** 책 만들기를 요청한 순간부터 책장에도 엮기 상태를 표시한다. 실패하면 이전 카드로 복구한다. */
export function useFinishTrip(tripId: string, onSuccess: (result: FinishTripResponse) => void) {
  const qc = useQueryClient()
  const showBinding = () => qc.setQueryData<BookshelfResponse>(['bookshelf'], old => {
    if (!old || old.inProgressTrip?.id !== tripId) return old
    return { ...old, inProgressTrip: { ...old.inProgressTrip,
      phase: 'binding', jobStatus: 'running', bindingProgress: 0, nextStep: undefined } }
  })
  const rememberBinding = (result?: FinishTripResponse) => {
    const shelfTrip = qc.getQueryData<BookshelfResponse>(['bookshelf'])?.inProgressTrip
    const detail = qc.getQueryData<TripInfo>(['trip', tripId])
    const trip: InProgressTrip | undefined = shelfTrip?.id === tripId ? shelfTrip : detail ? {
      id: tripId, place: detail.place, day: detail.currentDay ?? detail.day, phase: 'binding',
    } : undefined
    if (trip) qc.setQueryData<BindingPreview>(BINDING_PREVIEW_KEY, {
      trip: { ...trip, phase: 'binding', jobStatus: 'running', bindingProgress: 0, nextStep: undefined },
      jobId: result?.jobId, bookId: result?.bookId,
    })
  }
  return useMutation({
    mutationFn: () => api.finishTrip(tripId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['bookshelf'] })
      const previous = qc.getQueryData<BookshelfResponse>(['bookshelf'])
      showBinding()
      rememberBinding()
      return { previous }
    },
    onSuccess: result => { showBinding(); rememberBinding(result); onSuccess(result) },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(['bookshelf'], context.previous)
      if (qc.getQueryData<BindingPreview>(BINDING_PREVIEW_KEY)?.trip.id === tripId)
        qc.setQueryData(BINDING_PREVIEW_KEY, null)
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['bookshelf'] }) },
  })
}
