import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Search, X, ChevronDown } from 'lucide-react';

const CATEGORIES = ['Hair', 'Face', 'Body', 'Oral'];
const SEVERITIES = ['Regular', 'High Severity', 'Improver'];

const Shop = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const location = useLocation();
  const qp = new URLSearchParams(location.search);

  const [category, setCategory] = useState(qp.get('category') || '');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState(qp.get('search') || '');
  const [productType, setProductType] = useState(qp.get('product_type') || '');
  const [brand, setBrand] = useState(qp.get('brand') || '');

  useEffect(() => {
    fetch('/api/products/filters')
      .then(r => r.json())
      .then(data => {
        setAvailableTypes(data.product_types || []);
        setAvailableBrands(data.brands || []);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (severity) params.append('severity', severity);
    if (search) params.append('search', search);
    if (productType) params.append('product_type', productType);
    if (brand) params.append('brand', brand);
    fetch(`/api/products?${params}`)
      .then(r => r.json())
      .then(data => { setProducts(data); setLoading(false); });
  }, [category, severity, search, productType, brand]);

  const hasFilters = category || severity || search || productType || brand;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10">
      {/* Title Row */}
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-serif font-bold text-earth-900">
          {category ? `${category} Care` : 'All Products'}
        </h1>
      </div>

      {/* Filters — horizontal chip bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-9 pr-8 py-2.5 text-sm bg-white border border-earth-200 rounded-full w-48 focus:outline-none focus:border-earth-400 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-earth-400" />
            </button>
          )}
        </div>

        <div className="h-6 w-px bg-earth-200 hidden sm:block" />

        {/* Category chips */}
        <button onClick={() => setCategory('')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors ${
            !category ? 'bg-earth-900 text-white border-earth-900' : 'bg-white text-earth-600 border-earth-200 hover:border-earth-400'
          }`}>All</button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors ${
              category === cat ? 'bg-earth-900 text-white border-earth-900' : 'bg-white text-earth-600 border-earth-200 hover:border-earth-400'
            }`}>{cat}</button>
        ))}

        <div className="h-6 w-px bg-earth-200 hidden sm:block" />

        {/* Severity chips */}
        {SEVERITIES.map(s => (
          <button key={s} onClick={() => setSeverity(severity === s ? '' : s)}
            className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors flex items-center gap-1.5 ${
              severity === s ? 'bg-earth-900 text-white border-earth-900' : 'bg-white text-earth-600 border-earth-200 hover:border-earth-400'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s === 'Regular' ? 'bg-emerald-500' : s === 'High Severity' ? 'bg-red-500' : 'bg-amber-500'} ${severity === s ? 'ring-1 ring-white' : ''}`} />
            {s}
          </button>
        ))}

        {availableTypes.length > 0 && (
          <>
            <div className="h-6 w-px bg-earth-200 hidden sm:block" />
            <div className="relative">
              <select
                value={productType}
                onChange={e => setProductType(e.target.value)}
                className="appearance-none pl-4 pr-8 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-full border bg-white text-earth-600 border-earth-200 hover:border-earth-400 focus:outline-none focus:border-earth-400 cursor-pointer"
              >
                <option value="">All Types</option>
                {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-earth-400 pointer-events-none" />
            </div>
          </>
        )}

        {availableBrands.length > 0 && (
          <div className="relative">
            <select
              value={brand}
              onChange={e => setBrand(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-full border bg-white text-earth-600 border-earth-200 hover:border-earth-400 focus:outline-none focus:border-earth-400 cursor-pointer"
            >
              <option value="">All Brands</option>
              {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-earth-400 pointer-events-none" />
          </div>
        )}

        {hasFilters && (
          <button onClick={() => { setCategory(''); setSeverity(''); setSearch(''); setProductType(''); setBrand(''); }}
            className="text-xs text-earth-400 hover:text-earth-600 underline underline-offset-2 ml-2">
            Clear all
          </button>
        )}
      </div>

      {/* Count */}
      {!loading && <p className="text-xs text-earth-400 mb-8">{products.length} product{products.length !== 1 ? 's' : ''} found</p>}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/5] bg-earth-200 rounded-sm mb-3" />
              <div className="h-2.5 bg-earth-200 rounded w-16 mb-2" />
              <div className="h-3 bg-earth-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-earth-200 rounded w-16" />
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
          {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="text-center py-28">
          <p className="text-earth-400 mb-2">No products match your filters.</p>
          <button onClick={() => { setCategory(''); setSeverity(''); setSearch(''); }}
            className="text-sm text-earth-600 underline underline-offset-4">
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
};

export default Shop;
