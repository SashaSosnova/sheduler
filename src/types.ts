export type DayMode = 'home' | 'outing' | 'cooking'

/** Per-device role — chosen once at first launch */
export type UserRole = 'child' | 'parent'

export type TabId =
  | 'today'
  | 'progress'
  | 'calendar'
  | 'exercises'
  | 'chew'
  | 'rewards'
  | 'settings'

export type Exercise = {
  id: string
  name: string
  group: string
  /** Countdown seconds; 0 = no timer */
  durationSec: number
  reps: string
  notes: string
  /** false = hidden from child routine (kept for parent) */
  enabled?: boolean
  /** Added by parent in the app (not from built-in DEFAULT_EXERCISES) */
  custom?: boolean
}

/** One-shot «контроль» — film this exercise on a given day */
export type ExerciseControl = {
  id: string
  exerciseId: string
  /** YYYY-MM-DD */
  date: string
  filmed: boolean
}

export type MustDoId =
  | 'exercise'
  | 'chew'
  | 'read'
  | 'create'
  | 'homework'
  | 'backpack'
  | 'wash-am'
  | 'wash-pm'

/** Pill intake slots — separate from must-do / perfect-day stars */
export type MedSlotId = 'morning' | 'day' | 'evening'

/** Parent-configured medication schedule (which slots to take it) */
export type Medication = {
  id: string
  name: string
  /** Dose / amount, e.g. «1 таб», «5 мл» */
  dose: string
  /** Times of day this drug should be taken */
  slots: MedSlotId[]
}

export type ScreenKind = 'roblox'

export type ScreenSlot = {
  /** Unix ms when the running session should end */
  endsAt: number | null
  /** Seconds left when paused */
  remainingSec: number
  /** Today's limit already used up */
  finished: boolean
  /** Seconds actually played today within the limit (for parent view) */
  usedSec: number
  /** Accumulated play after the timer hit zero */
  overtimeSec?: number
  /** Unix ms when overtime clock started (null when not ticking) */
  overtimeStartedAt?: number | null
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
  /** Genitive label for «от …», e.g. «мамы» / «папы» */
  fromParentAs?: string
}

/**
 * Appointment-style reminder for a day — not a checkbox task.
 * Does not affect stars, perfect days, or sticker progress.
 */
export type DayReminder = {
  id: string
  text: string
  /** Local time HH:mm (required for new reminders) */
  time?: string
  /** Set when parent creates the reminder — child cannot delete */
  fromParent?: boolean
  /** Genitive label for «от …», e.g. «мамы» / «папы» */
  fromParentAs?: string
}

/** One continuous workout approach; gaps between sessions are not counted */
export type WorkoutSession = {
  startedAt: number
  /** null while the approach is still open */
  endedAt: number | null
}

export type DayLog = {
  date: string
  mode: DayMode
  mustDo: Partial<Record<MustDoId, boolean>>
  /** Unix ms when each must-do was first checked (cleared if unchecked) */
  mustDoAt: Partial<Record<MustDoId, number>>
  /** Pill tracker: morning / day / evening */
  medSlots: Partial<Record<MedSlotId, boolean>>
  /** Unix ms when each med slot was first checked (cleared if unchecked) */
  medSlotsAt: Partial<Record<MedSlotId, number>>
  exercisesDone: Record<string, boolean>
  /** Timed exercises where the full timer (all rounds) was waited out */
  timersHonored: Record<string, boolean>
  /** Unix ms of the first exercise check today */
  workoutStartedAt: number | null
  /** Unix ms when the full routine was completed */
  workoutFinishedAt: number | null
  /** Active workout approaches (clean time = sum of session lengths) */
  workoutSessions: WorkoutSession[]
  /**
   * Star granted without full routine (e.g. no капа).
   * Cleared when every active exercise is done.
   */
  exercisePartial: boolean
  /** Unix ms when the day first became perfect (all must-dos); cleared if broken */
  perfectAt: number | null
  note: string
  outing: string
  /** One-time must-dos for this day only */
  extraTasks: DayExtraTask[]
  /** Ids removed on any device — merge must not resurrect them */
  deletedExtraTaskIds: string[]
  /** «Не забудь» — appointments / notes without checkboxes */
  reminders: DayReminder[]
  /** Ids removed on any device — merge must not resurrect them */
  deletedReminderIds: string[]
  /** Free-text creative note («своё»), not a chip label */
  createNote: string
  /** Selected creative chips for the day (multi-select, not must-do; no Пазл/Лего) */
  createIdeas: string[]
  /** Puzzles completed today (0 = not selected, 1–4) */
  puzzlePieces: number
  /** Lego sets completed today (0 = not selected, 1–4) */
  legoPieces: number
  /** Derived: puzzle/lego tracks active today */
  createKinds: CreateKind[]
  /** Today's checkmarks for weekly electives (id → done) */
  electiveDone: Record<string, boolean>
  screens: Record<ScreenKind, ScreenSlot>
  /** One-day Roblox bonus minutes claimed for this date (not permanent) */
  robloxBonusMin: number
}

/** Creative achievement tracks (must-do create + matching chip) */
export type CreateKind = 'puzzle' | 'lego'

export type ReadingBook = {
  id: string
  title: string
}

export type FinishedBook = {
  id: string
  title: string
  finishedAt: number
}

/** Weekly club / after-school class — shown on matching weekdays */
export type Elective = {
  id: string
  title: string
  /** Local time HH:mm */
  time: string
  /** 1 = Monday … 7 = Sunday */
  weekdays: number[]
}

export type SchoolMark = 5 | 4 | 3 | 2

/** One diary mark — used by school achievements, not perfect-day stars */
export type SchoolGrade = {
  id: string
  /** YYYY-MM-DD */
  date: string
  subject: string
  mark: SchoolMark
  createdAt: number
}

export type AppData = {
  exercises: Exercise[]
  days: Record<string, DayLog>
  chewEntries: ChewEntry[]
  /** Parent-assigned one-shot video controls */
  exerciseControls: ExerciseControl[]
  cookingLeft: number
  /** Homework set id — bump when replacing the built-in routine */
  routineId: string
  /** Streak milestones already paid out (one-time Roblox day bonuses) */
  claimedRobloxStreaks: number[]
  /**
   * Unspent Roblox bonus minutes from achievements.
   * Claim onto a day via claimRobloxBankMinutes.
   */
  robloxBonusBankMin: number
  /**
   * Lifetime Roblox bonus minutes ever credited (streaks + parent gifts).
   * Never decreases when spending from the bank — used by «Белый Кролик».
   */
  robloxBonusEarnedMin: number
  /** Parent policy: false = Roblox blocked for the child */
  robloxEnabled: boolean
  /** Parent base daily Roblox limit in minutes (bonuses add on top) */
  robloxLimitMin: number
  /** Unix ms when robloxEnabled / robloxLimitMin last changed — last-write-wins */
  robloxSettingsUpdatedAt: number
  /** Parent-configured medications and which slots they belong to */
  medications: Medication[]
  /** Unix ms when medications list last changed — last-write-wins */
  medicationUpdatedAt: number
  /**
   * Unspent ruble rewards from parent-task achievements.
   * Parent marks as paid out via payoutMoneyBankRub.
   */
  moneyBankRub: number
  /** Unix ms when robloxBonusBankMin or moneyBankRub last changed */
  banksUpdatedAt: number
  /** Sticker ids whose moneyRub was already credited to moneyBankRub */
  claimedStickerMoneyIds: string[]
  /** Sticker ids whose robloxExtraMin was already credited to the Roblox bank */
  claimedStickerRobloxIds: string[]
  /**
   * Sticker ids whose giftHint was marked «выдано» by the parent.
   * Unlocked gift stickers not in this list stay pending in the turtle bank.
   */
  dismissedGiftStickerIds: string[]
  /**
   * Equipped achievement id for the Progress «Звание» title.
   * Null = auto first unlocked (non-secret) sticker.
   */
  equippedStickerId: string | null
  /** Best consecutive perfect-day streak ever (stickers stay unlocked) */
  bestStreak: number
  /** Best count of completed parent-assigned extra tasks */
  bestParentTasks: number
  /** Books currently being read (parent-managed) */
  readingBooks: ReadingBook[]
  /** Books marked finished (parent or Tom Sawyer sync) */
  finishedBooks: FinishedBook[]
  /** Lifetime completed puzzles (pieces, not days) */
  puzzleCount: number
  /** Lifetime completed Lego sets (pieces, not days) */
  legoCount: number
  /** School diary marks (5/4/3/2) for the school album */
  schoolGrades: SchoolGrade[]
  /** Ids removed on any device — merge must not resurrect them */
  deletedSchoolGradeIds: string[]
  /**
   * Extra no-school days the parent marked (каникулы / отмена уроков).
   * Weekends and built-in holidays do not need to be listed.
   */
  extraBreakDates: string[]
  /**
   * Days the parent marked as school despite a built-in holiday.
   * Wins over extraBreakDates when both contain the same date.
   */
  extraSchoolDates: string[]
  /** Unix ms when extraBreakDates / extraSchoolDates last changed */
  schoolCalendarUpdatedAt: number
  /** Recurring after-school clubs (luxurious maximum) */
  electives: Elective[]
  /** Unix ms when electives list last changed — last-write-wins */
  electivesUpdatedAt: number
}
