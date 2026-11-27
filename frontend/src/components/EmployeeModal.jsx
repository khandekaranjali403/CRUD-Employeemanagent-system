import { useState } from 'react'
import { departments, emptyEmployee } from '../constants.js'
import { Icon } from './Icons.jsx'

function EmployeeModal({ employee, onClose, onSave, busy, error }) {
  const [form, setForm] = useState(employee || emptyEmployee)
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })) }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="employee-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><span className="modal-kicker">{employee ? 'EMPLOYEE PROFILE' : 'TEAM DIRECTORY'}</span><h2 id="modal-title">{employee ? 'Edit employee' : 'Add a new employee'}</h2><p>{employee ? 'Keep their details up to date.' : 'Add someone wonderful to your team.'}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        <form className="employee-form" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
          <div className="form-grid">
            <div className="field full"><label htmlFor="employee-name">Full name</label><input id="employee-name" autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Taylor Morgan" required /></div>
            <div className="field full"><label htmlFor="employee-email">Work email</label><input id="employee-email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="taylor@company.com" required /></div>
            <div className="field"><label htmlFor="employee-role">Job title</label><input id="employee-role" value={form.role} onChange={(event) => update('role', event.target.value)} placeholder="e.g. Product Designer" required /></div>
            <div className="field"><label htmlFor="employee-dept">Department</label><select id="employee-dept" value={form.department} onChange={(event) => update('department', event.target.value)}>{departments.map((department) => <option key={department}>{department}</option>)}</select></div>
            <div className="field"><label htmlFor="employee-location">Location</label><input id="employee-location" value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="e.g. New York, NY" required /></div>
            <div className="field"><label htmlFor="employee-start">Start date</label><input id="employee-start" type="date" value={form.startDate} onChange={(event) => update('startDate', event.target.value)} required /></div>
            <div className="field"><label htmlFor="employee-status">Status</label><select id="employee-status" value={form.status} onChange={(event) => update('status', event.target.value)}><option>Active</option><option>On leave</option><option>Inactive</option></select></div>
          </div>
          {error && <div className="form-message form-error" role="alert">{error}</div>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button modal-submit" disabled={busy}>{busy ? 'Saving…' : employee ? 'Save changes' : 'Add employee'} <Icon name="check" size={17} /></button></div>
        </form>
      </section>
    </div>
  )
}

export default EmployeeModal
