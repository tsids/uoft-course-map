import Select, { components } from 'react-select';
import Highlighter from 'react-highlight-words'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleUp, faAngleDown, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'

const searches = [
  { code: 'ocean', name: 'Ocean', sectionCode: '#00B8D9', isFixed: true },
  { code: 'blue', name: 'Blue', sectionCode: '#0052CC', isDisabled: true },
  { code: 'purple', name: 'Purple', sectionCode: '#5243AA' },
  { code: 'red', name: 'Red', sectionCode: '#FF5630', isFixed: true },
  { code: 'orange', name: 'Orange', sectionCode: '#FF8B00' },
  { code: 'yellow', name: 'Yellow', sectionCode: '#FFC400' },
  { code: 'green', name: 'Green', sectionCode: '#36B37E' },
  { code: 'forest', name: 'Forest', sectionCode: '#00875A' },
  { code: 'slate', name: 'Slate', sectionCode: '#253858' },
  { code: 'silver', name: 'Silver', sectionCode: '#666666' },
];

// const searches = [
//   { code: 'CSC108H5', name: 'Computer Science', sectionCode: ['F'] },
//   { code: 'MAT102H5', name: 'Math', sectionCode: ['F', 'S'] },
//   { code: 'STA107H5', name: 'Statistics', sectionCode: ['S'] },
//   { code: 'ECO101H5', name: 'Statistics', sectionCode: ['W'] },
//   { code: 'ECO102H5', name: 'Statistics', sectionCode: ['Y'] },
//   { code: 'CSC208H5', name: 'Computer Science', sectionCode: ['F'] },
//   { code: 'MAT202H5', name: 'Math', sectionCode: ['F', 'S'] },
//   { code: 'STA207H5', name: 'Statistics', sectionCode: ['S'] },
//   { code: 'ECO201H5', name: 'Statistics', sectionCode: ['W'] },
//   { code: 'ECO202H5', name: 'Statistics', sectionCode: ['Y'] },
// ]

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

export default function Sidebar(props) {
  // const [colors, setColors] = useState(colorOptions.filter(color => props.filters.includes(color.code)))
  // console.log("initial", colors);



  // Function triggered on selection
  function updateFilters(currValues, action) {
    // console.log("enter handleselect", action.name, currValues);
    props.setFilters(prevFilters => ({
      ...prevFilters,
      [action.name]: currValues.map(color => color.code)
    }))
    // setColors(data);
    console.log(props.filters.colors);
  }

  return (
    <section className='max-w-2xl mx-auto my-0 p-8'>
      <Select
        isMulti
        isClearable
        hideSelectedOptions
        backspaceRemovesValue
        openMenuOnFocus
        name="colors"
        // defaultValue={colorOptions.filter(color => ['ocean', 'blue'].includes(color.code))}
        value={searches.filter(color => props.filters.colors.includes(color.code))}
        onChange={updateFilters}
        options={searches}
        className="basic-multi-select"
        classNamePrefix="select"
        getOptionLabel={option => option.name}
        getOptionValue={option => option.code}
        formatOptionLabel={({ name, code, sectionCode }, { inputValue, context }) => {
          if (context === 'value') return code
          else {
            const label = `${code}: ${name}`
            const regex = new RegExp(`(${inputValue})`, "gi")
            const parts = inputValue ? label.split(regex) : ""

            return (
              <div style={{ display: "flex" }}>
                <div>
                  {
                    parts ? parts.map((part, index) =>
                      regex.test(part) ? <mark key={index}>{part}</mark> : part
                    )
                      : label
                  }
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
          }
        }}
        components={{ DropdownIndicator, ValueContainer }}
        styles={{ valueContainer: base => ({ ...base, paddingLeft: '2rem' }) }} // moves text to the right, so it doesn't interfere with search icon
        placeholder="Search Courses..."
        noOptionsMessage={() => "No Courses Found"}
      />
    </section>
  )
}