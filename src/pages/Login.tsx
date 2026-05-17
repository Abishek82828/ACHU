import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight, User, Phone, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SUGGESTION_OPTIONS = [
  'Hair Care', 'Skin Care', 'Body Care', 'Oral Care',
  'Anti-aging', 'Acne Treatment', 'Dry Skin', 'Oily Skin',
  'Hair Fall', 'Dandruff', 'Organic Products', 'Budget Friendly'
];

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState(false);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const rawRedirect = new URLSearchParams(location.search).get('redirect') || '/';
  const from = rawRedirect.startsWith('/') ? rawRedirect : `/${rawRedirect}`;

  const togglePreference = (pref: string) => {
    setPreferences(prev => prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isRegister) {
      if (!name) { setError('Name is required'); return; }
      const ok = await register({ name, email, password, gender, phone, preferences: preferences.join(',') });
      if (ok) navigate(from); else setError('Registration failed. Email may already exist.');
    } else {
      const ok = await login(email, password);
      if (ok) navigate(from); else setError('Invalid credentials.');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif font-bold text-earth-900 mb-2">
            {isRegister ? 'Create Account' : 'Sign In'}
          </h1>
          <p className="text-earth-400 text-sm">
            {isRegister ? 'Join Verdant for personalized organic care' : 'Welcome back to Verdant'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegister && (
            <>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-earth-500 font-semibold mb-2 block">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
                  <input value={name} onChange={e => setName(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 border border-earth-200 bg-white text-sm focus:outline-none focus:border-earth-400 transition-colors" placeholder="Your name" required />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-earth-500 font-semibold mb-2 block">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
                  <input value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 border border-earth-200 bg-white text-sm focus:outline-none focus:border-earth-400 transition-colors" placeholder="+91 98765 43210" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-earth-500 font-semibold mb-2 block">Gender</label>
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: 'Male', val: false }, { label: 'Female', val: true }].map(g => (
                    <label key={g.label} className={`flex items-center justify-center h-12 border cursor-pointer text-sm font-medium transition-colors ${
                      gender === g.val ? 'border-earth-900 bg-earth-900 text-white' : 'border-earth-200 text-earth-600 hover:border-earth-400'
                    }`}>
                      <input type="radio" name="gender" checked={gender === g.val} onChange={() => setGender(g.val)} className="sr-only" />
                      {g.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-earth-500 font-semibold mb-2 block flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> What are you looking for?
                </label>
                <p className="text-xs text-earth-400 mb-3">Select your interests so we can recommend the best products for you</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTION_OPTIONS.map(opt => (
                    <button key={opt} type="button" onClick={() => togglePreference(opt)}
                      className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                        preferences.includes(opt)
                          ? 'bg-earth-900 text-white border-earth-900'
                          : 'bg-white text-earth-600 border-earth-200 hover:border-earth-400'
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-[11px] uppercase tracking-wider text-earth-500 font-semibold mb-2 block">
              {isRegister ? 'Email' : 'User ID'}
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
              <input type={isRegister ? 'email' : 'text'} value={email} onChange={e => setEmail(e.target.value)}
                className="w-full h-12 pl-11 pr-4 border border-earth-200 bg-white text-sm focus:outline-none focus:border-earth-400 transition-colors" placeholder={isRegister ? 'name@example.com' : 'Enter your ID'} required />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-earth-500 font-semibold mb-2 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full h-12 pl-11 pr-4 border border-earth-200 bg-white text-sm focus:outline-none focus:border-earth-400 transition-colors" placeholder="Enter password" required />
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 border border-red-100">{error}</div>}

          <button type="submit" className="w-full h-12 bg-earth-900 text-white text-sm font-semibold uppercase tracking-wider hover:bg-earth-800 transition-colors flex items-center justify-center gap-2 group">
            {isRegister ? 'Create Account' : 'Sign In'}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-earth-400">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsRegister(!isRegister); setError(''); }} className="text-earth-900 font-semibold underline underline-offset-2">
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </p>
          {!isRegister && <p className="text-xs text-earth-400">Admin: ARCHANA / ACHU</p>}
        </div>
      </div>
    </div>
  );
};

export default Login;
