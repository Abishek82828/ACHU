import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-earth-900 text-brand-200">
      {/* Marquee */}
      <div className="border-b border-earth-800 overflow-hidden py-6">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-12 mx-6">
              {['ORGANIC', 'SUSTAINABLE', 'CRUELTY-FREE', 'ECO-FRIENDLY', 'CHEMICAL-FREE', 'HANDCRAFTED'].map((t, j) => (
                <span key={j} className="text-4xl font-serif font-bold text-earth-800 flex items-center gap-12">
                  {t} <span className="text-brand-400 text-lg">&bull;</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-16 mb-16">
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-2xl font-serif font-bold text-white mb-4">VERDANT</h3>
            <p className="text-sm text-earth-500 leading-relaxed">
              Pure organic personal care. Every product crafted with nature's finest.
            </p>
          </div>

          {[
            {
              title: 'Shop',
              links: [
                { to: '/shop', label: 'All Products' },
                { to: '/shop?category=Hair', label: 'Hair Care' },
                { to: '/shop?category=Face', label: 'Face Care' },
                { to: '/shop?category=Body', label: 'Body Care' },
                { to: '/shop?category=Oral', label: 'Oral Care' },
              ]
            },
            {
              title: 'Company',
              links: [
                { to: '/about', label: 'About Us' },
                { to: '/categories', label: 'Categories' },
                { to: '/contact', label: 'Contact' },
                { to: '/dashboard', label: 'Dashboard' },
              ]
            },
            {
              title: 'Help',
              links: [
                { to: '#', label: 'FAQ' },
                { to: '#', label: 'Shipping' },
                { to: '#', label: 'Returns' },
                { to: '#', label: 'Privacy' },
              ]
            }
          ].map(col => (
            <div key={col.title}>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-earth-500 mb-5">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map(l => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm text-earth-400 hover:text-white transition-colors inline-flex items-center gap-1 group">
                      {l.label}
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-earth-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-earth-600">&copy; 2026 Verdant Organic Care</p>
          <div className="flex gap-6 text-xs text-earth-600">
            <a href="#" className="hover:text-earth-400">Terms</a>
            <a href="#" className="hover:text-earth-400">Privacy</a>
            <a href="#" className="hover:text-earth-400">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
