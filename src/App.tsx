import { useState } from 'react'
import { BottomNav } from './BottomNav'
import { CalendarScreen } from './CalendarScreen'
import { ChewDiaryScreen } from './ChewDiaryScreen'
import { ExercisesScreen } from './ExercisesScreen'
import { TodayScreen } from './TodayScreen'
import type { TabId } from './types'
import { useAppData } from './useAppData'
import './App.css'

function App() {
  const [data, setData] = useAppData()
  const [tab, setTab] = useState<TabId>('today')

  return (
    <div className="app-shell">
      <main className="app-main">
        {tab === 'today' ? (
          <TodayScreen
            data={data}
            onChange={setData}
            onOpenExercises={() => setTab('exercises')}
            onOpenChew={() => setTab('chew')}
          />
        ) : null}
        {tab === 'calendar' ? (
          <CalendarScreen
            data={data}
            onOpenToday={() => setTab('today')}
            onOpenChew={() => setTab('chew')}
          />
        ) : null}
        {tab === 'exercises' ? (
          <ExercisesScreen data={data} onChange={setData} />
        ) : null}
        {tab === 'chew' ? (
          <ChewDiaryScreen data={data} onChange={setData} />
        ) : null}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

export default App
