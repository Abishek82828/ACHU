import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, Menu, X, BarChart3 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface SearchProduct {
  id: number;
  pname: string;
  category: string;
  sellingprice: number;
  recommendation_reason?: string;
}

const Navbar = () => {
  const { totalItems } = useCart();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [matched, setMatched] = useState<SearchProduct[]>([]);
  const [recommended, setRecommended] = useState<SearchProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setShowDropdown(false); setSearchOpen(false); }
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowDropdown(false); setSearchOpen(false); } };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (!q) { setMatched([]); setRecommended([]); setShowDropdown(false); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&customer_id=${user?.id ?? 0}&limit=6`, { signal: ctrl.signal });
        const data = await res.json();
        setMatched(data.matched_products || []);
        setRecommended(data.recommended_products || []);
        setShowDropdown(true);
      } catch {}
      setIsSearching(false);
    }, 280);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [search, user?.id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) { setShowDropdown(false); setSearchOpen(false); navigate(`/shop?search=${encodeURIComponent(search)}`); }
  };

  const selectProduct = (id: number) => { setShowDropdown(false); setSearchOpen(false); navigate(`/product/${id}`); };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop' },
    { to: '/categories', label: 'Categories' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-earth-200/60">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-600 text-white text-center py-2 text-xs tracking-wide">
        Free shipping on orders over $50 &mdash; <Link to="/shop" className="underline underline-offset-2">Shop now</Link>
      </div>

      <nav className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: hamburger + nav */}
          <div className="flex items-center gap-6">
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger render={<button className="p-1"><Menu className="w-5 h-5" /></button>} />
                <SheetContent side="left" className="bg-white w-72 p-0">
                  <div className="flex flex-col p-6 gap-1 mt-6">
                    {navLinks.map(l => (
                      <Link key={l.to} to={l.to} className="py-3 text-lg font-medium text-earth-800 hover:text-brand-600 border-b border-earth-100">
                        {l.label}
                      </Link>
                    ))}
                    {user?.is_admin === 1 && (
                      <Link to="/dashboard" className="py-3 text-lg font-medium text-earth-800 hover:text-brand-600 border-b border-earth-100 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> Dashboard
                      </Link>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="hidden lg:flex items-center gap-6">
              {navLinks.map(l => (
                <Link key={l.to} to={l.to} className="text-[13px] font-medium text-earth-600 hover:text-earth-900 uppercase tracking-wider transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Center: logo */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="text-2xl font-serif font-bold tracking-tight text-earth-900">VERDANT</span>
            <span className="text-[8px] uppercase tracking-[0.35em] text-earth-400 -mt-0.5">organic care</span>
          </Link>

          {/* Right: icons */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative" ref={searchRef as any}>
              <button onClick={() => setSearchOpen(!searchOpen)} className="p-2 hover:bg-earth-100 rounded-full transition-colors">
                <Search className="w-[18px] h-[18px] text-earth-700" />
              </button>

              {searchOpen && (
                <form onSubmit={handleSearch} ref={searchRef}
                  className="absolute right-0 top-full mt-2 w-72 sm:w-96 bg-white rounded-2xl shadow-2xl border border-earth-200 overflow-hidden z-50">
                  <div className="flex items-center px-4 border-b border-earth-100">
                    <Search className="w-4 h-4 text-earth-400 shrink-0" />
                    <input
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search products..."
                      className="flex-1 px-3 py-3.5 text-sm bg-transparent outline-none placeholder:text-earth-400"
                    />
                    {search && <button type="button" onClick={() => setSearch('')}><X className="w-4 h-4 text-earth-400" /></button>}
                  </div>

                  {showDropdown && (
                    <div className="max-h-80 overflow-y-auto">
                      {isSearching && <div className="px-4 py-3 text-sm text-earth-400">Searching...</div>}
                      {!isSearching && (
                        <>
                          {matched.length > 0 && matched.map(p => (
                            <button type="button" key={`s-${p.id}`} onClick={() => selectProduct(p.id)}
                              className="w-full text-left px-4 py-3 hover:bg-earth-50 border-b border-earth-50 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-earth-100 flex items-center justify-center text-[10px] font-bold text-earth-500 shrink-0">
                                {p.category.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-earth-800 truncate">{p.pname}</p>
                                <p className="text-xs text-earth-400">{p.category} &middot; ${p.sellingprice}</p>
                              </div>
                            </button>
                          ))}
                          {matched.length === 0 && <div className="px-4 py-3 text-sm text-earth-400">No results found</div>}
                          {recommended.length > 0 && (
                            <>
                              <div className="px-4 py-2 bg-brand-50 text-[10px] font-bold uppercase tracking-widest text-brand-600">Recommended</div>
                              {recommended.map(p => (
                                <button type="button" key={`r-${p.id}`} onClick={() => selectProduct(p.id)}
                                  className="w-full text-left px-4 py-3 hover:bg-earth-50 border-b border-earth-50">
                                  <p className="text-sm font-medium text-earth-800">{p.pname}</p>
                                  <p className="text-xs text-earth-400">${p.sellingprice}</p>
                                  {p.recommendation_reason && <p className="text-[11px] text-brand-600 mt-0.5">{p.recommendation_reason}</p>}
                                </button>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </form>
              )}
            </div>

            {user?.is_admin === 1 && (
              <Link to="/dashboard" className="hidden lg:block p-2 hover:bg-earth-100 rounded-full transition-colors">
                <BarChart3 className="w-[18px] h-[18px] text-earth-700" />
              </Link>
            )}

            {user ? (
              <Link to="/profile" className="p-2 hover:bg-earth-100 rounded-full transition-colors">
                <User className="w-[18px] h-[18px] text-earth-700" />
              </Link>
            ) : (
              <Link to="/login" className="p-2 hover:bg-earth-100 rounded-full transition-colors">
                <User className="w-[18px] h-[18px] text-earth-700" />
              </Link>
            )}

            <Link to="/cart" className="relative p-2 hover:bg-earth-100 rounded-full transition-colors">
              <ShoppingCart className="w-[18px] h-[18px] text-earth-700" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
