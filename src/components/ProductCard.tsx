import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

interface Product {
  id: number;
  pname: string;
  sellingprice: number;
  netprice?: number;
  category: string;
  severity: string;
  image: string;
  brand?: string;
  product_type?: string;
}

const severityDot: Record<string, string> = {
  'Regular': 'bg-emerald-500',
  'High Severity': 'bg-red-500',
  'Improver': 'bg-amber-500',
};

const ProductCard: React.FC<{ product: Product; recommendationReason?: string; onDismiss?: (productId: number) => void }> = ({ product, recommendationReason, onDismiss }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { show } = useToast();

  const discount = product.netprice && product.netprice < product.sellingprice
    ? Math.round(((product.sellingprice - product.netprice) / product.sellingprice) * 100)
    : 0;

  const trackClick = () => {
    if (recommendationReason && user?.id) {
      fetch('/api/reco-tracking/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: user.id, product_id: product.id }),
      }).catch(() => {});
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.id) {
      fetch('/api/reco-tracking/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: user.id, product_id: product.id }),
      }).catch(() => {});
    }
    onDismiss?.(product.id);
    show('Recommendation dismissed', 'success');
  };

  return (
    <div className="group">
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-earth-200 mb-3">
        <Link to={`/product/${product.id}`} onClick={trackClick}>
          <img
            src={product.image}
            alt={product.pname}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </Link>

        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-earth-900 text-white text-[10px] font-bold px-2 py-1 rounded-sm">
            -{discount}%
          </span>
        )}

        {recommendationReason && onDismiss && (
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 w-7 h-7 bg-white/80 backdrop-blur rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500"
            aria-label="Not interested"
            title="Not interested"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={(e) => { e.preventDefault(); addToCart(product); show(`${product.pname} added to cart`, 'cart'); }}
          className="absolute bottom-3 right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-brand-600 hover:text-white"
          aria-label="Add to cart"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Info */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`w-1.5 h-1.5 rounded-full ${severityDot[product.severity] || 'bg-earth-400'}`} />
          {product.brand && (
            <span className="text-[10px] uppercase tracking-[0.12em] text-brand-700 font-semibold">{product.brand}</span>
          )}
          {product.product_type && (
            <>
              <span className="text-[9px] text-earth-300">&bull;</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-earth-400 font-medium">{product.product_type}</span>
            </>
          )}
        </div>
        <Link to={`/product/${product.id}`} onClick={trackClick}>
          <h3 className="text-sm font-medium text-earth-800 leading-snug group-hover:underline underline-offset-2 decoration-earth-300">
            {product.pname}
          </h3>
        </Link>
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-sm font-semibold text-earth-900">${product.netprice ?? product.sellingprice}</span>
          {discount > 0 && (
            <span className="text-xs text-earth-400 line-through">${product.sellingprice}</span>
          )}
        </div>
        {recommendationReason && (
          <p className="text-[11px] text-brand-700 leading-relaxed line-clamp-2 pt-1 border-t border-earth-100 mt-1.5">{recommendationReason}</p>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
