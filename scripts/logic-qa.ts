/**
 * Logic-only checks for day plan, electives, grades, merge, and stickers.
 * Run: npx tsx scripts/logic-qa.ts
 */
import {
  DEFAULT_ELECTIVES,
  EMPTY_SCHOOL_DAY_PLAN,
  NEW_DAY_PLAN_START,
  SCHOOL_GRADES_START,
  SCHOOL_QUARTER_MIN_GRADES,
  backpackMustDoLabel,
  canEnterSchoolGrade,
  clampSchoolGradeDate,
  dateWeekdayMon1,
  defaultAppData,
  electiveLabel,
  electivesOnDate,
  emptyDayLog,
  isRestDay,
  isWeekendDate,
  mergeChewEntries,
  mergeDayLog,
  mergeDaysMaps,
  mergeSchoolGrades,
  mergeWeeklyGradeWeeks,
  nextSchoolDateKey,
  normalizeDayLog,
  normalizeElectiveTime,
  normalizeElectives,
  optionalMustDoItems,
  requiredMustDoItems,
  schoolDayPlanFromData,
  schoolQuarterEndDate,
  schoolQuarterKey,
  schoolSubjectShort,
  todayKey,
  weekEndSaturday,
  weekStartMonday,
  weeklyGradeMoney,
} from '../src/data'
import {
  DEBUG_LOCK_ALL_STICKERS,
  DEBUG_UNLOCK_ALL_STICKERS,
  STICKERS,
  applyPendingStickerMoneyRewards,
  applyPendingStickerRobloxRewards,
  applyPendingWeeklyGradeSettlements,
  countCleanQuarters,
  countExcellentQuarters,
  countFives,
  countFivesInSubject,
  dayStars,
  isPerfectDay,
  stampPerfectAt,
} from '../src/progress'
import type { DayLog, SchoolGrade } from '../src/types'

let failed = 0
let passed = 0

function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) {
    passed++
    return
  }
  failed++
  console.error(`FAIL  ${name}`)
  console.error('  got ', got)
  console.error('  want', want)
}

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++
    return
  }
  failed++
  console.error(`FAIL  ${name}`, detail ?? '')
}

function ids(items: { id: string }[]) {
  return items.map((i) => i.id)
}

function checkAllRequired(date: string, extra?: Partial<DayLog['mustDo']>): DayLog {
  const plan = EMPTY_SCHOOL_DAY_PLAN
  const day = emptyDayLog(date)
  const mustDo: DayLog['mustDo'] = { ...extra }
  for (const item of requiredMustDoItems(date, plan)) mustDo[item.id] = true
  return normalizeDayLog(date, { ...day, mustDo })
}

// --- day plan ---
eq('aug plan is old 5', ids(requiredMustDoItems('2026-08-31')), [
  'wash-am',
  'exercise',
  'chew',
  'read',
  'create',
])
eq('aug has no optional', ids(optionalMustDoItems('2026-08-31')), [])

ok('1 Sep is rest (линейка)', isRestDay('2026-09-01'))
eq('1 Sep required', ids(requiredMustDoItems('2026-09-01')), [
  'wash-am',
  'exercise',
  'chew',
  'read',
])
eq('1 Sep optional is create only', ids(optionalMustDoItems('2026-09-01')), [
  'create',
])

ok('2 Sep 2026 is Wednesday', dateWeekdayMon1('2026-09-02') === 3)
ok('2 Sep is school day', !isRestDay('2026-09-02'))
eq('2 Sep required', ids(requiredMustDoItems('2026-09-02')), [
  'wash-am',
  'exercise',
  'chew',
  'homework',
  'backpack',
])
eq('2 Sep optional', ids(optionalMustDoItems('2026-09-02')), ['read', 'create'])
ok(
  'required and optional do not overlap on 2 Sep',
  requiredMustDoItems('2026-09-02').every(
    (r) => !optionalMustDoItems('2026-09-02').some((o) => o.id === r.id),
  ),
)

ok('weekend is rest', isWeekendDate('2026-09-05') && isRestDay('2026-09-05'))
eq('Saturday required', ids(requiredMustDoItems('2026-09-05')), [
  'wash-am',
  'exercise',
  'chew',
  'read',
])
eq('Saturday optional', ids(optionalMustDoItems('2026-09-05')), ['create'])

const autumnBreak = '2026-10-27'
ok('autumn break is rest', isRestDay(autumnBreak))
eq('break required has read not homework', ids(requiredMustDoItems(autumnBreak)), [
  'wash-am',
  'exercise',
  'chew',
  'read',
])

const sep1AsSchool = schoolDayPlanFromData({
  extraBreakDates: [],
  extraSchoolDates: ['2026-09-01'],
})
ok('extraSchoolDates wins over 1 Sep holiday', !isRestDay('2026-09-01', sep1AsSchool))
eq(
  '1 Sep marked as school has homework',
  ids(requiredMustDoItems('2026-09-01', sep1AsSchool)),
  ['wash-am', 'exercise', 'chew', 'homework', 'backpack'],
)

const bothFlags = schoolDayPlanFromData({
  extraBreakDates: ['2026-09-02'],
  extraSchoolDates: ['2026-09-02'],
})
ok(
  'extraSchoolDates wins over extraBreakDates',
  !isRestDay('2026-09-02', bothFlags),
)

const wedBreak = schoolDayPlanFromData({
  extraBreakDates: ['2026-09-02'],
  extraSchoolDates: [],
})
ok('parent каникулы on Wed', isRestDay('2026-09-02', wedBreak))
eq(
  'Wed каникулы no homework',
  ids(requiredMustDoItems('2026-09-02', wedBreak)),
  ['wash-am', 'exercise', 'chew', 'read'],
)

eq(
  'Friday backpack is for Monday',
  backpackMustDoLabel('2026-09-04'),
  'Собрать рюкзак на понедельник',
)
eq(
  'Wednesday backpack is tomorrow',
  backpackMustDoLabel('2026-09-02'),
  'Собрать рюкзак на завтра',
)
eq('Friday next school is Monday', nextSchoolDateKey('2026-09-04'), '2026-09-07')
eq(
  'Thu before 1 Sep holiday? wait 2026-09-03 is Thu next is Fri',
  nextSchoolDateKey('2026-09-03'),
  '2026-09-04',
)

// --- perfect day / stars ---
const schoolDone = checkAllRequired('2026-09-02')
ok('all required = perfect', isPerfectDay(schoolDone, EMPTY_SCHOOL_DAY_PLAN))
eq('school perfect stars = 5', dayStars(schoolDone, EMPTY_SCHOOL_DAY_PLAN), 5)

const plusOptional = normalizeDayLog('2026-09-02', {
  ...schoolDone,
  mustDo: { ...schoolDone.mustDo, read: true, create: true },
})
ok(
  'optional checks do not add stars',
  dayStars(plusOptional, EMPTY_SCHOOL_DAY_PLAN) === 5,
)
ok(
  'optional checks still perfect',
  isPerfectDay(plusOptional, EMPTY_SCHOOL_DAY_PLAN),
)

const missingHomework = normalizeDayLog('2026-09-02', {
  ...schoolDone,
  mustDo: { ...schoolDone.mustDo, homework: false },
})
ok(
  'missing homework is not perfect',
  !isPerfectDay(missingHomework, EMPTY_SCHOOL_DAY_PLAN),
)
eq('stars without homework = 4', dayStars(missingHomework, EMPTY_SCHOOL_DAY_PLAN), 4)

const onlyOptional = normalizeDayLog('2026-09-02', {
  mustDo: { read: true, create: true },
})
ok('only optional is not perfect', !isPerfectDay(onlyOptional))
eq('only optional stars = 0', dayStars(onlyOptional), 0)

const restDone = checkAllRequired('2026-09-05')
ok('weekend perfect needs read not homework', isPerfectDay(restDone))
eq('weekend stars = 4', dayStars(restDone), 4)

const stamped = stampPerfectAt(undefined, schoolDone)
ok('stamp sets perfectAt', stamped.perfectAt != null)
const unstamped = stampPerfectAt(stamped, missingHomework)
ok('breaking minimum clears perfectAt', unstamped.perfectAt == null)
const optionalStamp = stampPerfectAt(
  stamped,
  normalizeDayLog('2026-09-02', {
    ...stamped,
    mustDo: { ...stamped.mustDo, read: true },
  }),
)
ok(
  'optional check keeps perfectAt',
  optionalStamp.perfectAt === stamped.perfectAt,
)

// --- electives ---
ok('Sun weekday = 7', dateWeekdayMon1('2026-09-06') === 7)
ok('Mon weekday = 1', dateWeekdayMon1('2026-09-07') === 1)

const electives = normalizeElectives(undefined)
eq(
  'missing electives seed defaults',
  electives.map((e) => e.id),
  DEFAULT_ELECTIVES.map((e) => e.id),
)
eq('empty array stays empty', normalizeElectives([]), [])

eq(
  'Wed has no default electives',
  electivesOnDate(electives, '2026-09-02').map((e) => e.id),
  [],
)
eq(
  'Tue has breakdance',
  electivesOnDate(electives, '2026-09-01').map((e) => e.id),
  ['elective-breakdance'],
)
eq(
  'Thu has breakdance',
  electivesOnDate(electives, '2026-09-03').map((e) => e.id),
  ['elective-breakdance'],
)
eq(
  'Fri has programming',
  electivesOnDate(electives, '2026-09-04').map((e) => e.id),
  ['elective-code'],
)
eq(
  'Sun has guitar',
  electivesOnDate(electives, '2026-09-06').map((e) => e.id),
  ['elective-guitar'],
)

eq(
  'label is 24h',
  electiveLabel(electives[0]),
  'Сходить на брейк-данс в 19:30',
)
eq('normalize 19:30', normalizeElectiveTime('19:30'), '19:30')
eq('reject 24:00', normalizeElectiveTime('24:00'), null)
eq('reject 7:30 pm style', normalizeElectiveTime('7:30 PM'), null)
eq('reject 9:30 unpadded', normalizeElectiveTime('9:30'), null)
ok(
  'drop elective with bad time',
  normalizeElectives([{ id: 'x', title: 'x', time: '25:00', weekdays: [1] }])
    .length === 0,
)
ok(
  'keep elective with empty title while editing',
  normalizeElectives([{ id: 'x', title: '', time: '18:00', weekdays: [1] }])
    .length === 1,
)

const withElectiveDone = normalizeDayLog('2026-09-01', {
  ...checkAllRequired('2026-09-01'),
  electiveDone: { 'elective-breakdance': true },
})
ok(
  'elective check does not change perfect',
  isPerfectDay(withElectiveDone) === isPerfectDay(checkAllRequired('2026-09-01')),
)
eq(
  'elective check does not add stars',
  dayStars(withElectiveDone),
  dayStars(checkAllRequired('2026-09-01')),
)

const mergedElective = mergeDayLog(
  '2026-09-01',
  { electiveDone: { a: true } },
  { electiveDone: { b: true } },
)
ok(
  'electiveDone OR-merge',
  mergedElective.electiveDone.a === true && mergedElective.electiveDone.b === true,
)

const mergedMust = mergeDayLog(
  '2026-09-02',
  { mustDo: { homework: true, read: true } },
  { mustDo: { backpack: true } },
)
ok(
  'mustDo OR-merge keeps both required and optional flags',
  mergedMust.mustDo.homework === true &&
    mergedMust.mustDo.backpack === true &&
    mergedMust.mustDo.read === true,
)

const splitPerfect = mergeDayLog(
  '2026-09-02',
  { mustDo: { 'wash-am': true, exercise: true, chew: true } },
  { mustDo: { homework: true, backpack: true } },
)
ok(
  'split required checks merge into a perfect day',
  isPerfectDay(splitPerfect),
)
ok(
  'split merge does not invent perfectAt',
  splitPerfect.perfectAt == null,
)

const parentStaleDays = {
  '2026-09-12': normalizeDayLog('2026-09-12', {
    mustDo: { 'wash-am': true },
  }),
}
const childFreshDays = {
  '2026-09-12': normalizeDayLog('2026-09-12', {
    mustDo: { exercise: true, homework: true },
  }),
}
const parentPushDays = mergeDaysMaps(childFreshDays, parentStaleDays)
ok(
  'parent stale days keep child exercise and homework',
  parentPushDays['2026-09-12']?.mustDo.exercise === true &&
    parentPushDays['2026-09-12']?.mustDo.homework === true &&
    parentPushDays['2026-09-12']?.mustDo['wash-am'] === true,
)
ok(
  'parent stale chew list keeps child entry',
  mergeChewEntries(
    [],
    [
      {
        id: 'chew-1',
        date: '2026-09-12',
        food: 'яблоко',
        left: [20, 20, 20, 20, 20],
        right: [20, 20, 20, 20, 20],
        createdAt: 4_000,
      },
    ],
  ).some((e) => e.id === 'chew-1'),
)

// --- grades ---
ok('grades start 2 Sep', SCHOOL_GRADES_START === '2026-09-02')
ok('cannot enter grade on 1 Sep', !canEnterSchoolGrade('2026-09-01'))
ok(
  'can enter grade on 2 Sep when today is on/after it',
  todayKey() < SCHOOL_GRADES_START || canEnterSchoolGrade(SCHOOL_GRADES_START),
)
eq('clamp before start', clampSchoolGradeDate('2026-08-20'), SCHOOL_GRADES_START)
eq(
  'short names',
  [
    schoolSubjectShort('Русский язык'),
    schoolSubjectShort('Окружающий мир'),
    schoolSubjectShort('Английский язык'),
  ],
  ['Русский', 'Окружайка', 'Английский'],
)

const grades: SchoolGrade[] = [
  {
    id: 'g1',
    date: '2026-09-02',
    subject: 'Русский язык',
    mark: 5,
    createdAt: 1,
  },
  {
    id: 'g2',
    date: '2026-09-02',
    subject: 'Русский язык',
    mark: 4,
    createdAt: 2,
  },
  {
    id: 'g3',
    date: '2026-09-03',
    subject: 'Русский язык',
    mark: 5,
    createdAt: 3,
  },
  {
    id: 'g4',
    date: '2026-09-03',
    subject: 'Математика',
    mark: 5,
    createdAt: 4,
  },
]
eq('two Russian fives count separately', countFivesInSubject(grades, 'Русский'), 2)
eq('total fives', countFives(grades), 3)
eq('math fives', countFivesInSubject(grades, 'Математика'), 1)
ok(
  'open Q1 does not count as clean yet (today is Sep 2026)',
  countCleanQuarters(grades, '2026-09-02') === 0,
)

const q1End = schoolQuarterEndDate('2026-q1')
eq('Q1 ends Oct 31', q1End, '2026-10-31')
eq('2 Sep is Q1', schoolQuarterKey('2026-09-02'), '2026-q1')
eq('Nov 1 is Q2', schoolQuarterKey('2026-11-01'), '2026-q2')
eq('Jan 10 is previous Q3', schoolQuarterKey('2027-01-10'), '2026-q3')

const q1Clean: SchoolGrade[] = [
  { id: 'a', date: '2026-09-02', subject: 'Русский язык', mark: 5, createdAt: 1 },
  { id: 'b', date: '2026-09-10', subject: 'Математика', mark: 4, createdAt: 2 },
  { id: 'c', date: '2026-10-01', subject: 'Литература', mark: 5, createdAt: 3 },
]
ok(
  'after Q1, 5/4/5 is clean not excellent',
  countCleanQuarters(q1Clean, '2026-11-01') === 1 &&
    countExcellentQuarters(q1Clean, '2026-11-01') === 0,
)
ok(
  'need min grades for quarter',
  q1Clean.length >= SCHOOL_QUARTER_MIN_GRADES,
)
const q1WithThree: SchoolGrade[] = [
  ...q1Clean,
  { id: 'd', date: '2026-10-02', subject: 'Английский язык', mark: 3, createdAt: 4 },
]
ok(
  'a 3 spoils clean quarter',
  countCleanQuarters(q1WithThree, '2026-11-01') === 0,
)
const q1Excellent: SchoolGrade[] = q1Clean.map((g) => ({ ...g, mark: 5 as const }))
ok(
  'all 5s after Q1 is excellent and clean',
  countCleanQuarters(q1Excellent, '2026-11-01') === 1 &&
    countExcellentQuarters(q1Excellent, '2026-11-01') === 1,
)

const mergedGrades = mergeSchoolGrades(
  grades,
  [{ id: 'g5', date: '2026-09-04', subject: 'Литература', mark: 5, createdAt: 5 }],
  ['g2'],
  [],
)
ok('deleted grade stays dead', !mergedGrades.grades.some((g) => g.id === 'g2'))
ok('remote grade kept', mergedGrades.grades.some((g) => g.id === 'g5'))
eq('russian fives after delete of the 4', countFivesInSubject(mergedGrades.grades, 'Русский'), 2)

eq('Sat 12 Sep is week end', weekEndSaturday('2026-09-12'), '2026-09-12')
eq('Mon 7 Sep closes Sat 12', weekEndSaturday('2026-09-07'), '2026-09-12')
eq('Sun 13 Sep still Sat 12 week', weekEndSaturday('2026-09-13'), '2026-09-12')
eq('Mon 14 Sep starts next week', weekEndSaturday('2026-09-14'), '2026-09-19')
eq('week starts Monday', weekStartMonday('2026-09-12'), '2026-09-07')
eq('weekly money 5+4+3+2', weeklyGradeMoney([5, 4, 3, 2]), 150)
eq('two fives are 400', weeklyGradeMoney([5, 5]), 400)

const weekOpen = {
  ...defaultAppData(),
  moneyBankRub: 100,
  weeklyGradeWeeks: [
    {
      weekEnd: '2026-09-12',
      marks: [5, 4] as const,
      updatedAt: 1,
      settledAt: null,
      moneyDelta: null,
    },
  ],
}
const stillSaturday = applyPendingWeeklyGradeSettlements(weekOpen, '2026-09-12')
ok(
  'Saturday does not auto-settle',
  !stillSaturday.weeklyGradeWeeks[0]?.settledAt &&
    stillSaturday.moneyBankRub === 100,
)
const sundayPay = applyPendingWeeklyGradeSettlements(weekOpen, '2026-09-13')
ok(
  'Sunday does not put grades in the piggy',
  !sundayPay.weeklyGradeWeeks[0]?.settledAt &&
    sundayPay.moneyBankRub === 100 &&
    sundayPay.weeklyGradeWeeks[0]?.moneyDelta == null,
)
const clamped = applyPendingWeeklyGradeSettlements(
  {
    ...defaultAppData(),
    moneyBankRub: 30,
    weeklyGradeWeeks: [
      {
        weekEnd: '2026-09-12',
        marks: [2],
        updatedAt: 1,
        settledAt: null,
        moneyDelta: null,
      },
    ],
  },
  '2026-09-13',
)
ok('grades never change the piggy', clamped.moneyBankRub === 30)

const mergedWeeks = mergeWeeklyGradeWeeks(
  [
    {
      weekEnd: '2026-09-12',
      marks: [5],
      updatedAt: 20,
      settledAt: null,
      moneyDelta: null,
    },
  ],
  [
    {
      weekEnd: '2026-09-12',
      marks: [5, 4],
      updatedAt: 10,
      settledAt: 99,
      moneyDelta: 150,
    },
  ],
)
ok(
  'settled week wins over newer unsettled copy',
  Boolean(mergedWeeks[0]?.settledAt) && mergedWeeks[0]?.moneyDelta === 150,
)

ok(
  'streak 60 cinema sticker exists',
  STICKERS.some((s) => s.id === 'hero-todoroki' && s.needStreak === 60),
)
ok(
  'streak 67 pays roblox minutes',
  STICKERS.some((s) => s.id === 'hero-uraraka' && s.robloxExtraMin === 30),
)
ok(
  'streak 150 is another aquapark',
  STICKERS.some(
    (s) =>
      s.id === 'hero-allmight' &&
      s.needStreak === 150 &&
      s.giftHint === 'Награда: поход в аквапарк',
  ),
)

ok(
  'exercise 60 pays roblox minutes',
  STICKERS.some((s) => s.id === 'hero-nobara' && s.robloxExtraMin === 20),
)
ok(
  'chew 75 is a roblox donate',
  STICKERS.some(
    (s) =>
      s.id === 'hero-shinobu' &&
      s.needChewDays === 75 &&
      /донат/i.test(s.giftHint ?? '') &&
      /roblox/i.test(s.giftHint ?? ''),
  ),
)

// --- defaults / debug flags ---
ok('plan start is 1 Sep', NEW_DAY_PLAN_START === '2026-09-01')
ok('sticker debug unlock is off', DEBUG_UNLOCK_ALL_STICKERS === false)
ok('sticker debug lock is off', DEBUG_LOCK_ALL_STICKERS === false)

const seeded = defaultAppData()
eq(
  'default electives present',
  seeded.electives.map((e) => e.id),
  DEFAULT_ELECTIVES.map((e) => e.id),
)
const afterMoney = applyPendingStickerMoneyRewards(seeded)
eq('fresh data does not dump sticker cash', afterMoney.moneyBankRub, 0)
const afterRoblox = applyPendingStickerRobloxRewards(seeded)
eq(
  'fresh data does not dump sticker roblox',
  afterRoblox.robloxBonusBankMin,
  seeded.robloxBonusBankMin,
)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
