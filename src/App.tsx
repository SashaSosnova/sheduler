import { useState } from 'react'
import { BottomNav } from './BottomNav'
import { CalendarScreen } from './CalendarScreen'
import { ChewDiaryScreen } from './ChewDiaryScreen'
import { ExercisesScreen } from './ExercisesScreen'
import { ParentSummaryScreen } from './ParentSummaryScreen'
import { RoleSetupScreen } from './RoleSetupScreen'
import { TodayScreen } from './TodayScreen'
import type { TabId } from './types'
import { useAppData } from './useAppData'
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
              family={family}
              firebaseReady={firebaseReady}
              onCreateFamily={createFamilyCloud}
              onJoinFamily={joinFamilyCloud}
              onLeaveFamily={leaveFamilyCloud}
              onOpenExercises={() => setTab('exercises')}
              onOpenChew={() => setTab('chew')}
            />
          ) : (
            <TodayScreen
              data={data}
              onChange={setData}
              onOpenExercises={() => setTab('exercises')}
              onOpenChew={() => setTab('chew')}
              family={family}
              firebaseReady={firebaseReady}
              onCreateFamily={createFamilyCloud}
              onJoinFamily={joinFamilyCloud}
              onLeaveFamily={leaveFamilyCloud}
            />
          )
        ) : null}
        {tab === 'calendar' ? (
          <CalendarScreen
            data={data}
            onOpenToday={() => setTab('today')}
            onOpenChew={() => setTab('chew')}
          />
        ) : null}
        {tab === 'exercises' ? (
          <ExercisesScreen data={data} onChange={setData} readOnly={isParent} />
        ) : null}
        {tab === 'chew' ? (
          <ChewDiaryScreen data={data} onChange={setData} readOnly={isParent} />
        ) : null}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

export default App
