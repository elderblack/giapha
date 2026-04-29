import { useCallback, useMemo, useState } from 'react'
import {
  buildShippedDefaults,
  DEVELOPMENT_PLAN,
  getAllTaskIds,
  loadPlanProgress,
  savePlanProgress,
} from '../data/plan'

export function usePlanProgress() {
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => loadPlanProgress())

  const toggle = useCallback((taskId: string) => {
    setCompleted((prev) => {
      const next = { ...prev, [taskId]: !prev[taskId] }
      savePlanProgress(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    const shipped = buildShippedDefaults()
    savePlanProgress(shipped)
    setCompleted(shipped)
  }, [])

  const allIds = useMemo(() => getAllTaskIds(), [])
  const doneCount = useMemo(
    () => allIds.filter((id) => completed[id]).length,
    [allIds, completed],
  )
  const total = allIds.length
  const percent = total ? Math.round((doneCount / total) * 100) : 0

  return {
    completed,
    toggle,
    clearAll,
    doneCount,
    total,
    percent,
    phases: DEVELOPMENT_PLAN,
  }
}
