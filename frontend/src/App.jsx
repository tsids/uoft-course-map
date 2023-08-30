import './App.css'
import Nav from './components/Nav'
import SearchBar from './components/SearchBar'
import Map from './components/Map'
import Sidebar from './components/Sidebar'
import { useState, useEffect } from 'react'

function App() {
  const [filters, setFilters] = useState(JSON.parse(localStorage.getItem("filters")) || {
    courses: ['CSC108H1', 'MATB41H3', 'STA258H5', 'MAT243H3'],
    type: "",
    fields: [],
    campus: ['UTSC', 'Seneca'],
    year: [1, '5+', 7],
    semesters: ['W', 'G'],
    breadth: [],
  })

  const [preferences, setPreferences] = useState(JSON.parse(localStorage.getItem("preferences")) || {
    darkMode: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? true : false,
    showsearch: false,
    showfilters: false,
    sidebar: true,
  })

  useEffect(() => {
    localStorage.setItem("filters", JSON.stringify(filters))
  }, [filters]);

  useEffect(() => {
    localStorage.setItem("preferences", JSON.stringify(preferences))
  }, [preferences]);

  function updatePreferences(setting) {
    setPreferences(prevPreferences => ({
      ...prevPreferences,
      [setting]: !prevPreferences[setting]
    }))
  }


  // const [colors, setColors] = useState(JSON.parse(localStorage.getItem("colors")) ? JSON.parse(localStorage.getItem("colors")) : {
  //   colors: ['ocean', 'blue', 'pink'],
  //   idk: [],
  //   lol: "",
  // })

  // useEffect(() => {
  //   localStorage.setItem("colors", JSON.stringify(colors))
  // }, [colors]);

  return (
    // <main className='max-w-2xl mx-auto my-0 p-8'>
    <main className={`${preferences.darkMode ? "dark" : "bg-[#d7d8dd]"} h-screen`}>
      <Nav preferences={preferences} updatePreferences={updatePreferences} />
      <SearchBar filters={filters} setFilters={setFilters} preferences={preferences} updatePreferences={updatePreferences} className="z-10" />
      <Map />
      {/* <Sidebar filters={colors} setFilters={setColors} /> */}
    </main>
  )
}

export default App
