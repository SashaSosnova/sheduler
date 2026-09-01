import type {
  AppData,
  ChewEntry,
  CreateKind,
  DayExtraTask,
  DayLog,
  DayReminder,
  Elective,
  Exercise,
  ExerciseControl,
  MedSlotId,
  Medication,
  MustDoId,
  SchoolGrade,
  SchoolMark,
  ScreenSlot,
  WorkoutSession,
} from './types'

export const ROUTINE_ID = 'daniil-hw-28-v5'

export const MUST_DO_ITEMS: { id: MustDoId; label: string }[] = [
  { id: 'wash-am', label: 'Почистить зубы' },
  { id: 'exercise', label: 'Сделать зарядку' },
  { id: 'chew', label: 'Заполнить дневник жевания' },
  { id: 'read', label: 'Почитать книгу' },
  { id: 'homework', label: 'Сделать домашнюю работу' },
  { id: 'backpack', label: 'Собрать рюкзак на завтра' },
  { id: 'create', label: 'Заняться творчеством' },
]

const MUST_DO_BY_ID = Object.fromEntries(
  MUST_DO_ITEMS.map((item) => [item.id, item]),
) as Record<MustDoId, { id: MustDoId; label: string }>

function mustDoByIds(ids: MustDoId[]): { id: MustDoId; label: string }[] {
  return ids.map((id) => MUST_DO_BY_ID[id])
}

/** Weekday vs weekend plan starts on this local date (YYYY-MM-DD). */
export const NEW_DAY_PLAN_START = '2026-09-01'
/** First school day with lessons: 1 Sep is линейка, marks from 2 Sep. */
export const SCHOOL_GRADES_START = '2026-09-02'

export type SchoolDayPlan = {
  extraBreakDates: string[]
  extraSchoolDates: string[]
}

export const EMPTY_SCHOOL_DAY_PLAN: SchoolDayPlan = {
  extraBreakDates: [],
  extraSchoolDates: [],
}

export function schoolDayPlanFromData(
  data?: Pick<AppData, 'extraBreakDates' | 'extraSchoolDates'> | null,
): SchoolDayPlan {
  return {
    extraBreakDates: data?.extraBreakDates ?? [],
    extraSchoolDates: data?.extraSchoolDates ?? [],
  }
}

export function normalizeDateKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const key = item.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out.sort()
}

/**
 * Рекомендации Минпросвещения на 2026/27 (четверти).
 * Школа может сдвинуть даты — родитель правит галочкой в календаре.
 */
export const SCHOOL_BREAK_RANGES: { from: string; to: string; label: string }[] =
  [
    { from: '2026-10-26', to: '2026-11-04', label: 'Осенние каникулы' },
    { from: '2026-12-31', to: '2027-01-10', label: 'Зимние каникулы' },
    { from: '2027-03-27', to: '2027-04-04', label: 'Весенние каникулы' },
    { from: '2027-05-27', to: '2027-08-31', label: 'Летние каникулы' },
  ]

/** 1 сентября, праздники РФ — в эти дни домашки и рюкзака в минимуме нет. */
const PUBLIC_HOLIDAY_MD = new Set([
  '01-01',
  '01-02',
  '01-03',
  '01-04',
  '01-05',
  '01-06',
  '01-07',
  '01-08',
  '02-23',
  '03-08',
  '05-01',
  '05-09',
  '06-12',
  '09-01',
  '11-04',
])

export function isWeekendDate(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return false
  const weekday = new Date(y, m - 1, d).getDay()
  return weekday === 0 || weekday === 6
}

export function isDefaultSchoolBreak(dateKey: string): boolean {
  if (dateKey < NEW_DAY_PLAN_START) return false
  if (PUBLIC_HOLIDAY_MD.has(dateKey.slice(5))) return true
  return SCHOOL_BREAK_RANGES.some(
    (range) => dateKey >= range.from && dateKey <= range.to,
  )
}

/** Выходной, каникулы или 1 сентября — план как в субботу, без домашки и рюкзака. */
export function isRestDay(
  dateKey: string,
  plan: SchoolDayPlan = EMPTY_SCHOOL_DAY_PLAN,
): boolean {
  if (isWeekendDate(dateKey)) return true
  if (plan.extraSchoolDates.includes(dateKey)) return false
  if (plan.extraBreakDates.includes(dateKey)) return true
  return isDefaultSchoolBreak(dateKey)
}

function addDaysKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d + delta)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const WEEKDAY_ACCUSATIVE = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среду',
  'четверг',
  'пятницу',
  'субботу',
]

/** Next weekday that is not a rest day — Friday usually lands on Monday. */
export function nextSchoolDateKey(
  dateKey: string,
  plan: SchoolDayPlan = EMPTY_SCHOOL_DAY_PLAN,
): string {
  let cursor = addDaysKey(dateKey, 1)
  for (let i = 0; i < 16; i++) {
    if (!isRestDay(cursor, plan)) return cursor
    cursor = addDaysKey(cursor, 1)
  }
  return addDaysKey(dateKey, 1)
}

export function backpackMustDoLabel(
  dateKey: string,
  plan: SchoolDayPlan = EMPTY_SCHOOL_DAY_PLAN,
): string {
  const next = nextSchoolDateKey(dateKey, plan)
  if (next === addDaysKey(dateKey, 1)) return 'Собрать рюкзак на завтра'
  const [y, m, d] = next.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return `Собрать рюкзак на ${WEEKDAY_ACCUSATIVE[dow] ?? 'завтра'}`
}

export function schoolRestLabel(
  dateKey: string,
  plan: SchoolDayPlan = EMPTY_SCHOOL_DAY_PLAN,
): string | null {
  if (dateKey < NEW_DAY_PLAN_START || !isRestDay(dateKey, plan)) return null
  if (isWeekendDate(dateKey)) return 'выходной'
  if (dateKey.slice(5) === '09-01') return '1 сентября'
  const range = SCHOOL_BREAK_RANGES.find(
    (item) => dateKey >= item.from && dateKey <= item.to,
  )
  if (range) return range.label
  if (plan.extraBreakDates.includes(dateKey)) return 'каникулы'
  return 'каникулы'
}

export function toggleSchoolBreakDay(data: AppData, dateKey: string): AppData {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || isWeekendDate(dateKey)) {
    return data
  }
  const plan = schoolDayPlanFromData(data)
  const rest = isRestDay(dateKey, plan)
  const extraBreak = new Set(plan.extraBreakDates)
  const extraSchool = new Set(plan.extraSchoolDates)
  if (rest) {
    extraBreak.delete(dateKey)
    if (isDefaultSchoolBreak(dateKey)) extraSchool.add(dateKey)
    else extraSchool.delete(dateKey)
  } else {
    extraSchool.delete(dateKey)
    extraBreak.add(dateKey)
  }
  return {
    ...data,
    extraBreakDates: [...extraBreak].sort(),
    extraSchoolDates: [...extraSchool].sort(),
    schoolCalendarUpdatedAt: Date.now(),
  }
}

/** Required for a perfect day on this date. August stays the old 5-item plan. */
export function requiredMustDoItems(
  dateKey: string,
  plan: SchoolDayPlan = EMPTY_SCHOOL_DAY_PLAN,
): { id: MustDoId; label: string }[] {
  if (dateKey < NEW_DAY_PLAN_START) {
    return mustDoByIds(['wash-am', 'exercise', 'chew', 'read', 'create'])
  }
  if (isRestDay(dateKey, plan)) {
    return mustDoByIds(['wash-am', 'exercise', 'chew', 'read'])
  }
  return mustDoByIds([
    'wash-am',
    'exercise',
    'chew',
    'homework',
    'backpack',
  ]).map((item) =>
    item.id === 'backpack'
      ? { ...item, label: backpackMustDoLabel(dateKey, plan) }
      : item,
  )
}

/** Shown on the day, but does not affect stars or a perfect day. */
export function optionalMustDoItems(
  dateKey: string,
  plan: SchoolDayPlan = EMPTY_SCHOOL_DAY_PLAN,
): { id: MustDoId; label: string }[] {
  if (dateKey < NEW_DAY_PLAN_START) return []
  if (isRestDay(dateKey, plan)) return mustDoByIds(['create'])
  return mustDoByIds(['read', 'create'])
}

/** Monday = 1 … Sunday = 7 */
export const WEEKDAY_MON1: { id: number; short: string }[] = [
  { id: 1, short: 'пн' },
  { id: 2, short: 'вт' },
  { id: 3, short: 'ср' },
  { id: 4, short: 'чт' },
  { id: 5, short: 'пт' },
  { id: 6, short: 'сб' },
  { id: 7, short: 'вс' },
]

export function dateWeekdayMon1(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return 1
  const js = new Date(y, m - 1, d).getDay()
  return js === 0 ? 7 : js
}

export const DEFAULT_ELECTIVES: Elective[] = [
  {
    id: 'elective-breakdance',
    title: 'брейк-данс',
    time: '19:30',
    weekdays: [2, 4],
  },
  {
    id: 'elective-guitar',
    title: 'гитару',
    time: '18:00',
    weekdays: [7],
  },
  {
    id: 'elective-code',
    title: 'программирование',
    time: '16:00',
    weekdays: [5],
  },
]

export function normalizeElectiveTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) return null
  return trimmed
}

export function normalizeElectives(raw: unknown): Elective[] {
  if (!Array.isArray(raw)) return DEFAULT_ELECTIVES.map((e) => ({ ...e }))
  const out: Elective[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<Elective>
    const title = typeof row.title === 'string' ? row.title : ''
    const time = normalizeElectiveTime(row.time)
    if (!time) continue
    const id =
      typeof row.id === 'string' && row.id.trim() ? row.id.trim() : uid()
    if (seen.has(id)) continue
    seen.add(id)
    const days = Array.isArray(row.weekdays)
      ? [...new Set(
          row.weekdays.filter(
            (n): n is number =>
              typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 7,
          ),
        )].sort((a, b) => a - b)
      : []
    if (days.length === 0) continue
    out.push({ id, title, time, weekdays: days })
  }
  return out
}

export function electiveLabel(elective: Elective): string {
  return `Сходить на ${elective.title} в ${elective.time}`
}

export function electiveWeekdayHint(elective: Elective): string {
  return elective.weekdays
    .map((id) => WEEKDAY_MON1.find((w) => w.id === id)?.short)
    .filter(Boolean)
    .join(', ')
}

export function electivesOnDate(
  electives: Elective[],
  dateKey: string,
): Elective[] {
  const weekday = dateWeekdayMon1(dateKey)
  return electives
    .filter((item) => item.weekdays.includes(weekday))
    .sort(
      (a, b) =>
        a.time.localeCompare(b.time) || a.title.localeCompare(b.title, 'ru'),
    )
}

export const MED_SLOT_ITEMS: { id: MedSlotId; label: string }[] = [
  { id: 'morning', label: 'Утро' },
  { id: 'day', label: 'День' },
  { id: 'evening', label: 'Вечер' },
]

const MED_SLOT_IDS = new Set<MedSlotId>(
  MED_SLOT_ITEMS.map((item) => item.id),
)

export function normalizeMedications(raw: unknown): Medication[] {
  if (!Array.isArray(raw)) return []
  const out: Medication[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<Medication>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) continue
    const dose = typeof row.dose === 'string' ? row.dose.trim() : ''
    const slots = Array.isArray(row.slots)
      ? row.slots.filter(
          (s): s is MedSlotId =>
            typeof s === 'string' && MED_SLOT_IDS.has(s as MedSlotId),
        )
      : []
    if (slots.length === 0) continue
    out.push({
      id: typeof row.id === 'string' && row.id ? row.id : uid(),
      name,
      dose,
      slots: [...new Set(slots)],
    })
  }
  return out
}

/** Legacy single medicationName → one med for all slots. */
export function migrateLegacyMedicationName(raw: unknown): Medication[] {
  if (typeof raw !== 'string') return []
  const name = raw.trim()
  if (!name) return []
  return [
    {
      id: uid(),
      name,
      dose: '',
      slots: MED_SLOT_ITEMS.map((item) => item.id),
    },
  ]
}

export function medicationsForSlot(
  medications: Medication[] | undefined,
  slot: MedSlotId,
): Medication[] {
  return (medications ?? []).filter((m) => m.slots.includes(slot))
}

/** Chip / list label: «Магний B6 · 1 таб» */
export function medicationLabel(med: Medication): string {
  const dose = med.dose.trim()
  return dose ? `${med.name} · ${dose}` : med.name
}

export const CHEW_FOODS = ['Морковь', 'Яблоко'] as const

export const CREATE_IDEAS = [
  'Рисовать',
  'Лепить',
  'Пазл',
  'Лего',
  'Поделка / оригами',
  'Комикс',
  'Музыка',
  'Что-то смастерить',
]

/** Chip label → creative achievement track */
export const CREATE_KIND_BY_IDEA: Record<string, CreateKind> = {
  Пазл: 'puzzle',
  Лего: 'lego',
}

export const CREATE_PIECE_MAX = 4
export const CREATE_PIECE_OPTIONS = [1, 2, 3, 4] as const

export const SCHOOL_SUBJECTS = [
  'Русский язык',
  'Математика',
  'Литература',
  'Окружающий мир',
  'Английский язык',
] as const

/** Subjects with their own five-counter in the school album */
export const SCHOOL_TRACK_SUBJECTS = [
  'Русский язык',
  'Математика',
  'Литература',
  'Окружающий мир',
  'Английский язык',
] as const

export const SCHOOL_MARKS: SchoolMark[] = [5, 4, 3, 2]

/** At least this many marks before a finished quarter can unlock. */
export const SCHOOL_QUARTER_MIN_GRADES = 3

export function normalizeSchoolSubject(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

const SCHOOL_SUBJECT_ALIASES: Record<string, string> = {
  русский: 'русский язык',
  'русский язык': 'русский язык',
  английский: 'английский язык',
  'английский язык': 'английский язык',
}

export function schoolSubjectKey(subject: string): string {
  const key = normalizeSchoolSubject(subject)
    .toLowerCase()
    .replace(/ё/g, 'е')
  return SCHOOL_SUBJECT_ALIASES[key] ?? key
}

/** Short label for the five-counter (chips keep the full name). */
export function schoolSubjectShort(subject: string): string {
  const key = schoolSubjectKey(subject)
  if (key === 'русский язык') return 'Русский'
  if (key === 'английский язык') return 'Английский'
  if (key === 'окружающий мир') return 'Окружайка'
  return normalizeSchoolSubject(subject)
}

const SCHOOL_MARK_SET = new Set<number>(SCHOOL_MARKS)

export function normalizeSchoolMark(raw: unknown): SchoolMark | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  const n = Math.floor(raw)
  return SCHOOL_MARK_SET.has(n) ? (n as SchoolMark) : null
}

export function normalizeSchoolGrades(raw: unknown): SchoolGrade[] {
  if (!Array.isArray(raw)) return []
  const out: SchoolGrade[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<SchoolGrade>
    const date =
      typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
        ? row.date
        : ''
    const subject = normalizeSchoolSubject(
      typeof row.subject === 'string' ? row.subject : '',
    )
    const mark = normalizeSchoolMark(row.mark)
    const createdAt =
      typeof row.createdAt === 'number' && Number.isFinite(row.createdAt)
        ? Math.floor(row.createdAt)
        : 0
    if (!date || !subject || mark == null || createdAt <= 0) continue
    out.push({
      id: typeof row.id === 'string' && row.id ? row.id : uid(),
      date,
      subject,
      mark,
      createdAt,
    })
  }
  return out.sort((a, b) => a.createdAt - b.createdAt)
}

export function mergeSchoolGrades(
  local: SchoolGrade[],
  remote: SchoolGrade[],
  localDeleted: string[] = [],
  remoteDeleted: string[] = [],
): { grades: SchoolGrade[]; deletedIds: string[] } {
  const deletedIds = [
    ...new Set(
      [...localDeleted, ...remoteDeleted].filter((id) => id.trim().length > 0),
    ),
  ]
  const deleted = new Set(deletedIds)
  const byId = new Map<string, SchoolGrade>()
  for (const grade of [...local, ...remote]) {
    if (deleted.has(grade.id)) continue
    const prev = byId.get(grade.id)
    if (!prev || grade.createdAt >= prev.createdAt) byId.set(grade.id, grade)
  }
  return {
    grades: [...byId.values()].sort((a, b) => a.createdAt - b.createdAt),
    deletedIds,
  }
}

/**
 * Academic quarter key `YYYY-qN` (year = September start), or null in summer.
 * Q1 Sep–Oct, Q2 Nov–Dec, Q3 Jan–24 Mar, Q4 25 Mar–May.
 */
export function schoolQuarterKey(dateKey: string): string | null {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return null
  if (m >= 9 && m <= 10) return `${y}-q1`
  if (m >= 11 && m <= 12) return `${y}-q2`
  if (m === 1 || m === 2 || (m === 3 && d <= 24)) return `${y - 1}-q3`
  if ((m === 3 && d >= 25) || m === 4 || m === 5) return `${y - 1}-q4`
  return null
}

export function schoolQuarterEndDate(quarterKey: string): string | null {
  const match = /^(\d{4})-q([1-4])$/.exec(quarterKey)
  if (!match) return null
  const year = Number(match[1])
  const q = Number(match[2])
  if (q === 1) return `${year}-10-31`
  if (q === 2) return `${year}-12-31`
  if (q === 3) return `${year + 1}-03-24`
  return `${year + 1}-05-31`
}

export function schoolQuarterLabel(quarterKey: string): string {
  const match = /^(\d{4})-q([1-4])$/.exec(quarterKey)
  if (!match) return quarterKey
  const year = Number(match[1])
  const q = match[2]
  return `${q} четверть ${year}/${String(year + 1).slice(2)}`
}

export function isSchoolQuarterEnded(
  quarterKey: string,
  today = todayKey(),
): boolean {
  const end = schoolQuarterEndDate(quarterKey)
  return Boolean(end && today > end)
}

export function createKindFromNote(note: string): CreateKind | null {
  const key = note.trim()
  return CREATE_KIND_BY_IDEA[key] ?? null
}

export function isCreatePieceIdea(idea: string): boolean {
  return idea === 'Пазл' || idea === 'Лего'
}

export function normalizeCreatePieces(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(CREATE_PIECE_MAX, Math.floor(raw)))
}

export function ruShtuki(n: number): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return 'штука'
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'штуки'
  return 'штук'
}

export function formatCreatePieceLabel(
  kind: CreateKind,
  n: number,
): string {
  const name = kind === 'puzzle' ? 'Пазл' : 'Лего'
  return `${name}: ${n} ${ruShtuki(n)}`
}

export function createKindsFromPieces(
  puzzlePieces: number,
  legoPieces: number,
): CreateKind[] {
  const out: CreateKind[] = []
  if (puzzlePieces > 0) out.push('puzzle')
  if (legoPieces > 0) out.push('lego')
  return out
}

export function toggleCreateIdea(ideas: string[], idea: string): string[] {
  const key = idea.trim()
  if (!key || isCreatePieceIdea(key)) return ideas
  return ideas.includes(key)
    ? ideas.filter((x) => x !== key)
    : [...ideas, key]
}

export function normalizeCreateIdeas(
  raw: unknown,
  createNote = '',
): string[] {
  const out: string[] = []
  const add = (idea: string) => {
    const key = idea.trim()
    if (!key || out.includes(key) || isCreatePieceIdea(key)) return
    if (!CREATE_IDEAS.includes(key)) return
    out.push(key)
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') add(item)
    }
  }
  const note = createNote.trim()
  if (note && CREATE_IDEAS.includes(note)) add(note)
  if (note.includes('·')) {
    for (const part of note.split('·')) add(part)
  }
  return out
}

export function normalizeCreateKinds(
  puzzlePieces: number,
  legoPieces: number,
  rawKinds?: unknown,
  legacyKind?: unknown,
  createNote = '',
): CreateKind[] {
  const out = createKindsFromPieces(puzzlePieces, legoPieces)
  const add = (k: CreateKind) => {
    if (!out.includes(k)) out.push(k)
  }
  if (Array.isArray(rawKinds)) {
    for (const item of rawKinds) {
      if (item === 'puzzle' || item === 'lego') add(item)
    }
  }
  if (legacyKind === 'puzzle' || legacyKind === 'lego') add(legacyKind)
  const fromNote = createKindFromNote(createNote)
  if (fromNote) add(fromNote)
  return out
}

/** Quick-add chips for one-off chores (parent or child) */
export const EXTRA_TASK_IDEAS: string[] = [
  'Убрать в комнате',
  'Пропылесосить',
  'Помыть посуду',
  'Вынести мусор',
  'Помочь на кухне',
  'Разобрать стол',
]

export const SCREEN_LIMITS = {
  roblox: { label: 'Roblox', seconds: 40 * 60 },
} as const

/** Default / max parent-configurable base Roblox minutes per day */
export const DEFAULT_ROBLOX_LIMIT_MIN = 40
export const ROBLOX_LIMIT_MIN_MAX = 120
export const ROBLOX_LIMIT_PRESETS = [15, 20, 30, 40] as const

export function normalizeRobloxLimitMin(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_ROBLOX_LIMIT_MIN
  }
  return Math.min(
    ROBLOX_LIMIT_MIN_MAX,
    Math.max(1, Math.floor(raw)),
  )
}

export function isRobloxEnabled(data: { robloxEnabled?: boolean }): boolean {
  return data.robloxEnabled !== false
}

/** Must-do items that should look “main” in the checklist */
export const MAIN_MUST_DO: MustDoId[] = ['exercise', 'chew', 'homework']

/** Checked only when completed inside the app — not by tapping the checkbox */
export const APP_LOCKED_MUST_DO: MustDoId[] = ['exercise', 'chew']

export function emptyScreenSlot(limitSec: number): ScreenSlot {
  return {
    endsAt: null,
    remainingSec: limitSec,
    finished: false,
    usedSec: 0,
    overtimeSec: 0,
    overtimeStartedAt: null,
  }
}

/** Human-readable play time, e.g. "12 мин" or "1 ч 5 мин" */
export function formatPlayTime(sec: number): string {
  const safe = Math.max(0, Math.floor(sec))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0) {
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
  }
  if (m > 0) {
    return s > 0 && m < 5 ? `${m} мин ${s} сек` : `${m} мин`
  }
  return `${s} сек`
}

/** Live overtime including an active overtimeStartedAt clock. */
export function screenOvertimeSec(slot: ScreenSlot, now = Date.now()): number {
  const base =
    typeof slot.overtimeSec === 'number' && Number.isFinite(slot.overtimeSec)
      ? Math.max(0, Math.floor(slot.overtimeSec))
      : 0
  if (
    !slot.finished &&
    typeof slot.overtimeStartedAt === 'number' &&
    Number.isFinite(slot.overtimeStartedAt)
  ) {
    return base + Math.max(0, Math.floor((now - slot.overtimeStartedAt) / 1000))
  }
  return base
}

/** Fold live overtime into overtimeSec and stop the clock. */
export function flushScreenOvertime(
  slot: ScreenSlot,
  now = Date.now(),
): ScreenSlot {
  return {
    ...slot,
    overtimeSec: screenOvertimeSec(slot, now),
    overtimeStartedAt: null,
  }
}

/** e.g. "45 мин (+12 мин сверх лимита)" */
export function formatPlayTimeWithOvertime(
  usedSec: number,
  overtimeSec: number,
): string {
  const base = formatPlayTime(usedSec)
  if (overtimeSec <= 0) return base
  return `${base} (+${formatPlayTime(overtimeSec)} сверх лимита)`
}

const POSTURE = 'Гимнастика для осанки'
const ARTIC_TRAINER = 'Артикуляционная гимнастика с трейнером'
const ARTIC = 'Артикуляционная гимнастика'
const SWALLOW = 'Глотание'
const BREATH = 'Дыхательная гимнастика'

/** Домашнее задание №28 для Даниила (капа / трейнер) */
export const DEFAULT_EXERCISES: Exercise[] = [
  // —— Осанка ——
  {
    id: 'p-head',
    name: 'Вращения головой',
    group: POSTURE,
    durationSec: 0,
    reps: 'по 10 раз в каждую сторону',
    notes: 'Спокойный темп.',
  },
  {
    id: 'p-turtle',
    name: 'Черепашка в домике',
    group: POSTURE,
    durationSec: 0,
    reps: '5 раз',
    notes: '',
  },
  {
    id: 'p-swim',
    name: 'Пловец',
    group: POSTURE,
    durationSec: 0,
    reps: 'по 10 подходов',
    notes: 'Вперёд; назад; одна рука вперёд / другая назад, потом меняем.',
  },
  {
    id: 'p-mech',
    name: 'Механизм',
    group: POSTURE,
    durationSec: 0,
    reps: '20 раз',
    notes: 'Руки в замке над головой ладошками вниз. Попеременно тянем локоть вниз, другую руку за голову.',
  },
  {
    id: 'p-grow',
    name: 'Растём',
    group: POSTURE,
    durationSec: 0,
    reps: 'по 10 раз в каждом положении',
    notes: 'Руки в замке вверх к потолку, затем к груди — тянемся вперёд.',
  },
  {
    id: 'p-hug',
    name: 'Обнимашки',
    group: POSTURE,
    durationSec: 0,
    reps: '4 раза',
    notes: '',
  },
  {
    id: 'p-stretch',
    name: 'Потягушки',
    group: POSTURE,
    durationSec: 0,
    reps: 'по 5 раз на каждую сторону',
    notes: '',
  },
  {
    id: 'p-lambada',
    name: 'Ламбада',
    group: POSTURE,
    durationSec: 0,
    reps: 'по 10 в каждую сторону',
    notes: '',
  },
  {
    id: 'p-torso',
    name: 'Вращение корпусом',
    group: POSTURE,
    durationSec: 0,
    reps: 'по 10 в каждую сторону',
    notes: '',
  },
  {
    id: 'p-palms',
    name: 'Ладошки',
    group: POSTURE,
    durationSec: 0,
    reps: '12 подходов по 8 раз',
    notes: '',
  },

  // —— Артикуляция с трейнером ——
  {
    id: 'a-smile',
    name: 'Удержание улыбки',
    group: ARTIC_TRAINER,
    durationSec: 60,
    reps: '',
    notes: 'Удержать мышцы губ 1 минуту.',
  },
  {
    id: 'a-tongues',
    name: 'Язычки здороваются',
    group: ARTIC_TRAINER,
    durationSec: 10,
    reps: '3 подхода',
    notes: 'Удерживать язык под счёт от 1 до 10.',
  },
  {
    id: 'a-bagel',
    name: 'Бублик с удержанием',
    group: ARTIC_TRAINER,
    durationSec: 60,
    reps: '',
    notes: 'Удержать мышцы губ 1 минуту.',
  },
  {
    id: 'a-swing-lips',
    name: 'Качели — губы',
    group: ARTIC_TRAINER,
    durationSec: 0,
    reps: '10 раз',
    notes: 'Раскачиваем закрытую улыбку влево–вправо.',
  },
  {
    id: 'a-brush',
    name: 'Чистим зубы',
    group: ARTIC_TRAINER,
    durationSec: 0,
    reps: 'по 4 раза в каждую сторону',
    notes: 'Кончиком языка по внутренней стороне трейнера по часовой и против.',
  },
  {
    id: 'a-kiss',
    name: 'Холодный поцелуй',
    group: ARTIC_TRAINER,
    durationSec: 60,
    reps: '',
    notes: 'Удерживаем позу 1 минуту. Губы напряжены.',
  },
  {
    id: 'a-koko',
    name: 'Ко-ко-ко',
    group: ARTIC_TRAINER,
    durationSec: 0,
    reps: '20 раз',
    notes: '',
  },
  {
    id: 'a-hare-tiger',
    name: 'Чередование «Заяц» — «Тигр»',
    group: ARTIC_TRAINER,
    durationSec: 0,
    reps: '5 подходов',
    notes: 'Чередуем положение губ.',
  },
  {
    id: 'a-eights',
    name: 'Восьмёрки',
    group: ARTIC_TRAINER,
    durationSec: 0,
    reps: '15–30 раз',
    notes: 'Кончиком языка на твёрдом нёбе.',
  },
  {
    id: 'a-knot',
    name: 'Узелок',
    group: ARTIC_TRAINER,
    durationSec: 60,
    reps: '',
    notes: 'Удерживать 1 минуту.',
  },
  {
    id: 'a-painter',
    name: 'Маляр',
    group: ARTIC_TRAINER,
    durationSec: 0,
    reps: '10 раз',
    notes: 'Спокойный темп.',
  },
  {
    id: 'a-pig',
    name: 'Пятачок',
    group: ARTIC_TRAINER,
    durationSec: 0,
    reps: 'по 5 кружков в каждую сторону',
    notes: 'Губы слегка вперёд, зубы сомкнуты, челюсть неподвижна.',
  },

  // —— Артикуляция без трейнера ——
  {
    id: 'a-pendulum',
    name: 'Маятник',
    group: ARTIC,
    durationSec: 0,
    reps: '20 раз',
    notes: '',
  },
  {
    id: 'a-open-smile',
    name: 'Улыбка, открытая с удержанием',
    group: ARTIC,
    durationSec: 60,
    reps: '',
    notes: 'Удержать мышцы губ 1 минуту.',
  },
  {
    id: 'a-swing-tongue',
    name: 'Качели (язык)',
    group: ARTIC,
    durationSec: 0,
    reps: '10 раз',
    notes: 'Поочерёдно менять положение языка.',
  },
  {
    id: 'a-chubby',
    name: 'Толстячки',
    group: ARTIC,
    durationSec: 0,
    reps: '5 раз',
    notes: '',
  },
  {
    id: 'a-curious',
    name: 'Любопытный язычок из точки покоя',
    group: ARTIC,
    durationSec: 0,
    reps: '10 раз',
    notes: 'Рот остаётся открытым.',
  },
  {
    id: 'a-grandma',
    name: 'Бабка',
    group: ARTIC,
    durationSec: 60,
    reps: '',
    notes: 'Губы затягиваем в открытый рот. Удерживаем 1 минуту.',
  },
  {
    id: 'a-drum',
    name: 'Барабанщик',
    group: ARTIC,
    durationSec: 0,
    reps: 'на 3 полных выдоха',
    notes: '',
  },
  {
    id: 'a-skinny',
    name: 'Худышки',
    group: ARTIC,
    durationSec: 0,
    reps: '5 раз',
    notes: '',
  },
  {
    id: 'a-mushroom',
    name: 'Грибок с водой (наклоны головы)',
    group: ARTIC,
    durationSec: 0,
    reps: '5 подходов',
    notes: 'Грибок с водой; наклон влево и вправо, каждое положение на счёт до 5. Вода не должна убежать.',
  },
  {
    id: 'a-accordion',
    name: 'Гармошка',
    group: ARTIC,
    durationSec: 0,
    reps: '20 раз',
    notes: 'Растягиваем подъязычную связку до лёгкой боли под языком.',
  },
  {
    id: 'a-coachman',
    name: 'Кучер',
    group: ARTIC,
    durationSec: 0,
    reps: 'на 3 полных выдоха',
    notes: 'Губы максимально расслаблены.',
  },
  {
    id: 'a-ladder-mushroom',
    name: 'Чередование «Лесенка» — «Грибок»',
    group: ARTIC,
    durationSec: 0,
    reps: '10 подходов',
    notes: 'Чашечка: верхняя губа → резцы → точка покоя, затем грибочек.',
  },
  {
    id: 'a-chew-air',
    name: 'Жуём воздух',
    group: ARTIC,
    durationSec: 0,
    reps: 'по 10 раз в каждую сторону',
    notes: 'Губы сжать. Имитация жевания, подбородок — круговые движения.',
  },

  // —— Глотание ——
  {
    id: 's-saliva',
    name: 'Глотание слюны',
    group: SWALLOW,
    durationSec: 0,
    reps: '3 раза в день по 5–6 глотков',
    notes: 'Губы сомкнуты, зубы в прикусе. Утро / день / вечер.',
  },
  {
    id: 's-water-trainer',
    name: 'Глотаем воду в трейнере',
    group: SWALLOW,
    durationSec: 0,
    reps: '5 раз',
    notes: '',
  },
  {
    id: 's-water-rinse',
    name: 'Глотаем воду через полоскание',
    group: SWALLOW,
    durationSec: 0,
    reps: '3 раза',
    notes: 'Кончик языка зажат между зубов.',
  },

  // —— Дыхание ——
  {
    id: 'b-breathe',
    name: 'Дышим',
    group: BREATH,
    durationSec: 0,
    reps: '8 раз',
    notes: 'Дышим носом.',
  },
  {
    id: 'b-nostril',
    name: 'Попеременное дыхание каждой ноздрей',
    group: BREATH,
    durationSec: 0,
    reps: '5 раз',
    notes: 'Короткий спокойный вдох одной ноздрёй, выдох другой.',
  },
  {
    id: 'b-drivers',
    name: 'Погонщики',
    group: BREATH,
    durationSec: 0,
    reps: '12 подходов по 8 раз',
    notes: '',
  },
  {
    id: 'b-stomp',
    name: 'Топотушки',
    group: BREATH,
    durationSec: 0,
    reps: '5 раз',
    notes: 'Руки вверх; на вдохе тело вниз, на выдохе поднимаемся руками по телу.',
  },
  {
    id: 'b-crow',
    name: 'Ворона',
    group: BREATH,
    durationSec: 0,
    reps: '5 раз',
    notes: 'Вдох короткий и быстрый, выдох медленный и длинный.',
  },
  {
    id: 'b-gun',
    name: 'Пулемёт',
    group: BREATH,
    durationSec: 0,
    reps: '8 раз',
    notes: 'Нужны 2–3 ватных диска. Сдувать выдохом через нос поочерёдно.',
  },
  {
    id: 'b-hamster',
    name: 'Хомяк',
    group: BREATH,
    durationSec: 120,
    reps: '',
    notes: 'Нужна питьевая вода. Удерживаем воду во рту 2 минуты.',
  },
]

export const ROUTINE_NOTE =
  'Комплекс лучше 2–3 раза в день. Минимум — 1 раз обязательно. После занятий должно быть лёгкое чувство усталости.'

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Keep diary dates in [2 Sep … today]. Before school starts, only 2 Sep is selectable. */
export function clampSchoolGradeDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return SCHOOL_GRADES_START
  if (date < SCHOOL_GRADES_START) return SCHOOL_GRADES_START
  const today = todayKey()
  const cap = today < SCHOOL_GRADES_START ? SCHOOL_GRADES_START : today
  return date > cap ? cap : date
}

export function canEnterSchoolGrade(date: string): boolean {
  return date >= SCHOOL_GRADES_START && date <= todayKey()
}

export function emptyDayLog(date: string): DayLog {
  return {
    date,
    mode: isCookingWeekday(date) ? 'cooking' : 'home',
    mustDo: {},
    mustDoAt: {},
    medSlots: {},
    medSlotsAt: {},
    exercisesDone: {},
    timersHonored: {},
    workoutStartedAt: null,
    workoutFinishedAt: null,
    workoutSessions: [],
    exercisePartial: false,
    perfectAt: null,
    note: '',
    outing: 'none',
    extraTasks: [],
    deletedExtraTaskIds: [],
    reminders: [],
    deletedReminderIds: [],
    createNote: '',
    createIdeas: [],
    puzzlePieces: 0,
    legoPieces: 0,
    createKinds: [],
    electiveDone: {},
    robloxBonusMin: 0,
    screens: {
      roblox: emptyScreenSlot(SCREEN_LIMITS.roblox.seconds),
    },
  }
}

function normalizeExtraTasks(raw: unknown): DayExtraTask[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): DayExtraTask | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Partial<DayExtraTask>
      const text = typeof row.text === 'string' ? row.text.trim() : ''
      if (!text) return null
      const fromParentAs =
        typeof row.fromParentAs === 'string' ? row.fromParentAs.trim() : ''
      return {
        id: typeof row.id === 'string' && row.id ? row.id : uid(),
        text,
        done: Boolean(row.done),
        ...(row.fromParent ? { fromParent: true } : {}),
        ...(fromParentAs ? { fromParentAs } : {}),
      }
    })
    .filter((t): t is DayExtraTask => t !== null)
}

function normalizeReminderTime(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) return undefined
  return trimmed
}

function normalizeReminders(raw: unknown): DayReminder[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): DayReminder | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Partial<DayReminder>
      const text = typeof row.text === 'string' ? row.text.trim() : ''
      if (!text) return null
      const fromParentAs =
        typeof row.fromParentAs === 'string' ? row.fromParentAs.trim() : ''
      const time = normalizeReminderTime(row.time)
      return {
        id: typeof row.id === 'string' && row.id ? row.id : uid(),
        text,
        ...(time ? { time } : {}),
        ...(row.fromParent ? { fromParent: true } : {}),
        ...(fromParentAs ? { fromParentAs } : {}),
      }
    })
    .filter((t): t is DayReminder => t !== null)
}

function resolveDayCreatePieces(
  raw: Partial<DayLog>,
  kind: CreateKind,
): number {
  const field = kind === 'puzzle' ? raw.puzzlePieces : raw.legoPieces
  const n = normalizeCreatePieces(field)
  if (n > 0) return n
  const label = kind === 'puzzle' ? 'Пазл' : 'Лего'
  const ideas = Array.isArray(raw.createIdeas) ? raw.createIdeas : []
  const note = (raw.createNote ?? '').trim()
  const had =
    ideas.includes(label) ||
    note === label ||
    note.includes(label) ||
    (Array.isArray(raw.createKinds) && raw.createKinds.includes(kind)) ||
    (raw as { createKind?: unknown }).createKind === kind
  return had ? 1 : 0
}

export function normalizeDayLog(date: string, raw?: Partial<DayLog> | null): DayLog {
  const base = emptyDayLog(date)
  if (!raw) return base
  const deletedExtraTaskIds = normalizeDeletedIds(raw.deletedExtraTaskIds)
  const deletedReminderIds = normalizeDeletedIds(raw.deletedReminderIds)
  const deletedTasks = new Set(deletedExtraTaskIds)
  const deletedReminders = new Set(deletedReminderIds)
  const puzzlePieces = resolveDayCreatePieces(raw, 'puzzle')
  const legoPieces = resolveDayCreatePieces(raw, 'lego')
  const noteRaw = (raw.createNote ?? '').trim()
  let createNote = ''
  if (noteRaw && !CREATE_IDEAS.includes(noteRaw) && !CREATE_KIND_BY_IDEA[noteRaw]) {
    if (noteRaw.includes('·')) {
      createNote = noteRaw
        .split('·')
        .map((p) => p.trim())
        .filter(
          (p) => p && !CREATE_IDEAS.includes(p) && !CREATE_KIND_BY_IDEA[p],
        )
        .join(' · ')
    } else {
      createNote = noteRaw
    }
  }
  return {
    ...base,
    ...raw,
    date,
    mustDo: raw.mustDo ?? {},
    mustDoAt: normalizeMustDoAt(raw.mustDoAt, raw.mustDo ?? {}),
    medSlots: normalizeMedSlots(raw.medSlots),
    medSlotsAt: normalizeMedSlotsAt(raw.medSlotsAt, normalizeMedSlots(raw.medSlots)),
    exercisesDone: raw.exercisesDone ?? {},
    timersHonored: normalizeBoolMap(raw.timersHonored),
    workoutStartedAt: normalizeTimestamp(raw.workoutStartedAt),
    workoutFinishedAt: normalizeTimestamp(raw.workoutFinishedAt),
    workoutSessions: normalizeWorkoutSessions(raw.workoutSessions),
    exercisePartial: Boolean(raw.exercisePartial),
    perfectAt: normalizeTimestamp(raw.perfectAt),
    createNote,
    createIdeas: normalizeCreateIdeas(raw.createIdeas, raw.createNote ?? ''),
    puzzlePieces,
    legoPieces,
    createKinds: createKindsFromPieces(puzzlePieces, legoPieces),
    electiveDone: normalizeBoolMap(raw.electiveDone),
    extraTasks: normalizeExtraTasks(raw.extraTasks).filter(
      (t) => !deletedTasks.has(t.id),
    ),
    deletedExtraTaskIds,
    reminders: normalizeReminders(raw.reminders).filter(
      (r) => !deletedReminders.has(r.id),
    ),
    deletedReminderIds,
    robloxBonusMin: normalizeNonNegInt(raw.robloxBonusMin),
    screens: {
      roblox: normalizeScreenSlot(
        SCREEN_LIMITS.roblox.seconds,
        raw.screens?.roblox,
      ),
    },
  }
}

function mergeBoolMaps(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
): Record<string, boolean> {
  const out: Record<string, boolean> = { ...a }
  for (const [key, value] of Object.entries(b)) {
    if (value || out[key]) out[key] = true
  }
  return out
}

function normalizeDeletedIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function mergeExtraTasks(
  a: DayExtraTask[],
  b: DayExtraTask[],
  deletedA: string[],
  deletedB: string[],
): { tasks: DayExtraTask[]; deletedIds: string[] } {
  const deletedIds = normalizeDeletedIds([...deletedA, ...deletedB])
  const deleted = new Set(deletedIds)
  const byId = new Map<string, DayExtraTask>()
  for (const task of [...a, ...b]) {
    if (deleted.has(task.id)) continue
    const prev = byId.get(task.id)
    if (!prev) {
      byId.set(task.id, task)
      continue
    }
    byId.set(task.id, {
      ...prev,
      ...task,
      text: task.text || prev.text,
      done: Boolean(prev.done || task.done),
      fromParent: Boolean(prev.fromParent || task.fromParent),
      fromParentAs: task.fromParentAs || prev.fromParentAs,
    })
  }
  return { tasks: [...byId.values()], deletedIds }
}

function mergeReminders(
  a: DayReminder[],
  b: DayReminder[],
  deletedA: string[],
  deletedB: string[],
): { reminders: DayReminder[]; deletedIds: string[] } {
  const deletedIds = normalizeDeletedIds([...deletedA, ...deletedB])
  const deleted = new Set(deletedIds)
  const byId = new Map<string, DayReminder>()
  for (const item of [...a, ...b]) {
    if (deleted.has(item.id)) continue
    const prev = byId.get(item.id)
    if (!prev) {
      byId.set(item.id, item)
      continue
    }
    byId.set(item.id, {
      ...prev,
      ...item,
      text: item.text || prev.text,
      time: item.time || prev.time,
      fromParent: Boolean(prev.fromParent || item.fromParent),
      fromParentAs: item.fromParentAs || prev.fromParentAs,
    })
  }
  return { reminders: [...byId.values()], deletedIds }
}

function mergeScreenSlots(a: ScreenSlot, b: ScreenSlot): ScreenSlot {
  const usedSec = Math.max(a.usedSec, b.usedSec)
  const overtimeSec = Math.max(a.overtimeSec ?? 0, b.overtimeSec ?? 0)
  const finished = a.finished || b.finished
  // Prefer an active timer if one side is still running.
  const endsAt =
    a.endsAt != null && !a.finished
      ? a.endsAt
      : b.endsAt != null && !b.finished
        ? b.endsAt
        : null
  const remainingSec =
    endsAt != null
      ? Math.max(a.remainingSec, b.remainingSec)
      : Math.max(a.remainingSec, b.remainingSec)
  const overtimeStartedAt =
    !finished && (a.overtimeStartedAt != null || b.overtimeStartedAt != null)
      ? Math.min(
          a.overtimeStartedAt ?? Number.POSITIVE_INFINITY,
          b.overtimeStartedAt ?? Number.POSITIVE_INFINITY,
        )
      : null
  return {
    endsAt,
    remainingSec,
    finished,
    usedSec,
    overtimeSec,
    overtimeStartedAt:
      overtimeStartedAt === Number.POSITIVE_INFINITY ? null : overtimeStartedAt,
  }
}

/** Merge two day logs so concurrent parent/child edits keep both sides' progress. */
export function mergeDayLog(
  date: string,
  local?: Partial<DayLog> | null,
  remote?: Partial<DayLog> | null,
  plan: SchoolDayPlan = EMPTY_SCHOOL_DAY_PLAN,
): DayLog {
  if (!local) return normalizeDayLog(date, remote)
  if (!remote) return normalizeDayLog(date, local)
  const a = normalizeDayLog(date, local)
  const b = normalizeDayLog(date, remote)
  const mustDo: Partial<Record<MustDoId, boolean>> = {}
  const mustDoAt: Partial<Record<MustDoId, number>> = {}
  for (const item of MUST_DO_ITEMS) {
    const id = item.id
    if (a.mustDo[id] || b.mustDo[id]) {
      mustDo[id] = true
      const times = [a.mustDoAt[id], b.mustDoAt[id]].filter(
        (n): n is number => typeof n === 'number' && Number.isFinite(n),
      )
      if (times.length) mustDoAt[id] = Math.min(...times)
    }
  }
  const medSlots: Partial<Record<MedSlotId, boolean>> = {}
  const medSlotsAt: Partial<Record<MedSlotId, number>> = {}
  for (const item of MED_SLOT_ITEMS) {
    const id = item.id
    if (a.medSlots[id] || b.medSlots[id]) {
      medSlots[id] = true
      const times = [a.medSlotsAt[id], b.medSlotsAt[id]].filter(
        (n): n is number => typeof n === 'number' && Number.isFinite(n),
      )
      if (times.length) medSlotsAt[id] = Math.min(...times)
    }
  }
  const started = [a.workoutStartedAt, b.workoutStartedAt].filter(
    (n): n is number => n != null,
  )
  const finished = [a.workoutFinishedAt, b.workoutFinishedAt].filter(
    (n): n is number => n != null,
  )
  const perfectTimes = [a.perfectAt, b.perfectAt].filter(
    (n): n is number => n != null,
  )
  const mergedMustDo: Partial<Record<MustDoId, boolean>> = mustDo
  const mergedPerfect =
    requiredMustDoItems(date, plan).every((item) => mergedMustDo[item.id]) &&
    perfectTimes.length > 0
      ? Math.min(...perfectTimes)
      : null
  const extra = mergeExtraTasks(
    a.extraTasks,
    b.extraTasks,
    a.deletedExtraTaskIds,
    b.deletedExtraTaskIds,
  )
  const reminders = mergeReminders(
    a.reminders,
    b.reminders,
    a.deletedReminderIds,
    b.deletedReminderIds,
  )
  return normalizeDayLog(date, {
    mode: a.mode !== 'home' ? a.mode : b.mode,
    mustDo,
    mustDoAt,
    medSlots,
    medSlotsAt,
    exercisesDone: mergeBoolMaps(a.exercisesDone, b.exercisesDone),
    timersHonored: mergeBoolMaps(a.timersHonored, b.timersHonored),
    workoutStartedAt: started.length ? Math.min(...started) : null,
    workoutFinishedAt: finished.length ? Math.max(...finished) : null,
    workoutSessions: mergeWorkoutSessions(a.workoutSessions, b.workoutSessions),
    exercisePartial:
      Boolean(a.exercisePartial || b.exercisePartial) &&
      finished.length === 0,
    perfectAt: mergedPerfect,
    note: a.note.trim() ? a.note : b.note,
    outing: a.outing.trim() ? a.outing : b.outing,
    extraTasks: extra.tasks,
    deletedExtraTaskIds: extra.deletedIds,
    reminders: reminders.reminders,
    deletedReminderIds: reminders.deletedIds,
    createNote: a.createNote.trim() ? a.createNote : b.createNote,
    createIdeas: (() => {
      const merged: string[] = []
      for (const idea of [...a.createIdeas, ...b.createIdeas]) {
        if (!merged.includes(idea)) merged.push(idea)
      }
      return merged
    })(),
    puzzlePieces: Math.max(a.puzzlePieces, b.puzzlePieces),
    legoPieces: Math.max(a.legoPieces, b.legoPieces),
    createKinds: createKindsFromPieces(
      Math.max(a.puzzlePieces, b.puzzlePieces),
      Math.max(a.legoPieces, b.legoPieces),
    ),
    electiveDone: mergeBoolMaps(a.electiveDone, b.electiveDone),
    robloxBonusMin: Math.max(a.robloxBonusMin, b.robloxBonusMin),
    screens: {
      roblox: mergeScreenSlots(a.screens.roblox, b.screens.roblox),
    },
  })
}

export function mergeDaysMaps(
  local: Record<string, DayLog>,
  remote: Record<string, DayLog>,
  plan: SchoolDayPlan = EMPTY_SCHOOL_DAY_PLAN,
): Record<string, DayLog> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const out: Record<string, DayLog> = {}
  for (const key of keys) {
    out[key] = mergeDayLog(key, local[key], remote[key], plan)
  }
  return out
}

export function mergeChewEntries(
  local: ChewEntry[],
  remote: ChewEntry[],
): ChewEntry[] {
  const byId = new Map<string, ChewEntry>()
  for (const entry of [...local, ...remote]) {
    const prev = byId.get(entry.id)
    if (!prev || entry.createdAt >= prev.createdAt) byId.set(entry.id, entry)
  }
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt)
}

function normalizeBoolMap(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value) out[key] = true
  }
  return out
}

function normalizeMustDoAt(
  raw: unknown,
  mustDo: Partial<Record<MustDoId, boolean>>,
): Partial<Record<MustDoId, number>> {
  const out: Partial<Record<MustDoId, number>> = {}
  if (raw && typeof raw === 'object') {
    for (const item of MUST_DO_ITEMS) {
      const n = (raw as Record<string, unknown>)[item.id]
      if (typeof n === 'number' && Number.isFinite(n) && mustDo[item.id]) {
        out[item.id] = Math.floor(n)
      }
    }
  }
  return out
}

/**
 * Apply must-do checkbox changes and keep first-checked timestamps.
 * Unchecking clears the time; checking again starts a new stamp.
 */
export function applyMustDoFlags(
  day: DayLog,
  flags: Partial<Record<MustDoId, boolean>>,
  at = Date.now(),
): Pick<DayLog, 'mustDo' | 'mustDoAt'> {
  const mustDo = { ...day.mustDo }
  const mustDoAt = { ...(day.mustDoAt ?? {}) }
  for (const item of MUST_DO_ITEMS) {
    if (flags[item.id] === undefined) continue
    const checked = Boolean(flags[item.id])
    mustDo[item.id] = checked
    if (checked) {
      if (mustDoAt[item.id] == null) mustDoAt[item.id] = at
    } else {
      delete mustDoAt[item.id]
    }
  }
  return { mustDo, mustDoAt }
}

function normalizeMedSlots(
  raw: unknown,
): Partial<Record<MedSlotId, boolean>> {
  const out: Partial<Record<MedSlotId, boolean>> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const item of MED_SLOT_ITEMS) {
    if ((raw as Record<string, unknown>)[item.id]) out[item.id] = true
  }
  return out
}

function normalizeMedSlotsAt(
  raw: unknown,
  medSlots: Partial<Record<MedSlotId, boolean>>,
): Partial<Record<MedSlotId, number>> {
  const out: Partial<Record<MedSlotId, number>> = {}
  if (raw && typeof raw === 'object') {
    for (const item of MED_SLOT_ITEMS) {
      const n = (raw as Record<string, unknown>)[item.id]
      if (typeof n === 'number' && Number.isFinite(n) && medSlots[item.id]) {
        out[item.id] = Math.floor(n)
      }
    }
  }
  return out
}

/**
 * Apply pill-slot checkbox changes and keep first-checked timestamps.
 * Unchecking clears the time; checking again starts a new stamp.
 */
export function applyMedSlotFlags(
  day: DayLog,
  flags: Partial<Record<MedSlotId, boolean>>,
  at = Date.now(),
): Pick<DayLog, 'medSlots' | 'medSlotsAt'> {
  const medSlots = { ...day.medSlots }
  const medSlotsAt = { ...(day.medSlotsAt ?? {}) }
  for (const item of MED_SLOT_ITEMS) {
    if (flags[item.id] === undefined) continue
    const checked = Boolean(flags[item.id])
    medSlots[item.id] = checked
    if (checked) {
      if (medSlotsAt[item.id] == null) medSlotsAt[item.id] = at
    } else {
      delete medSlotsAt[item.id]
    }
  }
  return { medSlots, medSlotsAt }
}

function normalizeNonNegInt(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw))
}

function normalizeTimestamp(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

function normalizeWorkoutSessions(raw: unknown): WorkoutSession[] {
  if (!Array.isArray(raw)) return []
  const out: WorkoutSession[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<WorkoutSession>
    const startedAt = normalizeTimestamp(row.startedAt)
    if (startedAt == null) continue
    const endedAt = normalizeTimestamp(row.endedAt)
    out.push({
      startedAt,
      endedAt:
        endedAt != null && endedAt >= startedAt ? endedAt : null,
    })
  }
  return out.sort((a, b) => a.startedAt - b.startedAt)
}

function mergeWorkoutSessions(
  a: WorkoutSession[],
  b: WorkoutSession[],
): WorkoutSession[] {
  const map = new Map<number, WorkoutSession>()
  for (const s of [...a, ...b]) {
    const prev = map.get(s.startedAt)
    if (!prev) {
      map.set(s.startedAt, s)
      continue
    }
    if (prev.endedAt == null || s.endedAt == null) {
      map.set(s.startedAt, { startedAt: s.startedAt, endedAt: null })
    } else {
      map.set(s.startedAt, {
        startedAt: s.startedAt,
        endedAt: Math.max(prev.endedAt, s.endedAt),
      })
    }
  }
  return [...map.values()].sort((x, y) => x.startedAt - y.startedAt)
}

export function ensureOpenWorkoutSession(
  sessions: WorkoutSession[],
  now: number,
): WorkoutSession[] {
  if (sessions.some((s) => s.endedAt == null)) return sessions
  return [...sessions, { startedAt: now, endedAt: null }]
}

export function closeOpenWorkoutSession(
  sessions: WorkoutSession[],
  now: number,
): WorkoutSession[] {
  return sessions
    .map((s) => (s.endedAt == null ? { ...s, endedAt: now } : s))
    .filter((s) => s.endedAt == null || s.endedAt > s.startedAt)
}

/** Things to prepare before a block (display order). */
export const EXERCISE_GEAR_LABELS = [
  'Капа',
  'Вода',
  'Ватные диски',
] as const

export type ExerciseGear = (typeof EXERCISE_GEAR_LABELS)[number]

function exerciseTextBlob(ex: Exercise): string {
  return `${ex.group} ${ex.name} ${ex.notes}`.toLowerCase()
}

/** Gear required for one exercise (from group / name / notes). */
export function exerciseGearNeeds(ex: Exercise): ExerciseGear[] {
  const blob = exerciseTextBlob(ex)
  const out: ExerciseGear[] = []
  if (
    blob.includes('трейнер') ||
    blob.includes('капа') ||
    blob.includes('капы') ||
    blob.includes('капу')
  ) {
    out.push('Капа')
  }
  if (
    blob.includes('вода') ||
    blob.includes('воду') ||
    blob.includes('водой') ||
    blob.includes('воды')
  ) {
    out.push('Вода')
  }
  if (blob.includes('ватн')) {
    out.push('Ватные диски')
  }
  return out
}

/** Unique gear for a block, stable order. */
export function groupGearNeeds(
  group: string,
  items: Exercise[],
): ExerciseGear[] {
  const found = new Set<ExerciseGear>()
  if (group.toLowerCase().includes('трейнер')) found.add('Капа')
  for (const ex of items) {
    for (const g of exerciseGearNeeds(ex)) found.add(g)
  }
  return EXERCISE_GEAR_LABELS.filter((label) => found.has(label))
}

/** Exercise needs капа / трейнер (group, name, or notes). */
export function exerciseNeedsTrainer(ex: Exercise): boolean {
  return exerciseGearNeeds(ex).includes('Капа')
}

export function groupNeedsTrainer(group: string, items: Exercise[]): boolean {
  return groupGearNeeds(group, items).includes('Капа')
}

/**
 * Clean workout seconds: sum of session lengths (gaps excluded).
 * Open session counts until `now`. Legacy days without sessions use wall-clock.
 */
export function workoutDurationSec(
  day: DayLog,
  now = Date.now(),
): number | null {
  const sessions = day.workoutSessions ?? []
  if (sessions.length > 0) {
    let totalMs = 0
    for (const s of sessions) {
      const end = s.endedAt ?? now
      totalMs += Math.max(0, end - s.startedAt)
    }
    return Math.max(0, Math.floor(totalMs / 1000))
  }
  if (day.workoutStartedAt == null || day.workoutFinishedAt == null) return null
  return Math.max(
    0,
    Math.floor((day.workoutFinishedAt - day.workoutStartedAt) / 1000),
  )
}

/** Elapsed chew seconds from first filled cell to save, if tracked. */
export function chewDurationSec(entry: {
  startedAt?: number
  createdAt: number
}): number | null {
  if (typeof entry.startedAt !== 'number' || !Number.isFinite(entry.startedAt)) {
    return null
  }
  return Math.max(0, Math.floor((entry.createdAt - entry.startedAt) / 1000))
}

function normalizeScreenSlot(
  limitSec: number,
  raw?: Partial<ScreenSlot> | null,
): ScreenSlot {
  const base = emptyScreenSlot(limitSec)
  if (!raw) return base
  const usedSec =
    typeof raw.usedSec === 'number' && Number.isFinite(raw.usedSec)
      ? Math.max(0, Math.floor(raw.usedSec))
      : 0
  const overtimeSec =
    typeof raw.overtimeSec === 'number' && Number.isFinite(raw.overtimeSec)
      ? Math.max(0, Math.floor(raw.overtimeSec))
      : 0
  const overtimeStartedAt =
    typeof raw.overtimeStartedAt === 'number' &&
    Number.isFinite(raw.overtimeStartedAt)
      ? raw.overtimeStartedAt
      : null
  return {
    ...base,
    ...raw,
    usedSec,
    overtimeSec,
    overtimeStartedAt,
  }
}

export function formatClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec))
  const m = String(Math.floor(safe / 60)).padStart(2, '0')
  const s = String(safe % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function isCookingWeekday(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return day === 2 || day === 3 || day === 4
}

export function defaultAppData(): AppData {
  return {
    exercises: resolveExercises(undefined),
    days: {},
    chewEntries: [],
    exerciseControls: [],
    cookingLeft: 5,
    routineId: ROUTINE_ID,
    claimedRobloxStreaks: [],
    robloxBonusBankMin: 0,
    robloxBonusEarnedMin: 0,
    robloxEnabled: true,
    robloxLimitMin: DEFAULT_ROBLOX_LIMIT_MIN,
    robloxSettingsUpdatedAt: 0,
    medications: [],
    medicationUpdatedAt: 0,
    moneyBankRub: 0,
    banksUpdatedAt: 0,
    claimedStickerMoneyIds: [],
    claimedStickerRobloxIds: [],
    dismissedGiftStickerIds: [],
    equippedStickerId: null,
    bestStreak: 0,
    bestParentTasks: 0,
    readingBooks: [],
    finishedBooks: [],
    puzzleCount: 0,
    legoCount: 0,
    schoolGrades: [],
    deletedSchoolGradeIds: [],
    extraBreakDates: [],
    extraSchoolDates: [],
    schoolCalendarUpdatedAt: 0,
    electives: DEFAULT_ELECTIVES.map((e) => ({ ...e })),
    electivesUpdatedAt: 0,
  }
}

/** Exercises that appear in the child's daily routine */
export function activeExercises(exercises: Exercise[]): Exercise[] {
  return exercises.filter((e) => e.enabled !== false)
}

function normalizeExercise(raw: unknown): Exercise | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<Exercise>
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (!id || !name) return null
  const durationSec =
    typeof row.durationSec === 'number' && Number.isFinite(row.durationSec)
      ? Math.max(0, Math.floor(row.durationSec))
      : 0
  return {
    id,
    name,
    group: typeof row.group === 'string' && row.group.trim() ? row.group.trim() : 'Другое',
    durationSec,
    reps: typeof row.reps === 'string' ? row.reps : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    enabled: row.enabled !== false,
    ...(row.custom ? { custom: true } : {}),
  }
}

/**
 * Merge built-in routine with stored overrides:
 * - user edits (name/reps/notes/timer/group), enabled and order are preserved
 * - custom exercises are kept in their stored positions
 * - new defaults (app update) insert near their neighbors
 */
export function resolveExercises(stored: unknown): Exercise[] {
  const list = Array.isArray(stored)
    ? stored.map(normalizeExercise).filter((e): e is Exercise => e !== null)
    : []
  if (list.length === 0) {
    return DEFAULT_EXERCISES.map((def) => ({
      ...def,
      enabled: true,
      custom: false,
    }))
  }

  const defaultById = new Map(DEFAULT_EXERCISES.map((e) => [e.id, e]))
  const result: Exercise[] = []
  const seen = new Set<string>()

  for (const row of list) {
    const def = defaultById.get(row.id)
    if (def) {
      result.push({
        id: def.id,
        name: row.name.trim() || def.name,
        group: row.group.trim() || def.group,
        durationSec: row.durationSec,
        reps: row.reps,
        notes: row.notes,
        enabled: row.enabled !== false,
        custom: false,
      })
    } else {
      result.push({
        ...row,
        custom: true,
        enabled: row.enabled !== false,
      })
    }
    seen.add(row.id)
  }

  for (let i = 0; i < DEFAULT_EXERCISES.length; i++) {
    const def = DEFAULT_EXERCISES[i]!
    if (seen.has(def.id)) continue
    let insertAt = result.length
    for (let j = i - 1; j >= 0; j--) {
      const prevId = DEFAULT_EXERCISES[j]!.id
      const idx = result.findIndex((e) => e.id === prevId)
      if (idx >= 0) {
        insertAt = idx + 1
        break
      }
    }
    result.splice(insertAt, 0, {
      ...def,
      enabled: true,
      custom: false,
    })
    seen.add(def.id)
  }

  return result
}

/**
 * Merge exercise catalogs from local (a) and remote/cloud (b).
 * Field values merge; disable wins. Order follows remote (b) so parent
 * add/reorder reaches the child — local-only ids append at the end.
 */
export function mergeExercises(a: Exercise[], b: Exercise[]): Exercise[] {
  const map = new Map<string, Exercise>()
  for (const ex of [...a, ...b]) {
    const prev = map.get(ex.id)
    if (!prev) {
      map.set(ex.id, ex)
      continue
    }
    map.set(ex.id, {
      ...prev,
      ...ex,
      custom: Boolean(prev.custom || ex.custom),
      // Disable wins — intentional parent action
      enabled: prev.enabled === false || ex.enabled === false ? false : true,
    })
  }
  // Prefer remote (b) order, then append ids only present locally
  const order: string[] = []
  for (const ex of b) {
    if (!order.includes(ex.id)) order.push(ex.id)
  }
  for (const ex of a) {
    if (!order.includes(ex.id)) order.push(ex.id)
  }
  return resolveExercises(order.map((id) => map.get(id)!).filter(Boolean))
}

/** Move an exercise to a new index in the routine list. */
export function moveExerciseInList(
  exercises: Exercise[],
  fromIndex: number,
  toIndex: number,
): Exercise[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= exercises.length ||
    toIndex >= exercises.length ||
    fromIndex === toIndex
  ) {
    return exercises
  }
  const next = [...exercises]
  const [item] = next.splice(fromIndex, 1)
  if (!item) return exercises
  next.splice(toIndex, 0, item)
  return next
}

/** Move exercise to 1-based position in the routine. */
export function moveExerciseToPosition(
  exercises: Exercise[],
  id: string,
  position1Based: number,
): Exercise[] {
  const fromIndex = exercises.findIndex((e) => e.id === id)
  if (fromIndex < 0) return exercises
  const toIndex = Math.max(
    0,
    Math.min(exercises.length - 1, Math.floor(position1Based) - 1),
  )
  return moveExerciseInList(exercises, fromIndex, toIndex)
}

export function normalizeExerciseControls(raw: unknown): ExerciseControl[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): ExerciseControl | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Partial<ExerciseControl>
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      const exerciseId =
        typeof row.exerciseId === 'string' ? row.exerciseId.trim() : ''
      const date = typeof row.date === 'string' ? row.date.trim() : ''
      if (!id || !exerciseId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
      return { id, exerciseId, date, filmed: Boolean(row.filmed) }
    })
    .filter((c): c is ExerciseControl => c !== null)
}

export function mergeExerciseControls(
  a: ExerciseControl[],
  b: ExerciseControl[],
): ExerciseControl[] {
  const map = new Map<string, ExerciseControl>()
  for (const item of [...a, ...b]) {
    const prev = map.get(item.id)
    if (!prev) {
      map.set(item.id, item)
      continue
    }
    map.set(item.id, {
      ...prev,
      ...item,
      filmed: Boolean(prev.filmed || item.filmed),
    })
  }
  return [...map.values()].sort((x, y) =>
    x.date === y.date
      ? x.id.localeCompare(y.id)
      : x.date < y.date
        ? -1
        : 1,
  )
}

/** Mark all active exercises done (parent override / myotherapist session). */
export function markAllExercisesDone(
  day: DayLog,
  exercises: Exercise[],
): DayLog {
  const active = activeExercises(exercises)
  const exercisesDone = { ...day.exercisesDone }
  for (const ex of active) {
    exercisesDone[ex.id] = true
  }
  // Do not invent workout timestamps — a parent checkbox is not a timed session
  // (same-ms start/finish would look like a "shortcut" workout for stickers).
  const flags = applyMustDoFlags(day, { exercise: true })
  return normalizeDayLog(day.date, {
    ...day,
    exercisesDone,
    exercisePartial: false,
    ...flags,
  })
}

/** Parent: grant exercise star without full routine (keeps child's exercisesDone). */
export function markExercisesPartialCredit(day: DayLog): DayLog {
  const flags = applyMustDoFlags(day, { exercise: true })
  return normalizeDayLog(day.date, {
    ...day,
    exercisePartial: true,
    workoutFinishedAt: null,
    ...flags,
  })
}

/** Parent: clear exercise star / partial credit (does not wipe exercisesDone). */
export function clearExercisesCredit(day: DayLog): DayLog {
  const flags = applyMustDoFlags(day, { exercise: false })
  return normalizeDayLog(day.date, {
    ...day,
    exercisePartial: false,
    ...flags,
  })
}

export function controlsForDate(
  controls: ExerciseControl[] | undefined,
  date: string,
): ExerciseControl[] {
  return (controls ?? []).filter((c) => c.date === date)
}

export function controlForExerciseOnDate(
  controls: ExerciseControl[] | undefined,
  date: string,
  exerciseId: string,
): ExerciseControl | undefined {
  return (controls ?? []).find(
    (c) => c.date === date && c.exerciseId === exerciseId,
  )
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m <= 0) return `${s} сек`
  if (s === 0) return `${m} мин`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Local clock time from Unix ms, e.g. «14:15». */
export function formatTimeOfDay(ms: number): string {
  const d = new Date(ms)
  if (!Number.isFinite(d.getTime())) return ''
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** How many timed rounds an exercise needs (from reps text like «2 подхода»). */
export function parseTimerRounds(reps: string): number {
  const match = reps.match(/(\d+)\s*подход/i)
  if (match) return Math.max(1, Number(match[1]))
  return 1
}

export function uid(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export type DatedReminder = DayReminder & { date: string }

function compareReminders(a: DatedReminder, b: DatedReminder): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const ta = a.time ?? '99:99'
  const tb = b.time ?? '99:99'
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.text.localeCompare(b.text, 'ru')
}

/** Reminders from today onward, sorted by date then time. */
export function listUpcomingReminders(
  days: Record<string, DayLog>,
  from = todayKey(),
): DatedReminder[] {
  const out: DatedReminder[] = []
  for (const [date, raw] of Object.entries(days ?? {})) {
    if (date < from) continue
    const day = normalizeDayLog(date, raw)
    for (const reminder of day.reminders) {
      out.push({ ...reminder, date })
    }
  }
  return out.sort(compareReminders)
}

export function formatReminderDayLabel(dateKey: string, today = todayKey()): string {
  if (dateKey === today) return 'сегодня'
  const [y, m, d] = dateKey.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })
  const tomorrow = (() => {
    const [ty, tm, td] = today.split('-').map(Number)
    const next = new Date(ty, tm - 1, td)
    next.setDate(next.getDate() + 1)
    return todayKey(next)
  })()
  if (dateKey === tomorrow) return `завтра, ${label}`
  return label
}

/** Patch reminders on an arbitrary day (appointments may be in the future). */
export function setDayReminders(
  data: AppData,
  date: string,
  reminders: DayReminder[],
  deletedReminderIds?: string[],
): AppData {
  const day = normalizeDayLog(date, data.days[date])
  return {
    ...data,
    days: {
      ...data.days,
      [date]: normalizeDayLog(date, {
        ...day,
        reminders,
        ...(deletedReminderIds ? { deletedReminderIds } : {}),
      }),
    },
  }
}

export function groupExercises(exercises: Exercise[]): { group: string; items: Exercise[] }[] {
  const order: string[] = []
  const map = new Map<string, Exercise[]>()
  for (const ex of exercises) {
    const g = ex.group || 'Другое'
    if (!map.has(g)) {
      map.set(g, [])
      order.push(g)
    }
    map.get(g)!.push(ex)
  }
  return order.map((group) => ({ group, items: map.get(group)! }))
}

/** Distinct group names from the current exercise list (for add form). */
export function exerciseGroupNames(exercises: Exercise[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ex of exercises) {
    const g = ex.group || 'Другое'
    if (seen.has(g)) continue
    seen.add(g)
    out.push(g)
  }
  return out
}
