import './App.css'
import Nav from './components/Nav'
import SearchBar from './components/SearchBar'
import Map from './components/Map'
import Sidebar from './components/Sidebar'
import { useState, useEffect } from 'react'

function App() {
  const [filters, setFilters] = useState(JSON.parse(localStorage.getItem("filters")) || {
    courses: ['CSC108H5', 'MAT202H5', 'MAT347H5'],
    type: "postrequisites",
    field: [],
    campus: [],
    year: [],
    section: [],
  })

  useEffect(() => {
    localStorage.setItem("filters", JSON.stringify(filters))
  }, [filters]);

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
    <main>
      <Nav />
      <SearchBar filters={filters} setFilters={setFilters} />
      <Map />
      {/* <Sidebar filters={colors} setFilters={setColors} /> */}
    </main>
  )
}

export default App
