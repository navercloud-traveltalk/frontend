import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

/** 서버 작업 상태를 2초마다 확인한다. 끝나면(done/failed) 멈춘다. */
export function useJob(jobId: string | null) {
  const qc = useQueryClient()
  const job = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => (!q.state.data || q.state.data.status === 'running' ? 2000 : false),
    refetchIntervalInBackground: true,
    retry: 3,
  })
  const status = job.data?.status
  useEffect(() => {
    if (!jobId || !status || status === 'running') return
    void qc.invalidateQueries({ queryKey: ['bookshelf'] })
    void qc.invalidateQueries({ queryKey: ['trip'] })
    if (status === 'done') void qc.invalidateQueries({ queryKey: ['chapter'] })
  }, [jobId, status, qc])
  return job
}
