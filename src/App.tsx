import { useCallback, useEffect, useState } from 'react'
import { BottomNav } from './BottomNav'
import { CalendarScreen } from './CalendarScreen'
import { ChewDiaryScreen } from './ChewDiaryScreen'
import { ExercisesScreen } from './ExercisesScreen'
import { ParentPinDialog } from './ParentPinDialog'
import { ParentSummaryScreen } from './ParentSummaryScreen'
import { ProgressScreen } from './ProgressScreen'
import {
  TOM_SAWYER_BOOK_TITLE,
  ensureTomSawyerFinishedBook,
  isTomSawyerInFinishedBooks,
  removeReadingBookByTitle,
} from './progress'
import { RoleSetupScreen } from './RoleSetupScreen'
import { RobloxScreen } from './RobloxScreen'
import { ScreenHeadActions } from './ScreenHeadActions'
import { SettingsScreen } from './SettingsScreen'
import { StickerUnlockOverlay } from './StickerUnlockOverlay'
import { TodayScreen } from './TodayScreen'
import { useTomSawyerLive } from './tomSawyerSync'
import type { TabId, UserRole } from './types'
import { useAppData } from './useAppData'
import { useChildTaskAlerts } from './useChildTaskAlerts'
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
  const childTaskAlerts = useChildTaskAlerts(role, data)
  const tomSawyer = useTomSawyerLive()
  const [tab, setTab] = useState<TabId>(() =>
    role === 'parent' ? 'calendar' : 'today',
  )
  const [parentPinOpen, setParentPinOpen] = useState(false)
  const isParent = role === 'parent'
  const showNav = tab !== 'settings'
  const homeTab: TabId = isParent ? 'calendar' : 'today'

  const changeRole = useCallback(
    (next: UserRole) => {
      if (next === 'parent' && role !== 'parent') {
        setParentPinOpen(true)
        return
      }
      setRole(next)
      setTab(next === 'parent' ? 'calendar' : 'today')
    },
    [role, setRole],
  )

  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [tab])

  // Role-based tabs: child has no calendar; parent has no roblox tab
  useEffect(() => {
    if (!role) return
    if (role === 'child' && tab === 'calendar') setTab('today')
    if (role === 'parent' && (tab === 'roblox' || tab === 'progress')) {
      setTab('calendar')
    }
  }, [role, tab])

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
      <main
        className={[
          showNav ? 'app-main' : 'app-main no-nav',
          showNav ? 'has-head-actions' : '',
          showNav && isParent ? 'head-actions-parent' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {showNav ? (
          <div className="app-head-actions">
            <ScreenHeadActions onOpenSettings={() => setTab('settings')} />
          </div>
        ) : null}
        {tab === 'today' ? (
          isParent ? (
            <ParentSummaryScreen data={data} onChange={setData} />
          ) : (
            <TodayScreen
              data={data}
              onChange={setData}
              onOpenExercises={() => setTab('exercises')}
              onOpenChew={() => setTab('chew')}
            />
          )
        ) : null}
        {tab === 'progress' ? (
          <ProgressScreen data={data} onChange={setData} />
        ) : null}
        {tab === 'roblox' ? (
          <RobloxScreen data={data} onChange={setData} />
        ) : null}
        {tab === 'calendar' ? (
          <CalendarScreen
            data={data}
            canEditMustDo={isParent}
            onChange={setData}
          />
        ) : null}
        {tab === 'exercises' ? (
          <ExercisesScreen
            data={data}
            onChange={setData}
            readOnly={isParent}
          />
        ) : null}
        {tab === 'chew' ? (
          <ChewDiaryScreen
            data={data}
            onChange={setData}
            readOnly={isParent}
          />
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
            parentLabel={parentAlerts.parentLabel}
            onToggleParentAlerts={(v) => {
              void parentAlerts.setEnabled(v)
            }}
            onChangeChildName={parentAlerts.setChildName}
            onChangeParentLabel={parentAlerts.setParentLabel}
            childTaskAlertsEnabled={childTaskAlerts.enabled}
            childTaskAlertsBusy={childTaskAlerts.busy}
            childTaskAlertsDenied={childTaskAlerts.denied}
            childTaskAlertsSupported={childTaskAlerts.supported}
            onToggleChildTaskAlerts={(v) => {
              void childTaskAlerts.setEnabled(v)
            }}
            onCreateFamily={createFamilyCloud}
            onJoinFamily={joinFamilyCloud}
            onLeaveFamily={leaveFamilyCloud}
            onChangeRole={changeRole}
            onGoHome={() => setTab(homeTab)}
          />
        ) : null}
      </main>
      {showNav ? (
        <BottomNav active={tab} role={role} onChange={setTab} />
      ) : null}
      <StickerUnlockOverlay data={data} enabled={!isParent} />
      <ParentPinDialog
        open={parentPinOpen}
        onSuccess={() => {
          setParentPinOpen(false)
          setRole('parent')
          setTab('calendar')
        }}
        onCancel={() => setParentPinOpen(false)}
      />
    </div>
  )
}

export default App
