import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, ShoppingBag, ArrowRight, Package, Loader2, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const Cart = () => {
  const { cart, removeFromCart, updateQuantity, totalPrice, clearCart } = useCart();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [purchased, setPurchased] = useState(false);

  const handleCheckout = async () => {
    if (!user) { show('Please log in to checkout', 'error'); navigate('/login?redirect=/cart'); return; }
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: user.id, items: cart, total: totalPrice }),
      });
      if (res.ok) {
        await refreshUser();
        setPurchased(true);
        show(`Order placed — $${totalPrice.toFixed(2)}`, 'success');
        setTimeout(() => { clearCart(); navigate('/profile'); }, 1800);
      } else {
        show('Checkout failed. Try again.', 'error');
      }
    } catch (e) {
      console.error('Checkout error:', e);
      show('Network error. Try again.', 'error');
    } finally { setIsCheckingOut(false); }
  };

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-32 text-center">
        <ShoppingBag className="w-12 h-12 text-earth-300 mx-auto mb-4" />
        <h1 className="text-2xl font-serif font-bold text-earth-900 mb-2">Your cart is empty</h1>
        <p className="text-sm text-earth-400 mb-8">Add some organic goodness to get started.</p>
        <Link to="/shop" className="bg-earth-900 text-white px-8 py-3.5 text-sm font-semibold uppercase tracking-wider hover:bg-earth-800 transition-colors inline-block">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10">
      {purchased && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-earth-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl px-10 py-12 text-center shadow-2xl max-w-sm mx-4">
            <div className="w-20 h-20 rounded-full bg-brand-100 mx-auto flex items-center justify-center mb-5 animate-success-pop">
              <Check className="w-10 h-10 text-brand-600" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-serif font-bold text-earth-900 mb-2">Thank you!</h2>
            <p className="text-earth-500 text-sm">Your order has been placed.</p>
          </div>
        </div>
      )}
      <h1 className="text-4xl font-serif font-bold text-earth-900 mb-2">Cart</h1>
      <p className="text-sm text-earth-400 mb-10">{cart.length} item{cart.length !== 1 ? 's' : ''} in your cart</p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
        {/* Items */}
        <div className="lg:col-span-8">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 pb-3 border-b border-earth-200 text-[10px] uppercase tracking-[0.15em] text-earth-400 font-semibold">
            <div className="col-span-6">Product</div>
            <div className="col-span-2 text-center">Price</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">Total</div>
          </div>

          {cart.map(item => (
            <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 py-6 border-b border-earth-100 items-center">
              {/* Product */}
              <div className="sm:col-span-6 flex items-center gap-4">
                <div className="w-20 h-20 bg-earth-100 shrink-0 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-earth-300"><Package className="w-6 h-6" /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-earth-900 truncate">{item.name}</h3>
                  <button onClick={() => removeFromCart(item.id)} className="text-xs text-earth-400 hover:text-red-500 underline underline-offset-2 mt-1">
                    Remove
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="sm:col-span-2 text-sm text-earth-600 text-center">${item.price}</div>

              {/* Qty */}
              <div className="sm:col-span-2 flex items-center justify-center">
                <div className="inline-flex items-center border border-earth-200">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center text-earth-400 hover:text-earth-900">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 h-8 flex items-center justify-center text-sm font-medium border-x border-earth-200">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-earth-400 hover:text-earth-900">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Total */}
              <div className="sm:col-span-2 text-sm font-semibold text-earth-900 text-right">
                ${(item.price * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-4">
          <div className="bg-earth-100/50 p-6 sm:p-8 sticky top-28">
            <h2 className="text-lg font-serif font-bold text-earth-900 mb-6">Order Summary</h2>
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between"><span className="text-earth-500">Subtotal</span><span className="text-earth-800">${totalPrice.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-earth-500">Shipping</span><span className="text-brand-600 font-medium">Free</span></div>
              <div className="border-t border-earth-200 pt-3">
                <div className="flex justify-between font-bold text-earth-900">
                  <span>Total</span><span className="text-lg">${totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <button onClick={handleCheckout} disabled={isCheckingOut || purchased}
              className="w-full bg-brand-600 text-white py-4 rounded-full text-sm font-bold uppercase tracking-wider hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
              {isCheckingOut ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : purchased ? <><Check className="w-4 h-4" /> Ordered</> : <>Checkout <ArrowRight className="w-4 h-4" /></>}
            </button>
            <Link to="/shop" className="block text-center text-xs text-earth-400 hover:text-earth-600 underline underline-offset-2 mt-4">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
