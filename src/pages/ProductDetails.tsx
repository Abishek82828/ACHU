import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, ArrowLeft, Star, Check, Truck, ShieldCheck,
  RefreshCw, Zap, Heart, Leaf, Loader2,
} from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [qty, setQty] = useState(1);
  const { addToCart } = useCart();
  const { user, refreshUser } = useAuth();
  const { show } = useToast();

  useEffect(() => {
    setLoading(true);
    setAdded(false);
    setPurchased(false);
    setQty(1);
    fetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(data => { setProduct(data); setLoading(false); });
    fetch(`/api/recommendations/${user?.id || 0}?product_id=${id}&limit=8`)
      .then(r => r.json())
      .then(data => setRecommendations(Array.isArray(data) ? data : []));
    if (user?.id && id) {
      fetch('/api/tracking/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: user.id, product_id: Number(id) }),
      }).catch(() => {});
    }
    window.scrollTo(0, 0);
  }, [id, user]);

  const handleAdd = () => {
    if (!product) return;
    for (let i = 0; i < qty; i++) addToCart(product);
    setAdded(true);
    show(`${product.pname} added to cart`, 'cart');
    setTimeout(() => setAdded(false), 1800);
  };

  const handleBuyNow = async () => {
    if (!product) return;
    if (!user) {
      show('Please log in to continue', 'error');
      navigate(`/login?redirect=/product/${id}`);
      return;
    }
    setBuyingNow(true);
    try {
      const items = [{
        id: product.id,
        name: product.pname,
        price: product.netprice,
        image: product.image,
        quantity: qty,
      }];
      const total = product.netprice * qty;
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: user.id, items, total }),
      });
      if (res.ok) {
        await refreshUser();
        setPurchased(true);
        show(`Order placed for ${product.pname}!`, 'success');
        setTimeout(() => navigate('/profile'), 1800);
      } else {
        show('Purchase failed. Try again.', 'error');
      }
    } catch {
      show('Network error. Try again.', 'error');
    } finally {
      setBuyingNow(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 aspect-square rounded-3xl skeleton" />
          <div className="lg:col-span-5 py-6 space-y-4">
            <div className="h-3 w-24 skeleton rounded-full" />
            <div className="h-10 w-3/4 skeleton rounded-xl" />
            <div className="h-6 w-32 skeleton rounded-md" />
            <div className="h-20 w-full skeleton rounded-xl mt-6" />
            <div className="flex gap-3 mt-6">
              <div className="h-14 w-32 skeleton rounded-full" />
              <div className="h-14 flex-1 skeleton rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return (
    <div className="container mx-auto px-4 py-32 text-center">
      <p className="text-earth-500">Product not found.</p>
      <Link to="/shop" className="text-sm underline text-brand-700 mt-4 inline-block">Back to Shop</Link>
    </div>
  );

  const discount = product.netprice < product.sellingprice
    ? Math.round(((product.sellingprice - product.netprice) / product.sellingprice) * 100) : 0;

  return (
    <div>
      {/* Success overlay */}
      {purchased && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-earth-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl px-10 py-12 text-center shadow-2xl max-w-sm mx-4">
            <div className="w-20 h-20 rounded-full bg-brand-100 mx-auto flex items-center justify-center mb-5 animate-success-pop">
              <Check className="w-10 h-10 text-brand-600" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-serif font-bold text-earth-900 mb-2">Order placed!</h2>
            <p className="text-earth-500 text-sm">Redirecting you to your profile…</p>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 sm:px-6 pt-6">
        <div className="flex items-center gap-2 text-xs text-earth-400">
          <Link to="/shop" className="hover:text-brand-700 flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Shop
          </Link>
          <span>/</span>
          <span className="text-earth-700 font-medium">{product.pname}</span>
        </div>
      </div>

      {/* Product */}
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Image */}
          <div className="lg:col-span-7">
            <div className="aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-brand-50 to-brand-100/50 sticky top-28 group">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.pname}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-earth-300">
                  <Leaf className="w-16 h-16" />
                </div>
              )}
              {/* Floating discount badge */}
              {discount > 0 && (
                <div className="absolute top-6 left-6 bg-brand-600 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg shadow-brand-900/30">
                  Save {discount}%
                </div>
              )}
              <button
                onClick={() => { setWishlisted(!wishlisted); show(wishlisted ? 'Removed from wishlist' : 'Saved to wishlist', 'success'); }}
                className="absolute top-6 right-6 w-11 h-11 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                aria-label="Wishlist"
              >
                <Heart className={`w-5 h-5 ${wishlisted ? 'fill-red-500 text-red-500' : 'text-earth-600'}`} />
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="lg:col-span-5 py-2 lg:py-4">
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {product.brand && (
                <span className="text-xs uppercase tracking-[0.18em] text-brand-700 font-bold">{product.brand}</span>
              )}
              {product.product_type && (
                <span className="text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full bg-brand-100 text-brand-700">
                  {product.product_type}
                </span>
              )}
              <span className="text-[10px] uppercase tracking-wider font-medium px-3 py-1 rounded-full bg-earth-100 text-earth-600">
                {product.category} Care
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {product.severity}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-earth-900 leading-tight mb-5 text-balance">
              {product.pname}
            </h1>

            <div className="flex items-center gap-2 mb-6">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-xs text-earth-500">4.8 (48 reviews)</span>
            </div>

            <div className="flex items-baseline gap-3 mb-8 pb-8 border-b border-earth-200">
              <span className="text-4xl font-bold text-earth-900">${product.netprice}</span>
              {discount > 0 && (
                <>
                  <span className="text-lg text-earth-400 line-through">${product.sellingprice}</span>
                  <span className="text-xs font-bold text-white bg-brand-600 px-2.5 py-1 rounded-md">-{discount}%</span>
                </>
              )}
            </div>

            <p className="text-earth-600 leading-relaxed text-sm mb-6">{product.description}</p>

            {product.problem_tags && (
              <div className="flex flex-wrap gap-2 mb-8">
                {product.problem_tags.split(',').map((tag: string) => (
                  <span key={tag} className="text-[11px] px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/60 font-medium">
                    {tag.trim().replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Qty selector */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xs uppercase tracking-wider text-earth-500 font-semibold">Quantity</span>
              <div className="flex items-center rounded-full bg-earth-100">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-10 h-10 rounded-full hover:bg-white transition-colors text-earth-700"
                  aria-label="Decrease"
                >
                  −
                </button>
                <span className="w-10 h-10 flex items-center justify-center text-sm font-bold">{qty}</span>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="w-10 h-10 rounded-full hover:bg-white transition-colors text-earth-700"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            </div>

            {/* Buy Now (primary) + Add to Cart */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              <button
                onClick={handleBuyNow}
                disabled={buyingNow || purchased}
                className="h-14 rounded-full bg-brand-600 text-white text-sm font-bold uppercase tracking-wider hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-500/30 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {buyingNow ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                ) : purchased ? (
                  <><Check className="w-4 h-4" /> Ordered</>
                ) : (
                  <><Zap className="w-4 h-4 fill-white" /> Buy Now</>
                )}
              </button>
              <button
                onClick={handleAdd}
                disabled={added}
                className={`h-14 rounded-full text-sm font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-2 ${
                  added
                    ? 'bg-brand-100 text-brand-700 border-2 border-brand-300'
                    : 'bg-white text-earth-900 border-2 border-earth-200 hover:border-brand-600 hover:text-brand-700'
                }`}
              >
                {added ? <><Check className="w-4 h-4" /> Added</> : <><ShoppingCart className="w-4 h-4" /> Add to Cart</>}
              </button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-1 gap-3 p-5 rounded-2xl bg-earth-50 border border-earth-100">
              {[
                { icon: <Truck className="w-4 h-4" />, text: 'Free shipping on orders over $50' },
                { icon: <ShieldCheck className="w-4 h-4" />, text: '100% organic & dermatologically tested' },
                { icon: <RefreshCw className="w-4 h-4" />, text: '30-day easy returns' },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-earth-600">
                  <span className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                    {t.icon}
                  </span>
                  {t.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Related */}
      {recommendations.filter(p => p.id !== product.id).length > 0 && (
        <section className="bg-gradient-to-b from-brand-50/40 to-white py-16">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mb-8">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Curated for you</span>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-earth-900 mt-2">You may also like</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
              {recommendations.filter(p => p.id !== product.id).slice(0, 4).map(p => (
                <ProductCard key={p.id} product={p} recommendationReason={p.recommendation_reason} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetails;
