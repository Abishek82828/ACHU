import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, LogOut, ChevronRight, Camera, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, logout, isLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) { navigate('/login'); return; }
    if (user) fetch(`/api/user/${user.id}/history`).then(r => r.json()).then(setHistory);
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phone || '');
      setEditPhoto(user.profile_photo || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await fetch(`/api/user/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, phone: editPhone, profile_photo: editPhoto }),
      });
      await refreshUser();
      setEditing(false);
    } catch {}
    setSaving(false);
  };

  if (isLoading || !user) return <div className="container mx-auto px-4 py-20 text-center text-earth-400">Loading...</div>;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-10 border-b border-earth-200 mb-10">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {user.profile_photo ? (
              <img src={user.profile_photo} alt={user.name} className="w-16 h-16 object-cover rounded-full border-2 border-earth-200" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-16 h-16 bg-earth-900 text-white flex items-center justify-center text-2xl font-serif font-bold rounded-full">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            {!editing && (
              <button onClick={() => setEditing(true)} className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-earth-200 rounded-full flex items-center justify-center shadow-sm hover:bg-earth-50">
                <Camera className="w-3.5 h-3.5 text-earth-600" />
              </button>
            )}
          </div>
          <div>
            {editing ? (
              <div className="space-y-2">
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="text-xl font-serif font-bold text-earth-900 border border-earth-200 px-2 py-1 w-full" />
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone number"
                  className="text-sm text-earth-600 border border-earth-200 px-2 py-1 w-full" />
                <input value={editPhoto} onChange={e => setEditPhoto(e.target.value)} placeholder="Profile photo URL"
                  className="text-sm text-earth-600 border border-earth-200 px-2 py-1 w-full" />
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSaveProfile} disabled={saving}
                    className="flex items-center gap-1 text-xs bg-earth-900 text-white px-3 py-1.5 hover:bg-earth-800 disabled:opacity-50">
                    <Save className="w-3 h-3" /> Save
                  </button>
                  <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs border border-earth-200 px-3 py-1.5 hover:bg-earth-50">
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-serif font-bold text-earth-900">{user.name}</h1>
                <p className="text-sm text-earth-400">{user.email} &middot; {user.gender === 1 ? 'Female' : 'Male'}</p>
                {user.preferences && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {user.preferences.split(',').map(p => (
                      <span key={p} className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 font-medium">{p.trim()}</span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/'); }}
          className="text-sm text-earth-400 hover:text-red-500 flex items-center gap-1.5 transition-colors underline underline-offset-2">
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-14">
        {[
          { label: 'Orders', value: history.length },
          { label: 'Spent', value: `$${user.amountspent ?? 0}` },
          { label: 'Revenue', value: `$${(user.revenue ?? 0).toFixed(2)}` },
        ].map(s => (
          <div key={s.label} className="bg-white border border-earth-200 p-5 text-center">
            <p className="text-2xl sm:text-3xl font-serif font-bold text-earth-900">{s.value}</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-earth-400 font-semibold mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Orders */}
      <h2 className="text-2xl font-serif font-bold text-earth-900 mb-6">Order History</h2>

      {history.length > 0 ? (
        <div className="space-y-4">
          {history.map((order: any) => (
            <div key={order.id} className="bg-white border border-earth-200">
              <div className="px-5 py-4 bg-earth-50 flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-earth-200">
                {[
                  { label: 'Date', value: new Date(order.date).toLocaleDateString() },
                  { label: 'Total', value: `$${order.amount}` },
                  { label: 'Items', value: order.count },
                ].map(d => (
                  <div key={d.label}>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-earth-400">{d.label}</p>
                    <p className="text-sm font-medium text-earth-800">{d.value}</p>
                  </div>
                ))}
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1">Delivered</span>
              </div>
              <div className="divide-y divide-earth-100">
                {order.items?.map((item: any, idx: number) => (
                  <div key={idx} className="px-5 py-4 flex items-center gap-4">
                    <div className="w-14 h-14 bg-earth-100 shrink-0 overflow-hidden">
                      {item.image ? (
                        <img src={item.image} alt={item.product_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-earth-300"><Package className="w-5 h-5" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-earth-800 truncate">{item.product_name}</p>
                      <p className="text-xs text-earth-400">Qty: {item.quantity} &middot; ${item.price}</p>
                    </div>
                    <Link to={`/product/${item.product_id}`}
                      className="text-xs font-medium text-earth-500 hover:text-earth-900 flex items-center gap-0.5">
                      Buy Again <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-earth-200 bg-white">
          <Package className="w-10 h-10 text-earth-200 mx-auto mb-3" />
          <p className="text-earth-400 mb-4">No orders yet</p>
          <Link to="/shop" className="text-sm text-earth-600 underline underline-offset-4">Start Shopping</Link>
        </div>
      )}
    </div>
  );
};

export default Profile;
