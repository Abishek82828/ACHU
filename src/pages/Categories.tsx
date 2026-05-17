import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Leaf, TrendingUp, Search } from 'lucide-react';

interface Cat {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  count: number;
  topProducts: any[];
  heroImage: string;
  accent: string;       // gradient bg classes
  icon: React.ReactNode;
}

const CATEGORY_META: Record<string, Pick<Cat, 'tagline' | 'desc' | 'accent' | 'icon'>> = {
  Hair: {
    tagline: 'Roots to tips',
    desc: 'Natural oils, herbal cleansers and conditioners that restore strength, shine and growth — without harsh chemicals.',
    accent: 'from-emerald-700 via-emerald-600 to-emerald-800',
    icon: <Leaf className="w-5 h-5" />,
  },
  Face: {
    tagline: 'Pure radiance',
    desc: 'Cleansers, toners, serums and sunscreens powered by botanicals — for visibly healthier skin, every day.',
    accent: 'from-green-700 via-teal-600 to-emerald-700',
    icon: <Sparkles className="w-5 h-5" />,
  },
  Body: {
    tagline: 'Head-to-toe care',
    desc: 'Nourishing body washes, lotions, butters and oils that hydrate, soothe and pamper from neck to toe.',
    accent: 'from-emerald-600 via-green-700 to-lime-800',
    icon: <Leaf className="w-5 h-5" />,
  },
  Oral: {
    tagline: 'Bright & balanced',
    desc: 'Toothpastes, powders and mouthwashes rooted in Ayurveda — for stronger teeth, healthy gums and fresh breath.',
    accent: 'from-teal-700 via-emerald-700 to-green-800',
    icon: <TrendingUp className="w-5 h-5" />,
  },
};

const Categories = () => {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then((all: any[]) => {
        const byCat: Record<string, any[]> = { Hair: [], Face: [], Body: [], Oral: [] };
        for (const p of all) if (byCat[p.category]) byCat[p.category].push(p);
        const list: Cat[] = (['Hair', 'Face', 'Body', 'Oral'] as const).map(id => {
          const items = byCat[id];
          const withImg = items.filter(p => p.image);
          return {
            id,
            name: `${id} Care`,
            ...CATEGORY_META[id],
            count: items.length,
            topProducts: withImg.slice(0, 4),
            heroImage: withImg[0]?.image || '',
          };
        });
        setCats(list);
        setLoading(false);
      });
  }, []);

  const filtered = cats.filter(c =>
    !query.trim() ||
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.desc.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-100/40" />
        <div className="absolute -top-32 -left-32 w-[450px] h-[450px] rounded-full bg-brand-200/40 blur-3xl" />
        <div className="relative container mx-auto px-4 sm:px-6 py-16 lg:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold uppercase tracking-wider mb-5">
              <Leaf className="w-3.5 h-3.5" /> Curated collections
            </span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif font-bold text-earth-900 leading-[1.05] mb-5 text-balance">
              Find your <span className="bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent">ritual.</span>
            </h1>
            <p className="text-earth-600 text-lg max-w-xl leading-relaxed mb-8">
              Four essential collections — hair, face, body, oral — each a careful curation of organic, plant-powered products from trusted Ayurvedic and natural brands.
            </p>

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter categories…"
                className="w-full pl-11 pr-4 py-3.5 rounded-full bg-white border border-earth-200 text-sm placeholder-earth-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 transition-all"
              />
            </div>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="border-y border-earth-200 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {loading
              ? [...Array(4)].map((_, i) => (
                  <div key={i} className="py-8 px-6 border-r last:border-r-0 border-earth-100">
                    <div className="h-8 w-20 skeleton rounded mb-2" />
                    <div className="h-3 w-24 skeleton rounded" />
                  </div>
                ))
              : cats.map(c => (
                  <Link
                    key={c.id}
                    to={`/shop?category=${c.id}`}
                    className="py-8 px-6 border-r last:border-r-0 border-earth-100 hover:bg-brand-50/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                        {c.icon}
                      </span>
                      <p className="text-3xl font-serif font-bold text-earth-900">{c.count}</p>
                    </div>
                    <p className="text-xs uppercase tracking-wider text-earth-500 font-semibold">{c.name}</p>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* CATEGORY CARDS */}
      <section className="container mx-auto px-4 sm:px-6 py-16">
        <div className="space-y-8">
          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="h-[360px] rounded-3xl skeleton" />
              ))
            : filtered.map((cat, idx) => (
                <article
                  key={cat.id}
                  className={`grid grid-cols-1 lg:grid-cols-12 gap-0 rounded-3xl overflow-hidden bg-white border border-earth-100 shadow-xl shadow-brand-900/5 hover:shadow-2xl hover:shadow-brand-900/10 transition-shadow animate-fade-in stagger-${(idx % 5) + 1}`}
                >
                  {/* Hero image side */}
                  <Link
                    to={`/shop?category=${cat.id}`}
                    className={`relative lg:col-span-5 min-h-[280px] lg:min-h-[420px] overflow-hidden group ${
                      idx % 2 === 1 ? 'lg:order-2' : ''
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${cat.accent}`} />
                    {cat.heroImage && (
                      <img
                        src={cat.heroImage}
                        alt={cat.name}
                        className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-90 transition-transform duration-700 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                    <div className="absolute top-6 left-6 flex items-center gap-2 text-white">
                      <span className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                        {cat.icon}
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] font-bold">{cat.tagline}</span>
                    </div>
                    <div className="absolute bottom-6 left-6 right-6 text-white">
                      <p className="text-xs uppercase tracking-wider text-white/70 mb-1">{cat.count} products</p>
                      <h2 className="text-3xl sm:text-4xl font-serif font-bold">{cat.name}</h2>
                    </div>
                  </Link>

                  {/* Content side */}
                  <div className={`lg:col-span-7 p-8 sm:p-10 lg:p-12 flex flex-col justify-between ${idx % 2 === 1 ? 'lg:order-1' : ''}`}>
                    <div>
                      <p className="text-earth-600 leading-relaxed text-base lg:text-lg mb-8 max-w-2xl">{cat.desc}</p>

                      {/* Top product mini cards */}
                      <div className="grid grid-cols-4 gap-3 mb-8">
                        {cat.topProducts.map(p => (
                          <Link
                            key={p.id}
                            to={`/product/${p.id}`}
                            className="group/p"
                            title={p.pname}
                          >
                            <div className="aspect-square rounded-2xl overflow-hidden bg-brand-50">
                              <img
                                src={p.image}
                                alt={p.pname}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover/p:scale-110"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            </div>
                            <p className="text-[10px] text-earth-500 truncate mt-1.5">{p.brand || p.product_type || ''}</p>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <Link
                        to={`/shop?category=${cat.id}`}
                        className="inline-flex items-center gap-2 bg-brand-600 text-white px-7 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-500/30 transition-all group"
                      >
                        Explore {cat.name}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                      <Link
                        to={`/shop?category=${cat.id}`}
                        className="text-sm font-semibold text-earth-700 hover:text-brand-700 transition-colors"
                      >
                        See all {cat.count} →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}

          {!loading && filtered.length === 0 && (
            <div className="py-20 text-center text-earth-500">
              <p>No categories match "{query}"</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-brand-800" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative container mx-auto px-4 sm:px-6 py-16 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-3 text-balance">Not sure where to start?</h2>
          <p className="text-brand-100/90 max-w-md mx-auto mb-8">
            Browse everything in one place, or jump into a category that feels right for you today.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/shop" className="bg-white text-brand-700 px-8 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider hover:bg-brand-50 transition-colors">
              Shop everything
            </Link>
            <Link to="/about" className="bg-white/10 backdrop-blur border border-white/20 text-white px-8 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider hover:bg-white/20 transition-colors">
              Our story
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Categories;
