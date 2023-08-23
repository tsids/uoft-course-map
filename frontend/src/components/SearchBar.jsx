import '../App.css'
import Select, { components } from 'react-select';
import Highlighter from 'react-highlight-words'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleUp, faAngleDown, faMagnifyingGlass, faSliders } from '@fortawesome/free-solid-svg-icons'

const searches = [
    { code: 'CSC108H5', name: 'Computer Science', sectionCode: ['F'] },
    { code: 'MAT102H5', name: 'Math', sectionCode: ['F', 'S'] },
    { code: 'STA107H5', name: 'Statistics', sectionCode: ['S'] },
    { code: 'ECO101H5', name: 'Statistics', sectionCode: ['W'] },
    { code: 'ECO102H5', name: 'Statistics', sectionCode: ['Y'] },
    { code: 'CSC208H5', name: 'Computer Science', sectionCode: ['F'] },
    { code: 'MAT202H5', name: 'Math', sectionCode: ['F', 'S'] },
    { code: 'STA207H5', name: 'Statistics', sectionCode: ['S'] },
    { code: 'ECO201H5', name: 'Statistics', sectionCode: ['W'] },
    { code: 'ECO202H5', name: 'Statistics', sectionCode: ['Y'] },
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

export default function SearchBar(props) {

    async function connect() {
        const uri = "mongodb://localhost/courses";
        const client = new MongoClient(uri);

        await client.connect();
        const db = client.db('courses');
        const collection = db.collection('searchBar');
        const options = collection.find();

        <Select
            isMulti
            isClearable
            autoFocus
            backspaceRemovesValue
            name="courses"
            getOptionLabel={option => {
                let section = ""
                if (option.sectionCode.includes("Y"))
                    section = "🍁❄️"
                else {
                    if (option.sectionCode.includes("F"))
                        section = "🍁"
                    if (option.sectionCode.includes("F"))
                        section += "❄️"
                }
                return `${option.code}: ${option.name} ${section}`
            }}
            getOptionValue={option => option.code}
            options={options}
            className="basic-multi-select"
            classNamePrefix="select"
        />

        await client.close();
    }

    function updateFilters(currValues, action) {
        let filterValues = [];
        switch (action.name) {
            case 'courses':
                filterValues = currValues.map(value => value.code)
                break;
            case 'type':
                filterValues = currValues.value
                break;
            case 'field': []
                break;
            case 'campus': []
                break;
            case 'year': []
                break;
            case 'section': []
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
            <Select
                isMulti
                isClearable
                autoFocus
                hideSelectedOptions
                backspaceRemovesValue
                className="basic-multi-select w-[700px]"
                classNamePrefix="select"
                name="courses"
                value={searches.filter(course => props.filters.courses.includes(course.code))}
                onChange={updateFilters}
                options={searches}
                getOptionLabel={option => option.name}
                getOptionValue={option => option.code}
                formatOptionLabel={({ name, code, sectionCode }, { inputValue, context }) => {
                    return context === 'value' ? code :
                        (
                            <div style={{ display: "flex" }}>
                                <div>
                                    <Highlighter
                                        searchWords={[inputValue]}
                                        textToHighlight={`${code}: ${name}`}
                                    />
                                </div>
                                <div style={{ marginLeft: "auto" }}>
                                    {(() => {
                                        let section = ""
                                        if (sectionCode.includes('Y')) section += "🍁❄️";
                                        else {
                                            if (sectionCode.includes('F')) section += "🍁";
                                            if (sectionCode.includes('W')) section += "❄️";
                                        }
                                        if (sectionCode.includes('S')) section += "☀️";
                                        return section
                                    })()}
                                </div>
                            </div>
                        )
                }}
                components={{ DropdownIndicator, ValueContainer }}
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
                onChange={updateFilters}
            />
            <button type="submit" className="h-10 rounded-full bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                <FontAwesomeIcon icon={faSliders} className='mr-2' />
                Filters
            </button>
        </section>
    )
}

// Alternate Format Option Label for React select
// formatOptionLabel={({ name, code, sectionCode }, { inputValue, context }) => {
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
//               if (sectionCode.includes('Y')) section += "🍁❄️";
//               else {
//                 if (sectionCode.includes('F')) section += "🍁";
//                 if (sectionCode.includes('W')) section += "❄️";
//               }
//               if (sectionCode.includes('S')) section += "☀️";
//               return section
//             })()}
//           </div>
//         </div>
//       )
//     }
//   }}


function SearchBar2(props) {


    function handleChange(event) {
        const { name, value, type, checked } = event.target
        props.setFilters(prevFilters => {
            return {
                ...prevFilters,
                [name]: type === "checkbox" ? checked : value
            }
        })
    }

    function handleSubmit(event) {
        event.preventDefault()
        console.log(props.filters)
    }

    function handleKeyDown(e) {
        if (e.key !== 'Enter') return
        const value = e.target.value
        if (!value.trim()) return
        props.setFilters(prevFilters => {
            return {
                ...prevFilters,
                courses: [...prevFilters.courses, value]
            }
        })
        e.target.value = ''
    }

    function deleteCourse(index) {
        props.setFilters(oldFilters => {
            return {
                ...oldFilters,
                courses: oldFilters.courses.filter((el, i) => i !== index)
            }
        })
    }

    return (
        <section>
            <form onSubmit={handleSubmit}>
                {console.log(props.filters.courses)}
                <div className="border-solid border-2 p-2 rounded-sm mt-4 flex items-center flex-wrap">
                    {props.filters.courses.map((course, index) => (
                        <div className="tag-item" key={index}>
                            <span className="text">{course}</span>
                            <span className="close" onClick={() => deleteCourse(index)}>&times;</span>
                        </div>
                    ))}
                    {/* <input onKeyDown={handleKeyDown} type="text" className="tags-input" placeholder="Type somthing" /> */}
                    <input
                        type="text"
                        placeholder="Enter course"
                        onKeyDown={handleKeyDown}
                        // onChange={handleChange}
                        name="courses"
                        // value={props.filters.courses}
                        className='tags-input'
                    />
                </div>
            </form>
        </section>
    )
}

function TagsInput(props) {

    function handleKeyDown(e) {
        if (e.key !== 'Enter') return
        const value = e.target.value
        if (!value.trim()) return
        props.setFilters(prevFilters => {
            return {
                ...prevFilters,
                courses: [...prevFilters.courses, value]
            }
        })
        e.target.value = ''
    }

    function deleteCourse(index) {
        props.setFilters(oldFilters => {
            return {
                ...oldFilters,
                courses: oldFilters.courses.filter((el, i) => i !== index)
            }
        })
    }

    return (
        <div className="border-solid border-2 p-2 rounded-sm mt-4 flex items-center flex-wrap">
            {props.filters.courses.map((course, index) => (
                <div className="tag-item" key={index}>
                    <span className="text">{course}</span>
                    <span className="close" onClick={() => deleteCourse(index)}>&times;</span>
                </div>
            ))}
            <input onKeyDown={handleKeyDown} type="text" className="tags-input" placeholder="Type somthing" />
        </div>
    )
}

function InputTag() {
    // Using the State hook to declare our tags variable and setTags to update the variable.
    const [tags, setTags] = React.useState([
        'Tags',
        'Input'
    ]);

    const removeTag = (i) => {
        const newTags = [...tags];
        newTags.splice(i, 1);

        // Call the defined function setTags which will replace tags with the new value.
        setTags(newTags);
    };

    const inputKeyDown = (e) => {
        const val = e.target.value;
        if (e.key === 'Enter' && val) {
            if (tags.find(tag => tag.toLowerCase() === val.toLowerCase())) {
                return;
            }
            setTags([...tags, val]);
            tagInput.value = null;
        } else if (e.key === 'Backspace' && !val) {
            removeTag(tags.length - 1);
        }
    };


    return (
        <div className="input-tag">
            <ul className="input-tag__tags">
                {tags.map((tag, i) => (
                    <li key={tag}>
                        {tag}
                        <button type="button" onClick={() => { removeTag(i); }}>+</button>
                    </li>
                ))}
                <li className="input-tag__tags__input"><input type="text" onKeyDown={inputKeyDown} ref={c => { tagInput = c; }} /></li>
            </ul>
        </div>
    );
}

