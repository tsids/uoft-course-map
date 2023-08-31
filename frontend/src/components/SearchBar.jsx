import Select, { components, createFilter } from 'react-select';
import Highlighter from 'react-highlight-words'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleUp, faAngleDown, faMagnifyingGlass, faSliders } from '@fortawesome/free-solid-svg-icons'
import { useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import axios from 'axios'
import { searchTypes, campuses, semesters, year, breadth, groupedBreadth } from './options.js'
import '../index.css'

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

    if (childrenLength) {
        return (
            <List
                height={wrapperHeight}
                itemCount={childrenLength || 0}
                itemSize={height}
                overscanCount={20}
            >
                {({ index, style }) => <div style={style}>{children[index]}</div>}
            </List>
        )
    }
    else {
        return (
            <components.NoOptionsMessage {...props} />
        )
    }
}

export default function SearchBar(props) {

    const [courses, setCourses] = useState([])
    const [fields, setFields] = useState([])

    useEffect(() => {
        axios.get(`${import.meta.env.VITE_API_URL}/api/searches`)
            .then(res => setCourses(res.data))
            .catch(err => console.log(err))
        axios.get(`${import.meta.env.VITE_API_URL}/api/fields`)
            .then(res => setFields(Object.values(res.data.reduce((acc, curr) => (acc[curr.department.code] = curr.department, acc), {}))))
            .catch(err => console.log(err))
    }, [])

    function updateFilters(currValues, action) {
        let filterValues = [];
        switch (action.name) {
            case 'courses': filterValues = currValues.map(item => item.code)
                break;
            case 'type': filterValues = currValues.value
                break;
            case 'fields': filterValues = currValues.map(item => item.code)
                break;
            case 'campus': filterValues = currValues.map(item => item.value)
                break;
            case 'year': filterValues = currValues.map(item => item.value)
                break;
            case 'semesters': filterValues = currValues.map(item => item.value)
                break;
            case 'breadth': filterValues = currValues.map(item => item.value)
                break;
            default: break
        }

        props.setFilters(prevFilters => ({
            ...prevFilters,
            [action.name]: filterValues
        }))
    }

    return (
        <section className="container flex flex-col gap-2 mx-auto mt-3">
            <div className='flex gap-3 w-full max-lg:flex-col max-xl:mx-auto max-lg:items-center'>
                <Select
                    className="basic-multi-select w-full max-sm:w-[326px] max-md:max-w-[487px] lg:w-[750px]"
                    classNamePrefix="select"
                    name="courses"
                    isMulti
                    isClearable
                    autoFocus
                    hideSelectedOptions
                    backspaceRemovesValue
                    captureMenuScroll
                    closeMenuOnSelect={false}
                    value={courses.filter(course => props.filters.courses.includes(course.code))}
                    onChange={updateFilters}
                    options={courses}
                    filterOption={createFilter({ ignoreAccents: false })}
                    getOptionLabel={option => option.name}
                    getOptionValue={option => option.code}
                    formatOptionLabel={({ name, code, semesters }, { inputValue, context }) => {
                        return context === 'value' ? code :
                            (
                                <div style={{ display: "flex" }}>
                                    <div className='whitespace-nowrap overflow-x-hidden overflow-ellipsis max-w-[80%]'>
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
                    styles={{ valueContainer: base => ({ ...base, paddingLeft: 32, top: undefined }) }} // moves text to the right, so it doesn't interfere with search icon
                    placeholder="Search Courses..."
                    noOptionsMessage={() => "No Courses Found"}
                />
                <div className='flex gap-3'>
                    <Select
                        className="basic-multi-select w-full max-sm:w-56 max-md:w-96 max-lg:w-[502px] lg:w-44"
                        classNamePrefix="select"
                        name="type"
                        components={{ IndicatorSeparator: () => null }}
                        options={searchTypes}
                        value={searchTypes.filter(type => type.value === props.filters.type)}
                        placeholder="Type"
                        styles={{ menu: base => ({ ...base, top: undefined }) }}
                        onChange={updateFilters}
                    />
                    <button className="flex items-center h-10 rounded-full bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" onClick={() => props.updatePreferences("showfilters")}>
                        <FontAwesomeIcon icon={faSliders} />
                        <span className='ml-2'>Filters</span>
                    </button>
                </div>
            </div>
            {props.preferences.showfilters &&
                <div className='flex gap-3 max-lg:flex-col max-lg:items-center'>
                    <Select /* Field of Study */
                        className="basic-multi-select max-sm:w-[326px] max-md:w-[484px] max-lg:w-[607px] lg:w-80"
                        classNamePrefix="select"
                        name="fields"
                        isMulti
                        isClearable
                        hideSelectedOptions
                        backspaceRemovesValue
                        closeMenuOnSelect={false}
                        components={{ DropdownIndicator }}
                        formatOptionLabel={({ code, name }, { context }) => (context === 'value' ? code : name)}
                        options={fields}
                        getOptionLabel={option => option.name}
                        getOptionValue={option => option.code}
                        value={fields.filter(item => props.filters.fields.includes(item.code))}
                        placeholder="Field of Study"
                        styles={{ menu: base => ({ ...base, top: undefined }) }}
                        onChange={updateFilters}
                    />
                    <Select /* Campuses */
                        className="basic-multi-select max-sm:w-[326px] max-md:w-[484px] max-lg:w-[607px] lg:w-60"
                        classNamePrefix="select"
                        name="campus"
                        isMulti
                        isSearchable={false}
                        isClearable
                        hideSelectedOptions
                        closeMenuOnSelect={false}
                        components={{ DropdownIndicator }}
                        options={campuses}
                        value={campuses.filter(item => props.filters.campus.includes(item.value))}
                        placeholder="Campus"
                        styles={{ menu: base => ({ ...base, top: undefined }) }}
                        onChange={updateFilters}
                    />
                    <Select /* Year */
                        className="basic-multi-select max-sm:w-[326px] max-md:w-[484px] max-lg:w-[607px] lg:w-64"
                        classNamePrefix="select"
                        name="year"
                        isMulti
                        isClearable
                        isSearchable={false}
                        hideSelectedOptions
                        closeMenuOnSelect={false}
                        components={{ DropdownIndicator }}
                        options={year}
                        value={year.filter(item => props.filters.year.includes(item.value))}
                        placeholder="Year"
                        styles={{ menu: base => ({ ...base, top: undefined }) }}
                        onChange={updateFilters}
                    />
                    <Select /* Semesters */
                        className="basic-multi-select max-sm:w-[326px] max-md:w-[484px] max-lg:w-[607px] lg:w-60"
                        classNamePrefix="select"
                        name="semesters"
                        isMulti
                        isClearable
                        isSearchable={false}
                        hideSelectedOptions
                        closeMenuOnSelect={false}
                        components={{ DropdownIndicator }}
                        formatOptionLabel={({ value, label }, { context }) => (context === 'value' ? value : label)}
                        options={semesters}
                        value={semesters.filter(item => props.filters.semesters.includes(item.value))}
                        placeholder="Semesters"
                        styles={{ menu: base => ({ ...base, top: undefined }) }}
                        onChange={updateFilters}
                    />
                    <Select /* Breadth REQ */
                        className="basic-multi-select max-sm:w-[326px] max-md:w-[484px] max-lg:w-[607px] lg:w-80"
                        classNamePrefix="select"
                        name="breadth"
                        isMulti
                        isClearable
                        hideSelectedOptions
                        backspaceRemovesValue
                        closeMenuOnSelect={false}
                        components={{ DropdownIndicator }}
                        options={groupedBreadth}
                        value={breadth.filter(item => props.filters.breadth.includes(item.value))}
                        placeholder="Breadth REQ"
                        styles={{ menu: base => ({ ...base, top: undefined }) }}
                        formatGroupLabel={data => (
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <span>{data.label}</span>
                                <span style={{ backgroundColor: '#EBECF0', borderRadius: '2em', color: '#172B4D', display: 'inline-block', fontSize: 12, fontWeight: 'normal', lineHeight: '1', minWidth: 1, padding: '0.16666666666667em 0.5em', textAlign: 'center', }}
                                >{data.options.length}</span>
                            </div>
                        )}
                        onChange={updateFilters}
                    />
                </div>
            }
        </section>
    )
}