import { useEffect, useState } from 'react'
import { BottomNav } from './BottomNav'
import { CalendarScreen } from './CalendarScreen'
import { ChewDiaryScreen } from './ChewDiaryScreen'
import { ExercisesScreen } from './ExercisesScreen'
import { ParentSummaryScreen } from './ParentSummaryScreen'
import { ProgressScreen } from './ProgressScreen'
import {
  TOM_SAWYER_BOOK_TITLE,
  ensureTomSawyerFinishedBook,
  isTomSawyerInFinishedBooks,
  removeReadingBookByTitle,
} from './progress'
import { RoleSetupScreen } from './RoleSetupScreen'
import { SettingsScreen } from './SettingsScreen'
import { StickerUnlockOverlay } from './StickerUnlockOverlay'
import { TodayScreen } from './TodayScreen'
import { useTomSawyerLive } from './tomSawyerSync'
import type { TabId } from './types'
import { useAppData } from './useAppData'
import { useNotifications } from './useNotifications'
import { useParentAlerts } from './useParentAlerts'
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
  const parentAlerts = useParentAlerts(role, data)
  const tomSawyer = useTomSawyerLive()
  const [tab, setTab] = useState<TabId>('today')
  const isParent = role === 'parent'
  const showNav = tab !== 'settings'

  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [tab])

  // Auto-add Tom Sawyer to finished books when the reader marks the book complete
  useEffect(() => {
    if (!tomSawyer.bookComplete) return
    if (isTomSawyerInFinishedBooks(data.finishedBooks ?? [])) return
    setData((prev) => ({
      ...prev,
      finishedBooks: ensureTomSawyerFinishedBook(prev.finishedBooks ?? [], true),
      readingBooks: removeReadingBookByTitle(
        prev.readingBooks ?? [],
        TOM_SAWYER_BOOK_TITLE,
      ),
    }))
  }, [tomSawyer.bookComplete, data.finishedBooks, setData])

  if (!role) {
    return (
      <div className="app-shell">
        <main className="app-main no-nav">
          <RoleSetupScreen onChoose={setRole} />
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <main className={showNav ? 'app-main' : 'app-main no-nav'}>
        {tab === 'today' ? (
          isParent ? (
            <ParentSummaryScreen
              data={data}
              onChange={setData}
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
        {tab === 'progress' ? (
          <ProgressScreen data={data} onChange={setData} />
        ) : null}
        {tab === 'calendar' ? (
          <CalendarScreen
            data={data}
            canEditMustDo={isParent}
            onChange={setData}
          />
        ) : null}
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
            parentAlertsEnabled={parentAlerts.enabled}
            parentAlertsBusy={parentAlerts.busy}
            parentAlertsDenied={parentAlerts.denied}
            parentAlertsSupported={parentAlerts.supported}
            childName={parentAlerts.childName}
            onToggleParentAlerts={(v) => {
              void parentAlerts.setEnabled(v)
            }}
            onChangeChildName={parentAlerts.setChildName}
            onCreateFamily={createFamilyCloud}
            onJoinFamily={joinFamilyCloud}
            onLeaveFamily={leaveFamilyCloud}
            onChangeRole={setRole}
            onGoHome={() => setTab('today')}
          />
        ) : null}
      </main>
      {showNav ? (
        <BottomNav active={tab} role={role} onChange={setTab} />
      ) : null}
      <StickerUnlockOverlay data={data} enabled={!isParent} />
    </div>
  )
}

export default App
