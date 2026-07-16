import { useEffect, useState } from 'react'
import { DEFAULT_EXERCISES, ROUTINE_ID, defaultAppData } from './data'
import type { AppData, ChewEntry, DayLog } from './types'

const STORAGE_KEY = 'vacation-planner-v2'

type StoredData = {
  days?: Record<string, DayLog>
  chewEntries?: ChewEntry[]
  cookingLeft?: number
  routineId?: string
  exercises?: unknown
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const legacy = !raw ? localStorage.getItem('vacation-planner-v1') : null
    const source = raw ?? legacy
    if (!source) return defaultAppData()

    const parsed = JSON.parse(source) as StoredData
    return {
      exercises: DEFAULT_EXERCISES,
      days: parsed.days ?? {},
      chewEntries: parsed.chewEntries ?? [],
      cookingLeft: parsed.cookingLeft ?? 5,
      routineId: ROUTINE_ID,
    }
  } catch {
    return defaultAppData()
  }
}

export function useAppData() {
  const [data, setData] = useState<AppData>(() => load())

  useEffect(() => {
    const toStore: StoredData = {
      days: data.days,
      chewEntries: data.chewEntries,
      cookingLeft: data.cookingLeft,
      routineId: ROUTINE_ID,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  }, [data])

  useEffect(() => {
    setData((prev) =>
      prev.routineId === ROUTINE_ID && prev.exercises === DEFAULT_EXERCISES
        ? {
            ...prev,
            chewEntries: prev.chewEntries ?? [],
          }
        : {
            ...prev,
            exercises: DEFAULT_EXERCISES,
            chewEntries: prev.chewEntries ?? [],
            routineId: ROUTINE_ID,
          },
    )
  }, [])

  return [data, setData] as const
}
