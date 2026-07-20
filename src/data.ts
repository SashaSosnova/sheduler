import type {
  AppData,
  ChewEntry,
  DayExtraTask,
  DayLog,
  Exercise,
  MustDoId,
  ScreenSlot,
} from './types'

export const ROUTINE_ID = 'daniil-hw-28-v5'

export const MUST_DO_ITEMS: { id: MustDoId; label: string }[] = [
  { id: 'wash-am', label: 'Почистить зубы' },
  { id: 'exercise', label: 'Сделать зарядку' },
  { id: 'chew', label: 'Заполнить дневник жевания' },
  { id: 'read', label: 'Почитать книгу' },
  { id: 'create', label: 'Заняться творчеством' },
]

export const CHEW_FOODS = ['Морковь', 'Яблоко'] as const

export const CREATE_IDEAS = [
  'Рисовать',
  'Лепить',
  'Паззл или Лего',
  'Поделка / оригами',
  'Комикс',
  'Музыка',
  'Что-то смастерить',
]

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

/** Must-do items that should look “main” in the checklist */
export const MAIN_MUST_DO: MustDoId[] = ['exercise', 'chew']

/** Checked only when completed inside the app — not by tapping the checkbox */
export const APP_LOCKED_MUST_DO: MustDoId[] = ['exercise', 'chew', 'read']

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

  // —— Артикуляция ——
  // С пометкой (трейнер) — только те, где это было в ДЗ
  {
    id: 'a-smile',
    name: 'Удержание улыбки (трейнер)',
    group: ARTIC,
    durationSec: 60,
    reps: '',
    notes: 'Удержать мышцы губ 1 минуту.',
  },
  {
    id: 'a-tongues',
    name: 'Язычки здороваются (трейнер)',
    group: ARTIC,
    durationSec: 10,
    reps: '3 подхода',
    notes: 'Удерживать язык под счёт от 1 до 10.',
  },
  {
    id: 'a-bagel',
    name: 'Бублик с удержанием (трейнер)',
    group: ARTIC,
    durationSec: 60,
    reps: '',
    notes: 'Удержать мышцы губ 1 минуту.',
  },
  {
    id: 'a-swing-lips',
    name: 'Качели — губы (трейнер)',
    group: ARTIC,
    durationSec: 0,
    reps: '10 раз',
    notes: 'Раскачиваем закрытую улыбку влево–вправо.',
  },
  {
    id: 'a-brush',
    name: 'Чистим зубы (трейнер)',
    group: ARTIC,
    durationSec: 0,
    reps: 'по 4 раза в каждую сторону',
    notes: 'Кончиком языка по внутренней стороне трейнера по часовой и против.',
  },
  {
    id: 'a-kiss',
    name: 'Холодный поцелуй (трейнер)',
    group: ARTIC,
    durationSec: 60,
    reps: '',
    notes: 'Удерживаем позу 1 минуту. Губы напряжены.',
  },
  {
    id: 'a-koko',
    name: 'Ко-ко-ко (трейнер)',
    group: ARTIC,
    durationSec: 0,
    reps: '20 раз',
    notes: '',
  },
  {
    id: 'a-hare-tiger',
    name: 'Чередование «Заяц» — «Тигр» (трейнер)',
    group: ARTIC,
    durationSec: 0,
    reps: '5 подходов',
    notes: 'Чередуем положение губ.',
  },
  {
    id: 'a-eights',
    name: 'Восьмёрки (трейнер)',
    group: ARTIC,
    durationSec: 0,
    reps: '15–30 раз',
    notes: 'Кончиком языка на твёрдом нёбе.',
  },
  {
    id: 'a-knot',
    name: 'Узелок (трейнер)',
    group: ARTIC,
    durationSec: 60,
    reps: '',
    notes: 'Удерживать 1 минуту.',
  },
  {
    id: 'a-painter',
    name: 'Маляр (трейнер)',
    group: ARTIC,
    durationSec: 0,
    reps: '10 раз',
    notes: 'Спокойный темп.',
  },
  {
    id: 'a-pig',
    name: 'Пятачок (трейнер)',
    group: ARTIC,
    durationSec: 0,
    reps: 'по 5 кружков в каждую сторону',
    notes: 'Губы слегка вперёд, зубы сомкнуты, челюсть неподвижна.',
  },
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

export function emptyDayLog(date: string): DayLog {
  return {
    date,
    mode: isCookingWeekday(date) ? 'cooking' : 'home',
    mustDo: {},
    exercisesDone: {},
    timersHonored: {},
    workoutStartedAt: null,
    workoutFinishedAt: null,
    note: '',
    outing: 'none',
    extraTasks: [],
    createNote: '',
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

export function normalizeDayLog(date: string, raw?: Partial<DayLog> | null): DayLog {
  const base = emptyDayLog(date)
  if (!raw) return base
  return {
    ...base,
    ...raw,
    date,
    mustDo: raw.mustDo ?? {},
    exercisesDone: raw.exercisesDone ?? {},
    timersHonored: normalizeBoolMap(raw.timersHonored),
    workoutStartedAt: normalizeTimestamp(raw.workoutStartedAt),
    workoutFinishedAt: normalizeTimestamp(raw.workoutFinishedAt),
    createNote: raw.createNote ?? '',
    extraTasks: normalizeExtraTasks(raw.extraTasks),
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

function mergeExtraTasks(a: DayExtraTask[], b: DayExtraTask[]): DayExtraTask[] {
  const byId = new Map<string, DayExtraTask>()
  for (const task of [...a, ...b]) {
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
  return [...byId.values()]
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
): DayLog {
  if (!local) return normalizeDayLog(date, remote)
  if (!remote) return normalizeDayLog(date, local)
  const a = normalizeDayLog(date, local)
  const b = normalizeDayLog(date, remote)
  const mustDo: Partial<Record<MustDoId, boolean>> = {}
  for (const item of MUST_DO_ITEMS) {
    if (a.mustDo[item.id] || b.mustDo[item.id]) mustDo[item.id] = true
  }
  const started = [a.workoutStartedAt, b.workoutStartedAt].filter(
    (n): n is number => n != null,
  )
  const finished = [a.workoutFinishedAt, b.workoutFinishedAt].filter(
    (n): n is number => n != null,
  )
  return normalizeDayLog(date, {
    mode: a.mode !== 'home' ? a.mode : b.mode,
    mustDo,
    exercisesDone: mergeBoolMaps(a.exercisesDone, b.exercisesDone),
    timersHonored: mergeBoolMaps(a.timersHonored, b.timersHonored),
    workoutStartedAt: started.length ? Math.min(...started) : null,
    workoutFinishedAt: finished.length ? Math.max(...finished) : null,
    note: a.note.trim() ? a.note : b.note,
    outing: a.outing.trim() ? a.outing : b.outing,
    extraTasks: mergeExtraTasks(a.extraTasks, b.extraTasks),
    createNote: a.createNote.trim() ? a.createNote : b.createNote,
    robloxBonusMin: Math.max(a.robloxBonusMin, b.robloxBonusMin),
    screens: {
      roblox: mergeScreenSlots(a.screens.roblox, b.screens.roblox),
    },
  })
}

export function mergeDaysMaps(
  local: Record<string, DayLog>,
  remote: Record<string, DayLog>,
): Record<string, DayLog> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const out: Record<string, DayLog> = {}
  for (const key of keys) {
    out[key] = mergeDayLog(key, local[key], remote[key])
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

function normalizeNonNegInt(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw))
}

function normalizeTimestamp(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

/** Elapsed workout seconds from first check to full completion, if finished. */
export function workoutDurationSec(day: DayLog): number | null {
  if (day.workoutStartedAt == null || day.workoutFinishedAt == null) return null
  return Math.max(0, Math.floor((day.workoutFinishedAt - day.workoutStartedAt) / 1000))
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
    exercises: DEFAULT_EXERCISES,
    days: {},
    chewEntries: [],
    cookingLeft: 5,
    routineId: ROUTINE_ID,
    claimedRobloxStreaks: [],
    robloxBonusBankMin: 0,
    moneyBankRub: 0,
    claimedStickerMoneyIds: [],
    equippedStickerId: null,
    bestStreak: 0,
    bestParentTasks: 0,
    readingBooks: [],
    finishedBooks: [],
  }
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m <= 0) return `${s} сек`
  if (s === 0) return `${m} мин`
  return `${m}:${String(s).padStart(2, '0')}`
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
