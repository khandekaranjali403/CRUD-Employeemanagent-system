import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../lib/api.js'
import { departments, employeeStatuses } from '../constants.js'
import { Brand, Icon } from './Icons.jsx'
import { formatDate, initials } from './helpers.js'
import EmployeeModal from './EmployeeModal.jsx'
import ReportsOverview from './ReportsOverview.jsx'

function Dashboard({ user, onLogout }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All people')
  const [modalEmployee, setModalEmployee] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [section, setSection] = useState('Dashboard')
  const [profileOpen, setProfileOpen] = useState(false)
  const [toast, setToast] = useState('')

  const loadEmployees = useCallback(async () => {
    try {
      const result = await api('/employees')
      setEmployees(result.employees)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function fetchEmployees() {
      try {
        const result = await api('/employees')
        if (active) {
          setEmployees(result.employees)
          setError('')
        }
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchEmployees()
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const activeCount = employees.filter((employee) => employee.status === 'Active').length
  const onLeaveCount = employees.filter((employee) => employee.status === 'On leave').length
  const visibleEmployees = useMemo(() => employees.filter((employee) => {
    const searchText = `${employee.name} ${employee.email} ${employee.role} ${employee.department}`.toLowerCase()
    const matchesSearch = searchText.includes(search.toLowerCase())
    const matchesStatus = filter === 'All people' || employee.status === filter
    const matchesDepartment = departmentFilter === 'All departments' || employee.department === departmentFilter
    return matchesSearch && matchesStatus && matchesDepartment
  }), [employees, search, filter, departmentFilter])

  function openCreate() {
    setModalEmployee(null)
    setModalError('')
    setModalOpen(true)
  }
  function openEdit(employee) {
    setModalEmployee(employee)
    setModalError('')
    setModalOpen(true)
  }
  async function saveEmployee(form) {
    setSaving(true)
    setModalError('')
    try {
      if (modalEmployee) {
        await api(`/employees/${modalEmployee.id}`, { method: 'PUT', body: JSON.stringify(form) })
        setToast('Employee details updated')
      } else {
        await api('/employees', { method: 'POST', body: JSON.stringify(form) })
        setToast('New employee added to your team')
      }
      setModalOpen(false)
      await loadEmployees()
    } catch (requestError) {
      setModalError(requestError.message)
    } finally {
      setSaving(false)
    }
  }
  async function deleteEmployee(employee) {
    if (!window.confirm(`Remove ${employee.name} from your team? This action cannot be undone.`)) return
    try {
      await api(`/employees/${employee.id}`, { method: 'DELETE' })
      setToast(`${employee.name} has been removed`)
      await loadEmployees()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const title = section === 'Employees' ? 'All employees' : section === 'Departments' ? 'Your departments' : section === 'Reports' ? 'People overview' : 'Good morning'
  return (
    <div className="app-shell" onClick={() => { if (profileOpen) setProfileOpen(false) }}>
      <aside className="sidebar">
        <div className="sidebar-brand"><Brand /></div>
        <div className="workspace-switch"><span className="workspace-icon">S</span><span><strong>Studio North</strong><small>Workspace</small></span><Icon name="down" size={15} /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {[['Dashboard', 'grid'], ['Employees', 'users'], ['Departments', 'calendar'], ['Reports', 'chart']].map(([label, icon]) => <button key={label} className={`nav-item ${section === label ? 'nav-active' : ''}`} onClick={() => { setSection(label); setFilter('All people'); setDepartmentFilter('All departments') }}><Icon name={icon} size={19} /><span>{label}</span>{label === 'Employees' && <span className="nav-count">{employees.length}</span>}</button>)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip"><div className="tip-icon"><Icon name="spark" size={17} /></div><strong>People first, always.</strong><p>A little appreciation goes a long way. Celebrate someone today.</p><button onClick={() => { setSection('Employees'); setToast('A little appreciation goes a long way ✨') }}>Sounds good <Icon name="chevron" size={14} /></button></div>
        <div className="sidebar-user"><span className="user-avatar">{initials(user.name)}</span><span className="user-details"><strong>{user.name}</strong><small>Workspace admin</small></span><button className="icon-button logout-button" onClick={(event) => { event.stopPropagation(); onLogout() }} aria-label="Sign out"><Icon name="logout" size={18} /></button></div>
      </aside>
      <main className="dashboard-main">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={15} /><strong>{section}</strong></div><div className="topbar-actions"><div className="today-date"><Icon name="calendar" size={16} /><span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span></div><div className="profile-wrap"><button className="profile-button" onClick={(event) => { event.stopPropagation(); setProfileOpen(!profileOpen) }}><span className="user-avatar small-avatar">{initials(user.name)}</span><Icon name="down" size={15} /></button>{profileOpen && <div className="profile-menu" onClick={(event) => event.stopPropagation()}><strong>{user.name}</strong><span>{user.email}</span><button onClick={onLogout}><Icon name="logout" size={16} /> Sign out</button></div>}</div></div></header>
        <div className="dashboard-content">
          <div className="welcome-row"><div><div className="date-kicker">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</div><h1>{title}{section === 'Dashboard' && <span className="wave">✦</span>}</h1><p>{section === 'Dashboard' ? 'Here’s what’s happening with your people today.' : section === 'Departments' ? 'A little look at how your team is organized.' : section === 'Reports' ? 'A snapshot of your people and their wellbeing.' : 'The lovely people who make your company what it is.'}</p></div><button className="primary-button add-person-button" onClick={openCreate}><Icon name="plus" size={18} /> Add employee</button></div>
          {error && <div className="dashboard-error" role="alert">{error}<button onClick={loadEmployees}>Try again</button></div>}
          <section className="stats-grid" aria-label="Team summary">
            <article className="stat-card stat-card-primary"><div className="stat-top"><span>Total people</span><span className="stat-icon"><Icon name="users" size={19} /></span></div><div className="stat-number">{employees.length}</div><div className="stat-bottom"><span className="tiny-avatars">{employees.slice(0, 4).map((employee, index) => <span key={employee.id} className={`tiny-avatar tone-${index % 5}`}>{initials(employee.name)}</span>)}</span><span>Growing together</span></div><div className="stat-decoration">✳</div></article>
            <article className="stat-card"><div className="stat-top"><span>Active today</span><span className="stat-icon icon-mint"><Icon name="check" size={19} /></span></div><div className="stat-number">{activeCount}<span className="stat-subtle"> of {employees.length} people</span></div><div className="stat-bottom"><span className="mini-status-dot" /> Everyone’s in their flow</div><div className="stat-meter"><span style={{ width: `${employees.length ? (activeCount / employees.length) * 100 : 0}%` }} /></div></article>
            <article className="stat-card"><div className="stat-top"><span>On leave</span><span className="stat-icon icon-peach"><Icon name="calendar" size={19} /></span></div><div className="stat-number">{onLeaveCount}<span className="stat-subtle"> {onLeaveCount === 1 ? 'teammate' : 'teammates'}</span></div><div className="stat-bottom"><span className="leave-avatars">{employees.filter((employee) => employee.status === 'On leave').slice(0, 3).map((employee, index) => <span key={employee.id} className={`tiny-avatar tone-${(index + 2) % 5}`}>{initials(employee.name)}</span>)}</span><span>Take all the time you need</span></div></article>
            <article className="stat-card stat-card-join"><div className="join-art"><span>✦</span><span>✳</span><span>✦</span></div><div className="join-copy"><strong>Every person<br />makes a difference.</strong><span>Make room for someone new.</span></div><button onClick={openCreate} aria-label="Add a teammate"><Icon name="plus" size={19} /></button></article>
          </section>
          {section === 'Departments' ? (
            <section className="department-grid">
              {departments.map((department, index) => {
                const members = employees.filter((employee) => employee.department === department)
                return <button className="department-card" key={department} onClick={() => { setDepartmentFilter(department); setSection('Employees') }}><span className={`department-icon department-${index}`}><Icon name={['spark', 'chart', 'users', 'heart', 'grid'][index]} size={20} /></span><span><strong>{department}</strong><small>{members.length} {members.length === 1 ? 'person' : 'people'}</small></span><Icon name="chevron" size={17} /></button>
              })}
            </section>
          ) : section === 'Reports' ? (
            <ReportsOverview employees={employees} activeCount={activeCount} onLeaveCount={onLeaveCount} />
          ) : (
            <section className="people-section">
              <div className="people-heading"><div><h2>{section === 'Employees' ? 'Team directory' : 'Your people'} <span className="people-count">{employees.length}</span></h2><p>A little bit about everyone who makes it happen.</p></div><button className="outline-button" onClick={() => { setSearch(''); setFilter('All people'); setDepartmentFilter('All departments') }}><Icon name="filter" size={17} /> Clear filters</button></div>
              <div className="directory-toolbar"><div className="search-box"><Icon name="search" size={18} /><input placeholder="Search people, roles, departments..." aria-label="Search employees" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div><div className="directory-filters"><label className="department-select-label">Status<select aria-label="Filter by employee status" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="All people">All statuses</option>{employeeStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><Icon name="down" size={14} /></label><label className="department-select-label">Department<select aria-label="Filter by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option>All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select><Icon name="down" size={14} /></label></div></div>
              <div className="table-scroll"><table className="employee-table"><thead><tr><th>TEAM MEMBER</th><th>ROLE</th><th>DEPARTMENT</th><th>LOCATION</th><th>START DATE</th><th>STATUS</th><th aria-label="Actions" /></tr></thead><tbody>
                {loading ? <tr><td className="table-message" colSpan="7">Getting your team together…</td></tr> : visibleEmployees.length === 0 ? <tr><td className="table-message" colSpan="7">{employees.length ? 'No people match your search. Try another name or department.' : 'Your team page is ready. Add your first employee to get started.'}</td></tr> : visibleEmployees.map((employee, index) => <tr key={employee.id}><td><div className="person-cell"><span className={`person-avatar tone-${index % 5}`}>{initials(employee.name)}</span><span className="person-copy"><strong>{employee.name}</strong><small>{employee.email}</small></span></div></td><td className="role-cell">{employee.role}</td><td><span className="department-pill">{employee.department}</span></td><td><span className="location-cell"><Icon name="pin" size={14} />{employee.location}</span></td><td className="start-date">{formatDate(employee.startDate)}</td><td><span className={`status-pill status-${employee.status.toLowerCase().replace(' ', '-')}`}><span />{employee.status}</span></td><td className="actions-cell"><div className="employee-actions"><button className="row-action edit-row-action" aria-label={`Edit ${employee.name}`} title="Edit employee" onClick={() => openEdit(employee)}><Icon name="edit" size={15} /><span>Edit</span></button><button className="row-action delete-row-action" aria-label={`Delete ${employee.name}`} title="Delete employee" onClick={() => deleteEmployee(employee)}><Icon name="trash" size={15} /><span>Delete</span></button></div></td></tr>)}
              </tbody></table></div>
              <div className="table-footer"><span>Showing <strong>{visibleEmployees.length}</strong> of <strong>{employees.length}</strong> team members</span><span className="footer-note"><span className="mini-status-dot" /> All caught up</span></div>
            </section>
          )}
          <footer className="dashboard-footer"><span>A good place to do good work.</span><span>Made with care <span className="footer-heart">♥</span> by peopleflow</span></footer>
        </div>
      </main>
      {modalOpen && <EmployeeModal key={modalEmployee?.id || 'new'} employee={modalEmployee} onClose={() => setModalOpen(false)} onSave={saveEmployee} busy={saving} error={modalError} />}
      {toast && <div className="toast"><span className="toast-check"><Icon name="check" size={15} /></span>{toast}</div>}
    </div>
  )
}

export default Dashboard
