import '../index.css'
import Select, { components, createFilter } from 'react-select';
import AsyncSelect from 'react-select/async'
import Highlighter from 'react-highlight-words'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleUp, faAngleDown, faMagnifyingGlass, faSliders } from '@fortawesome/free-solid-svg-icons'
import { useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import axios from 'axios'

const searches = [
    { code: 'CSC108H5', name: 'Computer Science', semesters: ['F'] },
    { code: 'MAT102H5', name: 'Math', semesters: ['F', 'S'] },
    { code: 'STA107H5', name: 'Statistics', semesters: ['S'] },
    { code: 'ECO101H5', name: 'Statistics', semesters: ['W'] },
    { code: 'ECO102H5', name: 'Statistics', semesters: ['Y'] },
    { code: 'CSC208H5', name: 'Computer Science', semesters: ['F'] },
    { code: 'MAT202H5', name: 'Math', semesters: ['F', 'S'] },
    { code: 'STA207H5', name: 'Statistics', semesters: ['S'] },
    { code: 'ECO201H5', name: 'Statistics', semesters: ['W'] },
    { code: 'ECO202H5', name: 'Statistics', semesters: ['Y'] },
]

const searchTypes = [
    { value: "prerequisites", label: "Prerequisites" },
    { value: "postrequisites", label: "Postrequisites" }
]

// Change caret dropdown
const DropdownIndicator = props => (
    components.DropdownIndicator && (
        <components.DropdownIndicator {...props}>
            <FontAwesomeIcon icon={props.selectProps.menuIsOpen ? faAngleUp : faAngleDown} />
        </components.DropdownIndicator>
    )
)

// Add search icon to left of search bar
const ValueContainer = ({ children, ...props }) => (
    components.ValueContainer && (
        <components.ValueContainer {...props}>
            <FontAwesomeIcon
                icon={faMagnifyingGlass}
                style={{ display: "block", position: "absolute", left: 10 }}
            />
            {children}
        </components.ValueContainer>
    )
)

// load values for courses
const MenuList = props => {
    const height = 40
    const { children, maxHeight } = props

    const childrenLength = children.length ? children.length : 0
    const wrapperHeight = maxHeight < childrenLength * height
        ? maxHeight
        : (childrenLength * height);

    return (
        <List
            className='whitespace-normal'
            height={wrapperHeight}
            itemCount={childrenLength || 0}
            itemSize={height}
            overscanCount={20}
        >
            {({ index, style }) => <div style={style}>{children[index]}</div>}
        </List>
    );
};


export default function SearchBar(props) {

    const [searchBar, setSearchBar] = useState([])

    useEffect(() => {
        axios.get('/api/searches')
            .then(res => setSearchBar(res.data))
            .catch(err => console.log(err))
    }, [])

    const loadOptions = (searchInput, callback) => {
        setTimeout(() => {
            callback(searchBar);
        }, 1000);
    };

    function updateFilters(currValues, action) {
        let filterValues = [];
        switch (action.name) {
            case 'courses':
                filterValues = currValues.map(value => value.code)
                break;
            case 'type':
                filterValues = currValues.value
                break;
            case 'field': currValues.map(value => value.code)
                break;
            case 'campus': currValues.map(value => value.campus)
                break;
            case 'year': currValues.map(value => value.level)
                break;
            case 'semesters': currValues.map(value => value.semesters)
                break;
            case 'breadth': currValues.map(value => value.code)
                break;
            default: break
        }

        props.setFilters(prevFilters => ({
            ...prevFilters,
            [action.name]: filterValues
        }))
    }

    return (
        <section className="container flex gap-3 mx-auto mt-3">
            <div>
                <AsyncSelect
                    isMulti
                    isClearable
                    autoFocus
                    hideSelectedOptions
                    backspaceRemovesValue
                    captureMenuScroll
                    closeMenuOnSelect={false}
                    className="basic-mTypeulti-select w-[700px]"
                    classNamePrefix="select"
                    name="courses"
                    value={searchBar.filter(course => props.filters.courses.includes(course.code))}
                    onChange={updateFilters}
                    cacheOptions
                    defaultOptions={searchBar}
                    loadOptions={loadOptions}
                    filterOption={createFilter({ ignoreAccents: false })}
                    getOptionLabel={option => option.name}
                    getOptionValue={option => option.code}
                    formatOptionLabel={({ name, code, semesters }, { inputValue, context }) => {
                        return context === 'value' ? code :
                            (
                                <div style={{ display: "flex" }}>
                                    <div className='whitespace-nowrap overflow-x-hidden overflow-ellipsis max-w-full'>
                                        <Highlighter
                                            searchWords={[inputValue]}
                                            textToHighlight={`${code}: ${name}`}
                                        />
                                    </div>
                                    <div style={{ marginLeft: "auto" }}>
                                        {(() => {
                                            let section = ""
                                            if (semesters.includes('Y')) section += "🍁❄️";
                                            else {
                                                if (semesters.includes('F')) section += "🍁";
                                                if (semesters.includes('W')) section += "❄️";
                                            }
                                            if (semesters.includes('S')) section += "☀️";
                                            return section
                                        })()}
                                    </div>
                                </div>
                            )
                    }}
                    components={{ DropdownIndicator, ValueContainer, MenuList }}
                    styles={{ valueContainer: base => ({ ...base, paddingLeft: 32 }) }} // moves text to the right, so it doesn't interfere with search icon
                    placeholder="Search Courses..."
                    noOptionsMessage={() => "No Courses Found"}
                />
                <Select
                    className="basic-multi-select w-44"
                    classNamePrefix="select"
                    name="type"
                    components={{ IndicatorSeparator: () => null }}
                    options={searchTypes}
                    value={searchTypes.filter(type => type.value === props.filters.type)}
                    defaultValue={searchTypes[1]}
                    placeholder="Type"
                    onChange={updateFilters}
                />
                <button className="h-10 rounded-full bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" onClick={() => props.updatePreferences("showfilters")}>
                    <FontAwesomeIcon icon={faSliders} />
                    <span className='ml-2 max-lg:hidden'>Filters</span>
                </button>
            </div>
            {props.preferences.showfilters &&
                <div>
                    <Select
                        className="basic-multi-select w-44"
                        classNamePrefix="select"
                        name="field"
                        components={{ IndicatorSeparator: () => null }}
                        options={searchTypes}
                        value={searchTypes.filter(type => type.value === props.filters.type)}
                        defaultValue={searchTypes[1]}
                        placeholder="Field of Study"
                        onChange={updateFilters}
                    />
                    <Select
                        className="basic-multi-select w-44"
                        classNamePrefix="select"
                        name="campus"
                        components={{ IndicatorSeparator: () => null }}
                        options={searchTypes}
                        value={searchTypes.filter(type => type.value === props.filters.type)}
                        defaultValue={searchTypes[1]}
                        placeholder="Campus"
                        onChange={updateFilters}
                    />
                </div>
            }
        </section>
    )
}

// Alternate Format Option Label for React select
// formatOptionLabel={({ name, code, semesters }, { inputValue, context }) => {
//     if (context === 'value') return code
//     else {
//       const label = `${code}: ${name}`
//       const regex = new RegExp(`(${inputValue})`, "gi")
//       const parts = inputValue ? label.split(regex) : ""

//       return (
//         <div style={{ display: "flex" }}>
//           <div>
//             {
//               parts ? parts.map((part, index) =>
//                 regex.test(part) ? <mark key={index}>{part}</mark> : part
//               )
//                 : label
//             }
//           </div>
//           <div style={{ marginLeft: "auto" }}>
//             {(() => {
//               let section = ""
//               if (semesters.includes('Y')) section += "🍁❄️";
//               else {
//                 if (semesters.includes('F')) section += "🍁";
//                 if (semesters.includes('W')) section += "❄️";
//               }
//               if (semesters.includes('S')) section += "☀️";
//               return section
//             })()}
//           </div>
//         </div>
//       )
//     }
//   }}


// function SearchBar2(props) {


//     function handleChange(event) {
//         const { name, value, type, checked } = event.target
//         props.setFilters(prevFilters => {
//             return {
//                 ...prevFilters,
//                 [name]: type === "checkbox" ? checked : value
//             }
//         })
//     }

//     function handleSubmit(event) {
//         event.preventDefault()
//         console.log(props.filters)
//     }

//     function handleKeyDown(e) {
//         if (e.key !== 'Enter') return
//         const value = e.target.value
//         if (!value.trim()) return
//         props.setFilters(prevFilters => {
//             return {
//                 ...prevFilters,
//                 courses: [...prevFilters.courses, value]
//             }
//         })
//         e.target.value = ''
//     }

//     function deleteCourse(index) {
//         props.setFilters(oldFilters => {
//             return {
//                 ...oldFilters,
//                 courses: oldFilters.courses.filter((el, i) => i !== index)
//             }
//         })
//     }

//     return (
//         <section>
//             <form onSubmit={handleSubmit}>
//                 {console.log(props.filters.courses)}
//                 <div className="border-solid border-2 p-2 rounded-sm mt-4 flex items-center flex-wrap">
//                     {props.filters.courses.map((course, index) => (
//                         <div className="tag-item" key={index}>
//                             <span className="text">{course}</span>
//                             <span className="close" onClick={() => deleteCourse(index)}>&times;</span>
//                         </div>
//                     ))}
//                     {/* <input onKeyDown={handleKeyDown} type="text" className="tags-input" placeholder="Type somthing" /> */}
//                     <input
//                         type="text"
//                         placeholder="Enter course"
//                         onKeyDown={handleKeyDown}
//                         // onChange={handleChange}
//                         name="courses"
//                         // value={props.filters.courses}
//                         className='tags-input'
//                     />
//                 </div>
//             </form>
//         </section>
//     )
// }

// function TagsInput(props) {

//     function handleKeyDown(e) {
//         if (e.key !== 'Enter') return
//         const value = e.target.value
//         if (!value.trim()) return
//         props.setFilters(prevFilters => {
//             return {
//                 ...prevFilters,
//                 courses: [...prevFilters.courses, value]
//             }
//         })
//         e.target.value = ''
//     }

//     function deleteCourse(index) {
//         props.setFilters(oldFilters => {
//             return {
//                 ...oldFilters,
//                 courses: oldFilters.courses.filter((el, i) => i !== index)
//             }
//         })
//     }

//     return (
//         <div className="border-solid border-2 p-2 rounded-sm mt-4 flex items-center flex-wrap">
//             {props.filters.courses.map((course, index) => (
//                 <div className="tag-item" key={index}>
//                     <span className="text">{course}</span>
//                     <span className="close" onClick={() => deleteCourse(index)}>&times;</span>
//                 </div>
//             ))}
//             <input onKeyDown={handleKeyDown} type="text" className="tags-input" placeholder="Type somthing" />
//         </div>
//     )
// }

// function InputTag() {
//     // Using the State hook to declare our tags variable and setTags to update the variable.
//     const [tags, setTags] = React.useState([
//         'Tags',
//         'Input'
//     ]);

//     const removeTag = (i) => {
//         const newTags = [...tags];
//         newTags.splice(i, 1);

//         // Call the defined function setTags which will replace tags with the new value.
//         setTags(newTags);
//     };

//     const inputKeyDown = (e) => {
//         const val = e.target.value;
//         if (e.key === 'Enter' && val) {
//             if (tags.find(tag => tag.toLowerCase() === val.toLowerCase())) {
//                 return;
//             }
//             setTags([...tags, val]);
//             tagInput.value = null;
//         } else if (e.key === 'Backspace' && !val) {
//             removeTag(tags.length - 1);
//         }
//     };


//     return (
//         <div className="input-tag">
//             <ul className="input-tag__tags">
//                 {tags.map((tag, i) => (
//                     <li key={tag}>
//                         {tag}
//                         <button type="button" onClick={() => { removeTag(i); }}>+</button>
//                     </li>
//                 ))}
//                 <li className="input-tag__tags__input"><input type="text" onKeyDown={inputKeyDown} ref={c => { tagInput = c; }} /></li>
//             </ul>
//         </div>
//     );
// }

