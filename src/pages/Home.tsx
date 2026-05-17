import React, { useEffect, useState } from 'react';
import { ArrowRight, Leaf, ShieldCheck, Recycle, Sparkles, Star, TrendingUp, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';

const SKIN_TYPES = ['normal', 'dry', 'oily', 'combination', 'sensitive'];
const CONCERNS = ['acne', 'anti-aging', 'dark-spots', 'dryness', 'hair-fall', 'dandruff', 'sun-protection', 'brightening'];
const CATEGORIES = ['Hair', 'Face', 'Body', 'Oral'];
const BUDGETS = ['0-500', '500-1000', '1000-2000', '2000+'];

const OnboardingModal: React.FC<{ userId: number; onComplete: () => void; onClose: () => void }> = ({ userId, onComplete, onClose }) => {
  const [step, setStep] = useState(0);
  const [skinType, setSkinType] = useState('');
  const [concerns, setConcerns] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [budget, setBudget] = useState('');

  const toggleConcern = (c: string) => setConcerns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleCat = (c: string) => setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const submit = async () => {
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: userId,
        skin_type: skinType || null,
        concerns: concerns.join(',') || null,
        budget_range: budget || null,
        preferred_categories: categories.map(c => c.toLowerCase()).join(',') || null,
      }),
    });
    onComplete();
  };

  const steps = [
    <div key="skin">
      <h3 className="text-lg font-serif font-bold text-earth-900 mb-4">What's your skin type?</h3>
      <div className="flex flex-wrap gap-2">
        {SKIN_TYPES.map(s => (
          <button key={s} onClick={() => setSkinType(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${skinType === s ? 'bg-brand-600 text-white' : 'bg-earth-100 text-earth-700 hover:bg-brand-100'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </div>,
    <div key="concerns">
      <h3 className="text-lg font-serif font-bold text-earth-900 mb-4">What are your main concerns?</h3>
      <div className="flex flex-wrap gap-2">
        {CONCERNS.map(c => (
          <button key={c} onClick={() => toggleConcern(c)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${concerns.includes(c) ? 'bg-brand-600 text-white' : 'bg-earth-100 text-earth-700 hover:bg-brand-100'}`}>
            {c.replace(/-/g, ' ')}
          </button>
        ))}
      </div>
    </div>,
    <div key="budget">
      <h3 className="text-lg font-serif font-bold text-earth-900 mb-4">Your budget range?</h3>
      <div className="flex flex-wrap gap-2">
        {BUDGETS.map(b => (
          <button key={b} onClick={() => setBudget(b)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${budget === b ? 'bg-brand-600 text-white' : 'bg-earth-100 text-earth-700 hover:bg-brand-100'}`}>
            ₹{b}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-6">
        <h3 className="text-lg font-serif font-bold text-earth-900 mb-2 w-full">Preferred categories?</h3>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => toggleCat(c)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${categories.includes(c) ? 'bg-brand-600 text-white' : 'bg-earth-100 text-earth-700 hover:bg-brand-100'}`}>
            {c}
          </button>
        ))}
      </div>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-earth-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl px-8 py-8 shadow-2xl max-w-md mx-4 w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-earth-400 hover:text-earth-700"><X className="w-5 h-5" /></button>
        <div className="flex gap-1.5 mb-6">
          {steps.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-brand-600' : 'bg-earth-200'}`} />)}
        </div>
        <Sparkles className="w-8 h-8 text-brand-600 mb-3" />
        <p className="text-xs text-brand-600 font-semibold uppercase tracking-wider mb-2">Help us personalize</p>
        {steps[step]}
        <div className="flex justify-between mt-6">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className="text-sm text-earth-500 hover:text-earth-700">Back</button> : <span />}
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="bg-brand-600 text-white px-6 py-2 rounded-full text-sm font-semibold hover:bg-brand-700">Next</button>
          ) : (
            <button onClick={submit} className="bg-brand-600 text-white px-6 py-2 rounded-full text-sm font-semibold hover:bg-brand-700">Get Recommendations</button>
          )}
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [categoryHeroes, setCategoryHeroes] = useState<Record<string, string>>({});
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then((data: any[]) => {
        const list = Array.isArray(data) ? data : [];
        setFeatured(list.filter(p => p.image).slice(0, 8));

        // Pick first product image per category for the bento hero
        const heroes: Record<string, string> = {};
        for (const p of list) {
          if (!heroes[p.category] && p.image) heroes[p.category] = p.image;
        }
        setCategoryHeroes(heroes);
      });
    fetch(`/api/recommendations/${user?.id || 0}?limit=8`)
      .then(r => r.json())
      .then(data => setRecommendations(Array.isArray(data) ? data : []));

    if (user && !user.onboarding_completed) {
      fetch(`/api/user/${user.id}/history`).then(r => r.json()).then((history: any[]) => {
        if (!Array.isArray(history) || history.length === 0) setShowOnboarding(true);
      }).catch(() => {});
    }
  }, [user]);

  const handleDismiss = (productId: number) => {
    setRecommendations(prev => prev.filter(p => p.id !== productId));
  };

  return (
    <div>
      {showOnboarding && user && (
        <OnboardingModal
          userId={user.id}
          onComplete={() => {
            setShowOnboarding(false);
            fetch(`/api/recommendations/${user.id}?limit=8`)
              .then(r => r.json())
              .then(data => setRecommendations(Array.isArray(data) ? data : []));
          }}
          onClose={() => setShowOnboarding(false)}
        />
      )}
      {/* --------------------------------- HERO --------------------------------- */}
      <section className="relative overflow-hidden">
        {/* Soft gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-100/40 pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-brand-200/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-20 w-[400px] h-[400px] rounded-full bg-brand-300/30 blur-3xl pointer-events-none" />

        <div className="relative container mx-auto px-6 sm:px-10 lg:px-16 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold uppercase tracking-wider mb-6">
              <Leaf className="w-3.5 h-3.5" /> New Season Collection
            </span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif font-bold text-earth-900 leading-[1.05] mb-6 text-balance">
              Pure nature,<br />
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-700 bg-clip-text text-transparent">
                radiant you.
              </span>
            </h1>
            <p className="text-earth-600 text-lg max-w-md mb-10 leading-relaxed">
              Organic personal care crafted from herbs, oils, and botanicals — delivered with smart recommendations made just for your skin.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/shop"
                className="bg-brand-600 text-white px-8 py-4 rounded-full text-sm font-semibold tracking-wide uppercase hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-500/30 transition-all inline-flex items-center gap-2 group"
              >
                Shop Collection
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/about"
                className="text-sm font-semibold text-earth-700 px-6 py-4 hover:text-brand-700 transition-colors inline-flex items-center gap-2"
              >
                Learn our story <span aria-hidden>→</span>
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-10 mt-14 pt-10 border-t border-earth-200">
              {[
                { num: '200+', label: 'Products' },
                { num: '100%', label: 'Organic' },
                { num: '25+', label: 'Brands' },
                { num: '4', label: 'Categories' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-3xl font-serif font-bold text-earth-900">{s.num}</p>
                  <p className="text-xs text-earth-500 uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — floating product cards collage */}
          <div className="relative hidden lg:block h-[600px] animate-fade-in stagger-2">
            {featured[0]?.image && (
              <div className="absolute top-0 right-0 w-72 h-96 rounded-3xl overflow-hidden shadow-2xl shadow-brand-900/20 animate-float">
                <img src={featured[0].image} alt={featured[0].pname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
            {featured[1]?.image && (
              <div className="absolute top-32 left-0 w-56 h-72 rounded-3xl overflow-hidden shadow-xl shadow-brand-900/20 animate-float" style={{ animationDelay: '1.5s' }}>
                <img src={featured[1].image} alt={featured[1].pname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
            {featured[2]?.image && (
              <div className="absolute bottom-0 right-16 w-60 h-60 rounded-3xl overflow-hidden shadow-xl shadow-brand-900/20 animate-float" style={{ animationDelay: '3s' }}>
                <img src={featured[2].image} alt={featured[2].pname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}

          </div>
        </div>
      </section>

      {/* ---------------------------- CATEGORY BENTO ---------------------------- */}
      <section className="container mx-auto px-4 sm:px-6 py-20">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Categories</span>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold text-earth-900 mt-2">Shop by Need</h2>
            <p className="text-earth-500 mt-2 max-w-md">Hair, face, body, oral — find what nature offers for every part of your routine.</p>
          </div>
          <Link to="/categories" className="text-sm font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-2 group">
            View all <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-2 gap-4 h-[500px] md:h-[460px]">
          {[
            { id: 'Hair', label: 'Hair Care', count: '51', span: 'col-span-2 row-span-2' },
            { id: 'Face', label: 'Face Care', count: '50', span: '' },
            { id: 'Body', label: 'Body Care', count: '50', span: '' },
            { id: 'Oral', label: 'Oral Care', count: '50', span: 'col-span-2' },
          ].map(cat => (
            <Link
              key={cat.id}
              to={`/shop?category=${cat.id}`}
              className={`relative overflow-hidden rounded-3xl group bg-brand-100 ${cat.span}`}
            >
              {categoryHeroes[cat.id] && (
                <img
                  src={categoryHeroes[cat.id]}
                  alt={cat.label}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-earth-900/80 via-earth-900/20 to-transparent" />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl" />
              <div className="absolute bottom-5 left-5 right-5">
                <p className="text-white/70 text-xs uppercase tracking-wider mb-1">{cat.count} products</p>
                <h3 className="text-white text-2xl md:text-3xl font-serif font-bold">{cat.label}</h3>
                <span className="inline-flex items-center gap-1.5 text-white/90 text-xs mt-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                  Shop now <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ----------------------------- FEATURED ROW ----------------------------- */}
      <section className="bg-gradient-to-b from-brand-50/50 via-white to-white py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600 inline-flex items-center gap-2">
                <Star className="w-3.5 h-3.5 fill-brand-600" /> Bestsellers
              </span>
              <h2 className="text-3xl sm:text-5xl font-serif font-bold text-earth-900 mt-2">Featured products</h2>
            </div>
            <Link to="/shop" className="text-sm font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-2 group">
              View all <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 lg:gap-6">
            {featured.slice(0, 8).map((p, i) => (
              <div key={p.id} className={`min-w-[240px] lg:min-w-0 snap-start animate-fade-in stagger-${(i % 6) + 1}`}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ TRUST STRIP ------------------------------ */}
      <section className="bg-brand-900 text-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Leaf className="w-6 h-6" />, title: '100% Organic', sub: 'Certified pure ingredients' },
              { icon: <ShieldCheck className="w-6 h-6" />, title: 'Derma Tested', sub: 'Safe for all skin types' },
              { icon: <Recycle className="w-6 h-6" />, title: 'Eco Packaging', sub: 'Fully recyclable' },
              { icon: <Sparkles className="w-6 h-6" />, title: 'Smart Recs', sub: 'AI-personalized picks' },
            ].map(b => (
              <div key={b.title} className="flex items-center gap-4 py-10 px-6 border-r last:border-r-0 border-brand-800">
                <div className="w-12 h-12 rounded-full bg-brand-700 flex items-center justify-center text-brand-200 shrink-0">{b.icon}</div>
                <div>
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="text-xs text-brand-200/80">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- RECOMMENDATIONS ---------------------------- */}
      {recommendations.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 py-20">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600 inline-flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                {user ? 'For You' : 'Trending'}
              </span>
              <h2 className="text-3xl sm:text-5xl font-serif font-bold text-earth-900 mt-2">
                {user ? 'Recommended for you' : 'Popular right now'}
              </h2>
              <p className="text-earth-500 mt-2 max-w-md">
                {user ? 'Based on your profile and purchase history.' : 'Discover what other shoppers are loving.'}
              </p>
            </div>
            <Link to="/shop" className="text-sm font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-2 group">
              View all <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {recommendations.slice(0, 8).map((p, i) => (
              <div key={p.id} className={`animate-fade-in stagger-${(i % 6) + 1}`}>
                <ProductCard product={p} recommendationReason={p.recommendation_reason} onDismiss={handleDismiss} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------- CTA BANNER ------------------------------ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-brand-300/20 blur-3xl" />

        <div className="relative container mx-auto px-4 sm:px-6 py-20 flex flex-col lg:flex-row items-center justify-between gap-8 text-white">
          <div className="max-w-xl text-center lg:text-left">
            <Leaf className="w-10 h-10 mb-4 text-brand-200 mx-auto lg:mx-0" />
            <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-4 text-balance">Begin your organic journey today.</h2>
            <p className="text-brand-100/90 text-lg">
              Join thousands who've made the switch to chemical-free, plant-powered personal care. Your skin will thank you.
            </p>
          </div>
          <Link
            to="/shop"
            className="bg-white text-brand-700 px-10 py-5 rounded-full text-sm font-semibold tracking-wide uppercase hover:bg-brand-50 hover:shadow-2xl transition-all shrink-0 inline-flex items-center gap-2 group"
          >
            Shop Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
