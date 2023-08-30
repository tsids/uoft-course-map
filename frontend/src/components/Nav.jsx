import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBug, faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import logo from '../assets/logo_transparent.png'
import '../index.css'

export default function Nav(props) {
    return (
        <nav className="bg-[#f2f3f5] dark:bg-gray-800">
            <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
                <div className="relative flex h-16 items-center justify-between">
                    {/* Logo and Title */}
                    <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
                        <div className="flex flex-shrink-0 items-center gap-2">
                            <img className="h-12 w-auto" src={logo} alt="UofT Postrequisites" />
                            <h1 class="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">UofT Postrequisites</h1>
                        </div>
                    </div>

                    {/* <!-- End of navbar --> */}
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0 gap-4">
                        <button type="button" className="rounded-full p-1">
                            <span className="sr-only">Submit bug fix/feedback</span>
                            <FontAwesomeIcon icon={faBug} size="xl" className={`${props.preferences.darkMode ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-black"}  cursor-pointer transition-all`} />
                        </button>

                        <button type="button">
                            <FontAwesomeIcon className={`${props.preferences.darkMode ? "text-gray-400 hover:text-gray-100" : "text-yellow-500 hover:text-amber-400"}  cursor-pointer transition-all`} icon={props.preferences.darkMode ? faMoon : faSun} size="xl" onClick={() => props.updatePreferences("darkMode")} />
                            <span className='sr-only'>Toggle dark mode</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    )
}