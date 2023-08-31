import { useState, useEffect } from "react"
import axios from 'axios'

export default function Map(props) {

  const [courses, setCourses] = useState([])

  // useEffect(() => {
  //   axios.get(`${import.meta.env.VITE_API_URL}/api/courses`, { params: { filters: props.filters } })
  //     .then(res => setCourses(res.data))
  //     .catch(err => console.log(err))
  // }, [props.filters])

  return (
    <section className="text-white">
      {courses}
    </section>
  )
}