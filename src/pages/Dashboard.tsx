import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, Package, ShoppingCart, DollarSign, TrendingUp, BarChart3, Target, Activity, ShieldX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DashboardData {
  totalCustomers: number;
  totalProducts: number;
  totalTransactions: number;
  totalRevenue: number;
  totalAmountSpent: number;
  recommendationsSent: number;
  purchasesFromRecs: number;
  conversionRate: number;
  topProducts: any[];
  categoryBreakdown: any[];
  recentLogs: any[];
}

const Dashboard = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || user.is_admin !== 1)) return;
    fetch('/api/dashboard').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, [user, isLoading]);

  if (!isLoading && (!user || user.is_admin !== 1)) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <ShieldX className="w-16 h-16 text-earth-300 mx-auto mb-4" />
        <h1 className="text-2xl font-serif font-bold text-earth-900 mb-2">Access Denied</h1>
        <p className="text-earth-400 mb-6">You don't have admin privileges to access the dashboard.</p>
        <button onClick={() => navigate('/')} className="text-sm text-earth-600 underline underline-offset-4">Go Home</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-10">
        <div className="animate-pulse space-y-8">
          <div className="h-10 w-64 bg-earth-200" />
          <div className="grid grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-earth-200" />)}</div>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Customers', value: data.totalCustomers, icon: <Users className="w-5 h-5" />, accent: 'text-blue-600' },
    { label: 'Products', value: data.totalProducts, icon: <Package className="w-5 h-5" />, accent: 'text-brand-600' },
    { label: 'Transactions', value: data.totalTransactions, icon: <ShoppingCart className="w-5 h-5" />, accent: 'text-purple-600' },
    { label: 'Revenue', value: `$${data.totalRevenue}`, icon: <DollarSign className="w-5 h-5" />, accent: 'text-emerald-600' },
    { label: 'Spent', value: `$${data.totalAmountSpent}`, icon: <TrendingUp className="w-5 h-5" />, accent: 'text-amber-600' },
    { label: 'Recs Sent', value: data.recommendationsSent, icon: <Target className="w-5 h-5" />, accent: 'text-pink-600' },
    { label: 'From Recs', value: data.purchasesFromRecs, icon: <Activity className="w-5 h-5" />, accent: 'text-indigo-600' },
    { label: 'Conversion', value: `${data.conversionRate}%`, icon: <BarChart3 className="w-5 h-5" />, accent: 'text-teal-600' },
  ];

  const catColors: Record<string, string> = { Hair: 'bg-purple-500', Face: 'bg-pink-500', Body: 'bg-emerald-500', Oral: 'bg-blue-500' };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-serif font-bold text-earth-900">Dashboard</h1>
          <p className="text-sm text-earth-400 mt-1">Recommendation engine analytics & sales metrics</p>
        </div>
        <Link to="/admin/products" className="flex items-center gap-2 bg-earth-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-earth-800 transition-colors">
          <Package className="w-4 h-4" /> Manage Products
        </Link>
      </div>

      {/* Bento stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-earth-200 border border-earth-200 mb-10">
        {stats.map((s, i) => (
          <div key={i} className="bg-white p-5">
            <div className={`${s.accent} mb-3`}>{s.icon}</div>
            <p className="text-2xl font-serif font-bold text-earth-900">{s.value}</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-earth-400 font-semibold mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Top Products */}
        <div className="bg-white border border-earth-200 p-6">
          <h3 className="text-lg font-serif font-bold text-earth-900 mb-5">Top Selling Products</h3>
          {data.topProducts.length > 0 ? (
            <div className="space-y-4">
              {data.topProducts.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-4">
                  <span className="text-sm font-bold text-earth-300 w-5 tabular-nums">{i + 1}</span>
                  <div className="w-10 h-10 bg-earth-100 shrink-0 overflow-hidden">
                    {p.image && <img src={p.image} alt={p.pname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-earth-800 truncate">{p.pname}</p>
                    <p className="text-xs text-earth-400">{p.category} &middot; {p.severity}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-earth-900">{p.purchase_count}</p>
                    <p className="text-[10px] text-earth-400">sold</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-earth-400 text-center py-8">No sales data yet.</p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white border border-earth-200 p-6">
          <h3 className="text-lg font-serif font-bold text-earth-900 mb-5">Categories</h3>
          <div className="space-y-5">
            {data.categoryBreakdown.map((cat: any) => {
              const pct = Math.round((cat.count / data.totalProducts) * 100);
              return (
                <div key={cat.category}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${catColors[cat.category] || 'bg-earth-400'}`} />
                      <span className="text-sm font-medium text-earth-700">{cat.category}</span>
                    </div>
                    <span className="text-xs text-earth-400 tabular-nums">{cat.count} products &middot; {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-earth-100 overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${catColors[cat.category] || 'bg-earth-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conversion highlight */}
          <div className="mt-8 pt-6 border-t border-earth-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-earth-700">Recommendation Conversion</p>
                <p className="text-xs text-earth-400">Purchases from recommendations</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-serif font-bold text-brand-600">{data.conversionRate}%</p>
                <p className="text-[10px] text-earth-400">{data.purchasesFromRecs} of {data.recommendationsSent} recs</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white border border-earth-200">
        <div className="px-6 py-4 border-b border-earth-200">
          <h3 className="text-lg font-serif font-bold text-earth-900">Recent Activity</h3>
        </div>
        {data.recentLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-earth-100 bg-earth-50">
                  <th className="text-left py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-earth-400">Customer</th>
                  <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Rec Sent</th>
                  <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Purchased</th>
                  <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-earth-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLogs.map((log: any) => (
                  <tr key={log.id} className="border-b border-earth-50 hover:bg-earth-50 transition-colors">
                    <td className="py-3 px-6 font-medium text-earth-800">{log.customer_name || `#${log.customer_id}`}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${log.recommendation_sent ? 'text-emerald-600' : 'text-earth-300'}`}>
                        {log.recommendation_sent ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${log.product_purchased ? 'text-brand-600' : 'text-earth-300'}`}>
                        {log.product_purchased ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-earth-400 tabular-nums">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-earth-400">No activity yet.</div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
