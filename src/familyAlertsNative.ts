import { Capacitor, registerPlugin } from '@capacitor/core'

type FamilyAlertsPlugin = {
  start(options: { code: string; role: string; childName: string }): Promise<void>
  stop(): Promise<void>
}

const FamilyAlerts = registerPlugin<FamilyAlertsPlugin>('FamilyAlerts', {
  web: {
    async start() {},
    async stop() {},
  },
})

export async function startFamilyBackgroundAlerts(input: {
  code: string
  role: 'parent' | 'child'
  childName: string
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await FamilyAlerts.start({
    code: input.code,
    role: input.role,
    childName: input.childName.trim() || 'Даня',
  })
}

export async function stopFamilyBackgroundAlerts(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await FamilyAlerts.stop()
}
