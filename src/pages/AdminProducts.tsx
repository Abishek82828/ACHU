import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, Save, Package, Image, ShieldX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Product {
  id: number;
  pname: string;
  netprice: number;
  sellingprice: number;
  category: string;
  severity: string;
  description: string;
  image: string;
  problem_tags: string;
  brand: string;
  product_type: string;
}

const CATEGORIES = ['Hair', 'Face', 'Body', 'Oral'];
const SEVERITIES = ['Regular', 'High Severity', 'Improver'];

const emptyProduct = { pname: '', netprice: 0, sellingprice: 0, category: 'Hair', severity: 'Regular', description: '', image: '', problem_tags: '', brand: '', product_type: '' };

const AdminProducts = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyProduct);
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');

  useEffect(() => {
    if (!isLoading && (!user || user.is_admin !== 1)) return;
    loadProducts();
  }, [user, isLoading]);

  const loadProducts = () => {
    fetch('/api/products').then(r => r.json()).then(d => { setProducts(d); setLoading(false); });
  };

  const handleSave = async () => {
    if (!form.pname || !form.category || !form.severity) return;
    const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
    const method = editingId ? 'PUT' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setEditingId(null);
    setShowAdd(false);
    setForm(emptyProduct);
    loadProducts();
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setShowAdd(true);
    setForm({ pname: p.pname, netprice: p.netprice, sellingprice: p.sellingprice, category: p.category, severity: p.severity, description: p.description || '', image: p.image || '', problem_tags: p.problem_tags || '', brand: p.brand || '', product_type: p.product_type || '' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    loadProducts();
  };

  if (!isLoading && (!user || user.is_admin !== 1)) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <ShieldX className="w-16 h-16 text-earth-300 mx-auto mb-4" />
        <h1 className="text-2xl font-serif font-bold text-earth-900 mb-2">Access Denied</h1>
        <p className="text-earth-400 mb-6">Admin privileges required.</p>
        <button onClick={() => navigate('/')} className="text-sm text-earth-600 underline underline-offset-4">Go Home</button>
      </div>
    );
  }

  if (loading) return <div className="container mx-auto px-4 py-10"><div className="animate-pulse h-10 w-64 bg-earth-200 mb-6" /></div>;

  const filtered = products.filter(p => {
    const matchesSearch = !filter || p.pname.toLowerCase().includes(filter.toLowerCase()) || (p.brand || '').toLowerCase().includes(filter.toLowerCase());
    const matchesCat = !catFilter || p.category === catFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-earth-900">Product Management</h1>
          <p className="text-sm text-earth-400 mt-1">{products.length} products total</p>
        </div>
        <button onClick={() => { setShowAdd(true); setEditingId(null); setForm(emptyProduct); }}
          className="flex items-center gap-2 bg-earth-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-earth-800 transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search by name or brand..."
          className="h-10 px-4 border border-earth-200 text-sm flex-1 min-w-[200px] focus:outline-none focus:border-earth-400" />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="h-10 px-3 border border-earth-200 text-sm bg-white focus:outline-none focus:border-earth-400">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Add/Edit Form */}
      {showAdd && (
        <div className="bg-white border border-earth-200 p-6 mb-8">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-serif font-bold text-earth-900">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
            <button onClick={() => { setShowAdd(false); setEditingId(null); }}><X className="w-5 h-5 text-earth-400" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-earth-500 font-semibold mb-1 block">Product Name *</label>
              <input value={form.pname} onChange={e => setForm({...form, pname: e.target.value})}
                className="w-full h-10 px-3 border border-earth-200 text-sm focus:outline-none focus:border-earth-400" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-earth-500 font-semibold mb-1 block">Brand</label>
              <input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})}
                className="w-full h-10 px-3 border border-earth-200 text-sm focus:outline-none focus:border-earth-400" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-earth-500 font-semibold mb-1 block">Product Type</label>
              <input value={form.product_type} onChange={e => setForm({...form, product_type: e.target.value})}
                className="w-full h-10 px-3 border border-earth-200 text-sm focus:outline-none focus:border-earth-400" placeholder="e.g. Shampoo, Face Wash" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-earth-500 font-semibold mb-1 block">Category *</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                className="w-full h-10 px-3 border border-earth-200 text-sm bg-white focus:outline-none focus:border-earth-400">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-earth-500 font-semibold mb-1 block">Severity *</label>
              <select value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}
                className="w-full h-10 px-3 border border-earth-200 text-sm bg-white focus:outline-none focus:border-earth-400">
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-earth-500 font-semibold mb-1 block">Net Price</label>
              <input type="number" value={form.netprice} onChange={e => setForm({...form, netprice: +e.target.value})}
                className="w-full h-10 px-3 border border-earth-200 text-sm focus:outline-none focus:border-earth-400" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-earth-500 font-semibold mb-1 block">Selling Price</label>
              <input type="number" value={form.sellingprice} onChange={e => setForm({...form, sellingprice: +e.target.value})}
                className="w-full h-10 px-3 border border-earth-200 text-sm focus:outline-none focus:border-earth-400" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-earth-500 font-semibold mb-1 block">Image URL</label>
              <input value={form.image} onChange={e => setForm({...form, image: e.target.value})}
                className="w-full h-10 px-3 border border-earth-200 text-sm focus:outline-none focus:border-earth-400" placeholder="https://..." />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-earth-500 font-semibold mb-1 block">Problem Tags</label>
              <input value={form.problem_tags} onChange={e => setForm({...form, problem_tags: e.target.value})}
                className="w-full h-10 px-3 border border-earth-200 text-sm focus:outline-none focus:border-earth-400" placeholder="dry-hair, frizz, shine" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-[10px] uppercase tracking-wider text-earth-500 font-semibold mb-1 block">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3}
                className="w-full px-3 py-2 border border-earth-200 text-sm focus:outline-none focus:border-earth-400 resize-none" />
            </div>
          </div>
          {form.image && (
            <div className="mt-4 flex items-center gap-3">
              <Image className="w-4 h-4 text-earth-400" />
              <img src={form.image} alt="Preview" className="w-16 h-16 object-cover border border-earth-200" referrerPolicy="no-referrer" />
            </div>
          )}
          <div className="mt-5 flex gap-3">
            <button onClick={handleSave} className="flex items-center gap-2 bg-earth-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-earth-800">
              <Save className="w-4 h-4" /> {editingId ? 'Update' : 'Create'} Product
            </button>
            <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="px-5 py-2.5 text-sm border border-earth-200 hover:bg-earth-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white border border-earth-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-earth-100 bg-earth-50">
                <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">ID</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Image</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Name</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Brand</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Category</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Type</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Price</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Severity</th>
                <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-earth-50 hover:bg-earth-50 transition-colors">
                  <td className="py-3 px-4 text-earth-400 tabular-nums">#{p.id}</td>
                  <td className="py-3 px-4">
                    <div className="w-10 h-10 bg-earth-100 overflow-hidden">
                      {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package className="w-5 h-5 text-earth-300 m-auto mt-2.5" />}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-earth-800 max-w-[200px] truncate">{p.pname}</td>
                  <td className="py-3 px-4 text-earth-500">{p.brand || '-'}</td>
                  <td className="py-3 px-4"><span className="text-[10px] font-bold uppercase tracking-wider bg-earth-100 px-2 py-0.5">{p.category}</span></td>
                  <td className="py-3 px-4 text-earth-500 text-xs">{p.product_type || '-'}</td>
                  <td className="py-3 px-4 font-medium tabular-nums">${p.sellingprice}</td>
                  <td className="py-3 px-4"><span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${p.severity === 'High Severity' ? 'bg-red-50 text-red-600' : p.severity === 'Improver' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>{p.severity}</span></td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleEdit(p)} className="p-1.5 hover:bg-earth-100 rounded transition-colors"><Pencil className="w-3.5 h-3.5 text-earth-500" /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-earth-400">No products found.</div>
        )}
      </div>
    </div>
  );
};

export default AdminProducts;
