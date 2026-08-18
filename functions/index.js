const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const { logger } = require('firebase-functions')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

initializeApp()

const PARENT_CHANNEL = 'parent-activity'
const CHILD_CHANNEL = 'parent-tasks'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function chewById(data) {
  const map = new Map()
  for (const entry of asArray(data?.chewEntries)) {
    if (entry && typeof entry.id === 'string') map.set(entry.id, entry)
  }
  return map
}

function daysMap(data) {
  return data?.days && typeof data.days === 'object' ? data.days : {}
}

function playTime(sec) {
  const safe = Math.max(0, Math.floor(Number(sec) || 0))
  const m = Math.floor(safe / 60)
  if (m <= 0) return `${safe} сек`
  return `${m} мин`
}

function workoutSec(day) {
  const sessions = asArray(day?.workoutSessions)
  if (sessions.length > 0) {
    let total = 0
    for (const s of sessions) {
      const start = Number(s?.startedAt)
      const end = Number(s?.endedAt)
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
      total += end - start
    }
    return Math.max(0, Math.floor(total / 1000))
  }
  const start = Number(day?.workoutStartedAt)
  const end = Number(day?.workoutFinishedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return Math.max(0, Math.floor((end - start) / 1000))
}

function collectParentAlerts(before, after) {
  const childName =
    typeof after?.childDisplayName === 'string' && after.childDisplayName.trim()
      ? after.childDisplayName.trim()
      : 'Даня'
  const alerts = []
  const oldChew = chewById(before)
  for (const entry of asArray(after?.chewEntries)) {
    if (!entry?.id || oldChew.has(entry.id)) continue
    alerts.push({
      eventKey: `chew:${entry.id}`,
      title: `${childName} заполнил дневник жевания`,
      body: typeof entry.food === 'string' && entry.food.trim()
        ? `Еда: ${entry.food.trim()}`
        : 'Запись сохранена',
      channelId: PARENT_CHANNEL,
    })
  }

  const oldDays = daysMap(before)
  const newDays = daysMap(after)
  for (const [date, day] of Object.entries(newDays)) {
    const finished = Number(day?.workoutFinishedAt)
    const prevFinished = Number(oldDays[date]?.workoutFinishedAt)
    if (!Number.isFinite(finished)) continue
    if (Number.isFinite(prevFinished) && prevFinished === finished) continue
    const sec = workoutSec(day)
    alerts.push({
      eventKey: `workout:${date}:${finished}`,
      title: `${childName} сделал зарядку`,
      body: sec != null ? `Зарядка заняла ${playTime(sec)}` : 'Комплекс упражнений отмечен',
      channelId: PARENT_CHANNEL,
    })
  }
  return alerts
}

function collectChildAlerts(before, after) {
  const alerts = []
  const oldDays = daysMap(before)
  const newDays = daysMap(after)

  const oldTaskIds = new Set()
  const oldReminderIds = new Set()
  for (const day of Object.values(oldDays)) {
    for (const task of asArray(day?.extraTasks)) {
      if (task?.fromParent && task.id) oldTaskIds.add(task.id)
    }
    for (const reminder of asArray(day?.reminders)) {
      if (reminder?.fromParent && reminder.id) oldReminderIds.add(reminder.id)
    }
  }

  for (const [date, day] of Object.entries(newDays)) {
    for (const task of asArray(day?.extraTasks)) {
      if (!task?.fromParent || !task.id || oldTaskIds.has(task.id)) continue
      const label =
        typeof task.fromParentAs === 'string' && task.fromParentAs.trim()
          ? task.fromParentAs.trim()
          : 'родителя'
      alerts.push({
        eventKey: `parent-task:${task.id}`,
        title: `Добавлено задание от ${label}: ${task.text || 'задание'}`,
        body: 'Открой «Сегодня», чтобы отметить',
        channelId: CHILD_CHANNEL,
      })
    }
    for (const reminder of asArray(day?.reminders)) {
      if (!reminder?.fromParent || !reminder.id || oldReminderIds.has(reminder.id)) {
        continue
      }
      const label =
        typeof reminder.fromParentAs === 'string' && reminder.fromParentAs.trim()
          ? reminder.fromParentAs.trim()
          : 'родителя'
      const when = reminder.time ? `${date} в ${reminder.time}` : date
      alerts.push({
        eventKey: `parent-reminder:${reminder.id}`,
        title: `Напоминание от ${label}: ${reminder.text || 'напоминание'}`,
        body: when,
        channelId: CHILD_CHANNEL,
      })
    }
  }
  return alerts
}

async function tokensForRole(code, role) {
  const snap = await getFirestore()
    .collection('families')
    .doc(code)
    .collection('devices')
    .where('role', '==', role)
    .get()
  const out = []
  for (const docSnap of snap.docs) {
    const token = docSnap.data()?.token
    if (typeof token === 'string' && token.trim()) {
      out.push({ id: docSnap.id, token: token.trim() })
    }
  }
  return out
}

async function sendAlerts(code, role, alerts) {
  if (alerts.length === 0) return
  const devices = await tokensForRole(code, role)
  if (devices.length === 0) {
    logger.info('no tokens', { code, role, alerts: alerts.length })
    return
  }

  const messaging = getMessaging()
  const stale = []
  for (const alert of alerts) {
    const response = await messaging.sendEachForMulticast({
      tokens: devices.map((d) => d.token),
      notification: {
        title: alert.title,
        body: alert.body,
      },
      data: {
        eventKey: alert.eventKey,
        kind: role === 'parent' ? 'parent-activity' : 'parent-task',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: alert.channelId,
          sound: 'default',
        },
      },
    })
    response.responses.forEach((item, index) => {
      if (item.success) return
      const codeName = item.error?.code || ''
      if (
        codeName.includes('registration-token-not-registered') ||
        codeName.includes('invalid-registration-token')
      ) {
        stale.push(devices[index].id)
      }
    })
  }

  const uniqueStale = [...new Set(stale.filter(Boolean))]
  await Promise.all(
    uniqueStale.map((id) =>
      getFirestore()
        .collection('families')
        .doc(code)
        .collection('devices')
        .doc(id)
        .delete()
        .catch(() => {}),
    ),
  )
}

exports.onFamilyWrite = onDocumentWritten(
  {
    document: 'families/{code}',
    region: 'us-central1',
  },
  async (event) => {
    const after = event.data?.after?.data()
    if (!after) return
    const before = event.data?.before?.data() || {}
    const code = event.params.code
    try {
      await sendAlerts(code, 'parent', collectParentAlerts(before, after))
      await sendAlerts(code, 'child', collectChildAlerts(before, after))
    } catch (err) {
      logger.error('notify failed', err)
    }
  },
)
