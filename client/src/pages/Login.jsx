import { useState } from 'react';
import { api } from '../api.js';
import { Button, ErrorBox, Field, Input } from '../components/ui.jsx';

const DEMO = [
  ['anita@rms.test', 'manager, limit 5,00,000'],
  ['priya@rms.test', 'manager (75,000) + applicant'],
  ['rahul@rms.test', 'manager (50,000) + applicant'],
  ['arjun@rms.test', 'applicant'],
  ['karan@rms.test', 'no role'],
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      onLogin(await api('/auth/login', { method: 'POST', body: { email, password } }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto mt-20 max-w-sm px-4">
      <h1 className="mb-6 text-xl font-semibold">Reimbursement Management System</h1>
      <form onSubmit={submit} className="space-y-4 rounded border border-gray-200 bg-white p-5">
        <ErrorBox error={error} />
        <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <Button type="submit" className="w-full">Log in</Button>
      </form>
      <div className="mt-6 text-sm text-gray-600">
        <p className="mb-1 font-medium">Demo accounts (password: password123)</p>
        <ul>
          {DEMO.map(([e, role]) => (
            <li key={e}>
              <button className="text-blue-700 underline" onClick={() => { setEmail(e); setPassword('password123'); }}>{e}</button>
              <span className="text-gray-500"> — {role}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
