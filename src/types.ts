export type DayMode = 'home' | 'outing' | 'cooking'

/** Per-device role — chosen once at first launch */
export type UserRole = 'child' | 'parent'

export type TabId =
  | 'today'
  | 'progress'
  | 'calendar'
  | 'exercises'
  | 'chew'
  | 'settings'

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

export type ScreenKind = 'roblox'

export type ScreenSlot = {
  /** Unix ms when the running session should end */
  endsAt: number | null
  /** Seconds left when paused */
  remainingSec: number
  /** Today's limit already used up */
  finished: boolean
  /** Seconds actually played today (for parent view) */
  usedSec: number
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
  /** Unix ms when the first chew cell was filled (optional for older entries) */
  startedAt?: number
}

/** One-off important task for a single day (not part of the fixed minimum) */
export type DayExtraTask = {
  id: string
  text: string
  done: boolean
  /** Set when parent creates the task — child can complete but not delete */
  fromParent?: boolean
}

export type DayLog = {
  date: string
  mode: DayMode
  mustDo: Partial<Record<MustDoId, boolean>>
  exercisesDone: Record<string, boolean>
  /** Unix ms of the first exercise check today */
  workoutStartedAt: number | null
  /** Unix ms when the full routine was completed */
  workoutFinishedAt: number | null
  note: string
  outing: string
  /** One-time must-dos for this day only */
  extraTasks: DayExtraTask[]
  /** What creative thing they did */
  createNote: string
  screens: Record<ScreenKind, ScreenSlot>
  /** One-day Roblox bonus minutes claimed for this date (not permanent) */
  robloxBonusMin: number
}

export type AppData = {
  exercises: Exercise[]
  days: Record<string, DayLog>
  chewEntries: ChewEntry[]
  cookingLeft: number
  /** Homework set id — bump when replacing the built-in routine */
  routineId: string
  /** Streak milestones already paid out (one-time Roblox day bonuses) */
  claimedRobloxStreaks: number[]
  /** Best consecutive perfect-day streak ever (stickers stay unlocked) */
  bestStreak: number
}
