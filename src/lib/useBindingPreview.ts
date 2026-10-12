import { useQuery } from '@tanstack/react-query'
import type { InProgressTrip } from '../api/types'

export const BINDING_PREVIEW_KEY = ['binding-preview'] as const
export interface BindingPreview { trip: InProgressTrip; jobId?: string; bookId?: string }

/** 화면을 이동해도 시작한 책을 책장에 꽂을 때까지 같은 진행 카드를 유지한다. */
export function useBindingPreview() {
  return useQuery<BindingPreview | null>({
    queryKey: BINDING_PREVIEW_KEY, queryFn: () => null, enabled: false, initialData: null,
  })
}
