import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import BookSelection from './pages/BookSelection'
import TypingPractice from './pages/TypingPractice'
import ReviewPage from './pages/ReviewPage'
import StatsPage from './pages/StatsPage'
import Settings from './pages/Settings'
import KeyVocabulary from './pages/KeyVocabulary'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<BookSelection />} />
        <Route path="learn/:bookId/:chapterId?" element={<TypingPractice />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="key-vocabulary" element={<KeyVocabulary />} />
      </Route>
    </Routes>
  )
}

export default App
