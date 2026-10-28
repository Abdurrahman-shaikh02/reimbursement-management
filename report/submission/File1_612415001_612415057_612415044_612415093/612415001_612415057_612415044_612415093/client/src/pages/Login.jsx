import { useState } from 'react';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import { Button, ErrorBox, Field, Input } from '../components/ui.jsx';

const DEMO = [
  ['anita@rms.test', 'Anita', 'Manager'],
  ['priya@rms.test', 'Priya', 'Manager + applicant'],
  ['rahul@rms.test', 'Rahul', 'Manager + applicant'],
  ['arjun@rms.test', 'Arjun', 'Applicant'],
  ['karan@rms.test', 'Karan', 'Member'],
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      onLogin(await api('/auth/login', { method: 'POST', body: { email, password } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-story">
        <span className="brand">
          <span className="brand-mark">
            <Icon name="receipt" size={24} />
          </span>
          Reimburse<span className="brand-dot">.</span>
        </span>
        <div className="login-story-content">
          <span className="login-kicker">
            <span />
            YOUR EXPENSES, SIMPLIFIED
          </span>
          <h1>
            Less paperwork.
            <br />
            More peace of mind.
          </h1>
          <p>
            A clear path from your first receipt to your final reimbursement. Everything your team needs, in
            one workspace.
          </p>
          <div className="journey-card">
            <div className="journey-header">
              <span>EVERY EXPENSE, A CLEAR JOURNEY</span>
              <Icon name="arrow" size={19} />
            </div>
            {[
              ['receipt', 'Submit with confidence', 'Capture your expenses and receipts.'],
              ['approvals', 'Keep reviews moving', 'Clear decisions, with the details in view.'],
              ['wallet', 'Know where things stand', 'Track every claim through to payment.'],
            ].map(([icon, title, description], index) => (
              <div className="journey-step" key={title}>
                <span className="journey-icon">
                  <Icon name={icon} size={21} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <span className="journey-number">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="login-story-footer">
          <Icon name="shield" size={17} />
          Built for accountable teams.
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <p className="eyebrow">WELCOME TO YOUR WORKSPACE</p>
          <h2>Good to see you.</h2>
          <p className="login-description">Sign in to manage your claims and keep things moving.</p>
          <form onSubmit={submit} className="login-form">
            <ErrorBox error={error} />
            <Field label="Work email">
              <Input
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Signing in...' : 'Sign in to workspace'}
              <Icon name="arrow" size={18} />
            </Button>
          </form>
          <div className="demo-panel">
            <div className="demo-title">
              <span>Explore the demo</span>
              <span className="tag">LOCAL DEMO</span>
            </div>
            <p>Select an account to fill the sign-in details.</p>
            <div className="demo-accounts">
              {DEMO.map(([address, name, role]) => (
                <button
                  key={address}
                  type="button"
                  onClick={() => {
                    setEmail(address);
                    setPassword('password123');
                  }}
                >
                  <span>{name}</span>
                  <small>{role}</small>
                  <Icon name="arrow" size={15} />
                </button>
              ))}
            </div>
            <p className="demo-password">
              Demo password: <code>password123</code>
            </p>
          </div>
          <p className="login-footnote">Reimbursement Management System</p>
        </div>
      </section>
    </div>
  );
}
