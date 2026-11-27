import { departments } from '../constants.js'
import { Icon } from './Icons.jsx'

function ReportsOverview({ employees, activeCount, onLeaveCount }) {
  const inactiveCount = employees.length - activeCount - onLeaveCount
  const summaries = departments.map((department, index) => {
    const count = employees.filter((employee) => employee.department === department).length
    return {
      department,
      count,
      index,
      percentage: employees.length ? Math.round((count / employees.length) * 100) : 0,
    }
  })
  const statusSummary = [
    { label: 'Active', count: activeCount, note: 'In their flow', icon: 'check', tone: 'active' },
    { label: 'On leave', count: onLeaveCount, note: 'Taking a break', icon: 'calendar', tone: 'leave' },
    { label: 'Inactive', count: inactiveCount, note: 'Past teammates', icon: 'users', tone: 'inactive' },
  ]

  return (
    <section className="insights-page" aria-label="People reports">
      <div className="insights-hero">
        <div className="insights-hero-copy">
          <span className="insights-overline"><Icon name="spark" size={15} /> PEOPLE INSIGHTS</span>
          <h2>Your team, at a glance.</h2>
          <p>See how your people are growing, across every corner of your company.</p>
        </div>
        <div className="insights-total">
          <span className="insights-total-label">YOUR TEAM</span>
          <strong>{employees.length}</strong>
          <span className="insights-total-caption">people making it happen</span>
          <span className="insights-orb orb-one" />
          <span className="insights-orb orb-two" />
          <span className="insights-orb orb-three" />
        </div>
      </div>

      <div className="insights-status-grid">
        {statusSummary.map((status) => (
          <article className={`insights-status-card tone-${status.tone}`} key={status.label}>
            <span className="insights-status-icon"><Icon name={status.icon} size={19} /></span>
            <span className="insights-status-copy">
              <span>{status.label}</span>
              <small>{status.note}</small>
            </span>
            <strong>{status.count}</strong>
          </article>
        ))}
      </div>

      <div className="insights-content-grid">
        <section className="department-report">
          <div className="insights-section-heading">
            <div>
              <span className="insights-section-kicker">TEAM MAKEUP</span>
              <h3>People by department</h3>
            </div>
            <span className="report-pill">LIVE OVERVIEW</span>
          </div>
          <p className="department-report-subtitle">A colorful snapshot of where your team belongs.</p>
          <div className="department-report-list">
            {summaries.map(({ department, count, index, percentage }) => (
              <div className="department-report-row" key={department}>
                <span className={`report-dot dot-${index}`} />
                <span className="department-report-name">{department}<small>{count} {count === 1 ? 'person' : 'people'}</small></span>
                <span className="department-report-track">
                  <span className={`report-fill fill-${index}`} style={{ width: `${percentage}%` }} />
                </span>
                <strong>{percentage}%</strong>
              </div>
            ))}
          </div>
          <div className="department-report-footer"><span>Each color is a different team.</span><span>{employees.length} total people</span></div>
        </section>

        <aside className="insights-note">
          <span className="insights-note-icon"><Icon name="spark" size={21} /></span>
          <span className="insights-section-kicker">THE PEOPLE PICTURE</span>
          <h3>Good things grow when people do.</h3>
          <p>{activeCount} teammates are active, while {onLeaveCount} {onLeaveCount === 1 ? 'person is' : 'people are'} taking a well-deserved break.</p>
          <div className="status-composition" aria-label={`${activeCount} active, ${onLeaveCount} on leave, ${inactiveCount} inactive`}>
            <span className="composition-active" style={{ width: `${employees.length ? (activeCount / employees.length) * 100 : 0}%` }} />
            <span className="composition-leave" style={{ width: `${employees.length ? (onLeaveCount / employees.length) * 100 : 0}%` }} />
            <span className="composition-inactive" style={{ width: `${employees.length ? (inactiveCount / employees.length) * 100 : 0}%` }} />
          </div>
          <div className="composition-legend">
            {statusSummary.map((status) => (
              <span key={status.label}><i className={`legend-${status.tone}`} />{status.label}<strong>{status.count}</strong></span>
            ))}
          </div>
        </aside>
      </div>
    </section>
  )
}

export default ReportsOverview
