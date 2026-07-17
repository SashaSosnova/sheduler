import { useState } from 'react'
import { BottomNav } from './BottomNav'
import { CalendarScreen } from './CalendarScreen'
import { ChewDiaryScreen } from './ChewDiaryScreen'
import { ExercisesScreen } from './ExercisesScreen'
import { ParentSummaryScreen } from './ParentSummaryScreen'
import { ProgressScreen } from './ProgressScreen'
import { RoleSetupScreen } from './RoleSetupScreen'
import { SettingsScreen } from './SettingsScreen'
import { StickerUnlockOverlay } from './StickerUnlockOverlay'
import { TodayScreen } from './TodayScreen'
import type { TabId } from './types'
import { useAppData } from './useAppData'
import { useNotifications } from './useNotifications'
import { useUserRole } from './useUserRole'
import './App.css'

function App() {
  const {
    data,
    setData,
    family,
    createFamilyCloud,
    joinFamilyCloud,
    leaveFamilyCloud,
    firebaseReady,
  } = useAppData()
  const { role, setRole } = useUserRole()
  const notifications = useNotifications(role)
  const [tab, setTab] = useState<TabId>('today')
  const isParent = role === 'parent'

  if (!role) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <RoleSetupScreen onChoose={setRole} />
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        {tab === 'today' ? (
          isParent ? (
            <ParentSummaryScreen
              data={data}
              onOpenExercises={() => setTab('exercises')}
              onOpenChew={() => setTab('chew')}
              onOpenSettings={() => setTab('settings')}
            />
          ) : (
            <TodayScreen
              data={data}
              onChange={setData}
              onOpenExercises={() => setTab('exercises')}
              onOpenChew={() => setTab('chew')}
              onOpenSettings={() => setTab('settings')}
            />
          )
        ) : null}
        {tab === 'progress' ? <ProgressScreen data={data} /> : null}
        {tab === 'calendar' ? <CalendarScreen data={data} /> : null}
        {tab === 'exercises' ? (
          <ExercisesScreen data={data} onChange={setData} readOnly={isParent} />
        ) : null}
        {tab === 'chew' ? (
          <ChewDiaryScreen data={data} onChange={setData} readOnly={isParent} />
        ) : null}
        {tab === 'settings' ? (
          <SettingsScreen
            role={role}
            family={family}
            firebaseReady={firebaseReady}
            notificationsEnabled={notifications.enabled}
            notificationsSupported={notifications.supported}
            notificationsBusy={notifications.busy}
            notificationsDenied={notifications.denied}
            onToggleNotifications={(v) => {
              void notifications.setEnabled(v)
            }}
            onCreateFamily={createFamilyCloud}
            onJoinFamily={joinFamilyCloud}
            onLeaveFamily={leaveFamilyCloud}
            onChangeRole={setRole}
          />
        ) : null}
      </main>
      <BottomNav active={tab} role={role} onChange={setTab} />
      <StickerUnlockOverlay data={data} enabled={!isParent} />
    </div>
  )
}

export default App
