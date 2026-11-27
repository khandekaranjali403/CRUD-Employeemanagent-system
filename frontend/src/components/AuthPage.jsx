import { useState } from 'react'
import api from '../lib/api.js'
import { Brand, Icon } from './Icons.jsx'

function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetToken, setResetToken] = useState('')

  function changeMode(next) {
    setMode(next)
    setError('')
    setNotice('')
    setResetToken('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'forgot') {
        const result = await api('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: form.email }),
        })
        setNotice(result.message)
        setResetToken(result.resetToken || '')
      } else {
        const result = await api(`/auth/${mode === 'signin' ? 'login' : 'signup'}`, {
          method: 'POST',
          body: JSON.stringify(form),
        })
        onLogin(result.user)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const result = await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          token: form.token,
          password: form.newPassword,
        }),
      })
      setNotice(result.message)
      setForm((current) => ({ ...current, token: '', newPassword: '' }))
      setResetToken('')
      setMode('signin')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const isReset = mode === 'reset'
  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : isReset ? 'Choose a new password' : 'Welcome back'
  const subtitle = mode === 'signup' ? 'Start building a happier, more organized workplace.' : mode === 'forgot' ? 'Enter your work email and we’ll send you a reset link.' : isReset ? 'Enter the reset code and set a new password.' : 'Sign in to pick up where you left off.'

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <div className="showcase-top"><Brand light /><span className="showcase-label">PEOPLE OPERATIONS, SIMPLIFIED</span></div>
        <div className="showcase-content">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR TEAM, IN GOOD COMPANY</div>
          <h1>Make work<br />feel a little more <em>human.</em></h1>
          <p>One thoughtful space to support your people, celebrate their wins, and help your team do its best work.</p>
          <div className="showcase-visual" aria-hidden="true">
            <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
            <div className="visual-card visual-card-main">
              <div className="visual-card-top"><span className="mini-avatar avatar-lilac">JM</span><span className="mini-avatar avatar-peach">AL</span><span className="mini-avatar avatar-mint">SK</span><span className="avatar-count">+8</span><span className="online-indicator">● &nbsp;Your team is thriving</span></div>
              <div className="visual-line visual-line-long" /><div className="visual-line visual-line-short" />
              <div className="visual-progress"><span /></div>
              <div className="visual-caption">Team happiness <strong>92%</strong></div>
            </div>
            <div className="visual-note"><span className="note-icon"><Icon name="spark" size={18} /></span><span><strong>Good things grow here</strong><small>Little wins, every day</small></span></div>
            <div className="visual-sparkle sparkle-a">✳</div><div className="visual-sparkle sparkle-b">✳</div>
          </div>
        </div>
        <div className="showcase-footer"><span>Made for people, by people.</span><span>© 2026 peopleflow</span></div>
      </section>
      <section className="auth-panel">
        <div className="mobile-brand"><Brand /></div>
        <div className="auth-card">
          <div className="auth-heading">
            <div className="auth-icon"><Icon name={mode === 'forgot' || isReset ? 'lock' : 'spark'} size={21} /></div>
            <h2>{title}</h2><p>{subtitle}</p>
          </div>
          {import.meta.env.DEV && mode === 'signin' && <div className="demo-hint"><span className="demo-dot" /><span><strong>Just looking around?</strong> Try the demo account.</span><button type="button" onClick={() => setForm({ name: '', email: 'demo@peopleflow.com', password: 'Demo123!' })}>Fill it in <Icon name="chevron" size={14} /></button></div>}
          {mode === 'forgot' ? (
            <form className="auth-form" onSubmit={submit}>
              <label htmlFor="auth-email">Work email</label>
              <div className="input-wrap"><Icon name="mail" size={18} /><input id="auth-email" type="email" placeholder="you@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
              {error && <div className="form-message form-error" role="alert">{error}</div>}
              {notice && <div className="form-message form-success" role="status">{notice}{resetToken && <><br /><span>Your local reset code: <strong>{resetToken}</strong></span></>}</div>}
              {resetToken && <button type="button" className="text-button centered" onClick={() => { setForm((current) => ({ ...current, token: resetToken })); setMode('reset'); setNotice('') }}>Continue to password reset</button>}
              <button className="primary-button" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'} <Icon name="chevron" size={17} /></button>
              <button type="button" className="text-button centered" onClick={() => changeMode('signin')}>Back to sign in</button>
            </form>
          ) : isReset ? (
            <form className="auth-form" onSubmit={resetPassword}>
              <label htmlFor="reset-email">Work email</label><div className="input-wrap"><Icon name="mail" size={18} /><input id="reset-email" type="email" placeholder="you@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
              <label htmlFor="reset-token">Reset code</label><div className="input-wrap"><Icon name="lock" size={18} /><input id="reset-token" value={form.token || ''} onChange={(event) => setForm({ ...form, token: event.target.value })} required /></div>
              <label htmlFor="new-password">New password</label><div className="input-wrap"><Icon name="lock" size={18} /><input id="new-password" type="password" minLength="8" value={form.newPassword || ''} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required /></div>
              {error && <div className="form-message form-error" role="alert">{error}</div>}
              {notice && <div className="form-message form-success" role="status">{notice}</div>}
              <button className="primary-button" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <Icon name="chevron" size={17} /></button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              {mode === 'signup' && <><label htmlFor="auth-name">Your name</label><div className="input-wrap"><Icon name="users" size={18} /><input id="auth-name" autoComplete="name" placeholder="Alex Morgan" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div></>}
              <label htmlFor="auth-email">{mode === 'signin' ? 'Email address' : 'Work email'}</label><div className="input-wrap"><Icon name="mail" size={18} /><input id="auth-email" autoComplete="email" type="email" placeholder="you@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
              <div className="label-row"><label htmlFor="auth-password">Password</label>{mode === 'signin' && <button className="text-button" type="button" onClick={() => changeMode('forgot')}>Forgot password?</button>}</div>
              <div className="input-wrap"><Icon name="lock" size={18} /><input id="auth-password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} type="password" minLength={mode === 'signup' ? 8 : undefined} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></div>
              {error && <div className="form-message form-error" role="alert">{error}</div>}
              {notice && <div className="form-message form-success" role="status">{notice}</div>}
              <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in to your workspace' : 'Create my account'} <Icon name="chevron" size={17} /></button>
              <div className="auth-switch">{mode === 'signin' ? 'New to peopleflow?' : 'Already have an account?'} <button className="text-button" type="button" onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></div>
            </form>
          )}
          <div className="auth-legal">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</div>
        </div>
        <div className="auth-bottom"><span>© 2026 peopleflow</span><span><span className="secure-dot" /> Your data is always secure</span></div>
      </section>
    </main>
  )
}

export default AuthPage
