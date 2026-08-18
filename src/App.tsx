import { useCallback, useEffect, useState } from 'react'
import { BottomNav } from './BottomNav'
import { CalendarScreen } from './CalendarScreen'
import { ChewDiaryScreen } from './ChewDiaryScreen'
import { ExercisesScreen } from './ExercisesScreen'
import { ParentPinDialog } from './ParentPinDialog'
import { ParentSummaryScreen } from './ParentSummaryScreen'
import { ProgressScreen } from './ProgressScreen'
import { RoleSetupScreen } from './RoleSetupScreen'
import { RobloxScreen } from './RobloxScreen'
import { ScreenHeadActions } from './ScreenHeadActions'
import { SettingsScreen } from './SettingsScreen'
import { StickerUnlockOverlay } from './StickerUnlockOverlay'
import { TodayScreen } from './TodayScreen'
import type { TabId, UserRole } from './types'
import { useAppData } from './useAppData'
import { useChildTaskAlerts } from './useChildTaskAlerts'
import { useFamilyBackgroundSync } from './useFamilyBackgroundSync'
import { useNotifications } from './useNotifications'
import { useParentAlerts } from './useParentAlerts'
import { usePushBridge } from './usePushBridge'
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
  const parentAlerts = useParentAlerts(role, data, family.connected)
  const childTaskAlerts = useChildTaskAlerts(role, data, family.connected)
  usePushBridge(role, family.code)
  useFamilyBackgroundSync(
    role,
    family.code,
    parentAlerts.childName,
    role === 'parent' ? parentAlerts.enabled : childTaskAlerts.enabled,
  )
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
        <div hidden={tab !== 'chew'} inert={tab !== 'chew'}>
          <ChewDiaryScreen
            data={data}
            onChange={setData}
            readOnly={isParent}
            active={tab === 'chew'}
          />
        </div>
        {tab === 'settings' ? (
          <SettingsScreen
            role={role}
            data={data}
            onChange={setData}
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
        <div className="app-bottom-bar">
          <BottomNav active={tab} role={role} onChange={setTab} />
        </div>
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
