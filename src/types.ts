export type DayMode = 'home' | 'outing' | 'cooking'

export type TabId = 'today' | 'calendar' | 'exercises' | 'chew'

export type Exercise = {
  id: string
  name: string
  group: string
  /** Countdown seconds; 0 = no timer */
  durationSec: number
  reps: string
  notes: string
}

export type MustDoId =
  | 'exercise'
  | 'chew'
  | 'read'
  | 'create'
  | 'wash-am'
  | 'wash-pm'

export type ScreenKind = 'roblox' | 'cartoons'

export type ScreenSlot = {
  /** Unix ms when the running session should end */
  endsAt: number | null
  /** Seconds left when paused */
  remainingSec: number
  /** Today's limit already used up */
  finished: boolean
}

/** One chewing session: 5 bites left + 5 bites right */
export type ChewEntry = {
  id: string
  date: string
  food: string
  /** Chews per bite on the left side (5 bites) */
  left: number[]
  /** Chews per bite on the right side (5 bites) */
  right: number[]
  createdAt: number
}

export type DayLog = {
  date: string
  mode: DayMode
  mustDo: Partial<Record<MustDoId, boolean>>
  exercisesDone: Record<string, boolean>
  note: string
  outing: string
  /** What creative thing they did */
  createNote: string
  screens: Record<ScreenKind, ScreenSlot>
}

export type AppData = {
  exercises: Exercise[]
  days: Record<string, DayLog>
  chewEntries: ChewEntry[]
  cookingLeft: number
  /** Homework set id — bump when replacing the built-in routine */
  routineId: string
}
