import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react';

const Contact = () => {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[70vh]">
        {/* Left — info */}
        <div className="bg-earth-900 text-white p-10 sm:p-14 lg:p-20 flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-400 mb-6">Contact</span>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-6 leading-tight">Get in<br />Touch</h1>
          <p className="text-earth-400 mb-12 max-w-sm leading-relaxed">
            Have questions about our products or your order? We're here to help on your organic journey.
          </p>

          <div className="space-y-8">
            {[
              { icon: <Mail className="w-4 h-4" />, title: 'Email', lines: ['hello@verdantcare.com', 'support@verdantcare.com'] },
              { icon: <Phone className="w-4 h-4" />, title: 'Phone', lines: ['+1 (555) 123-4567', 'Mon-Fri, 9am - 6pm EST'] },
              { icon: <MapPin className="w-4 h-4" />, title: 'Address', lines: ['123 Organic Way', 'Green Valley, CA 90210'] },
            ].map(item => (
              <div key={item.title} className="flex gap-4">
                <div className="text-earth-500 mt-0.5">{item.icon}</div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-earth-500 mb-1">{item.title}</p>
                  {item.lines.map((l, i) => <p key={i} className="text-sm text-earth-300">{l}</p>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="bg-white p-10 sm:p-14 lg:p-20 flex flex-col justify-center">
          <form className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-earth-500 font-semibold mb-2 block">Name</label>
                <input className="w-full h-12 px-4 border border-earth-200 text-sm focus:outline-none focus:border-earth-400 transition-colors" placeholder="John Doe" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-earth-500 font-semibold mb-2 block">Email</label>
                <input type="email" className="w-full h-12 px-4 border border-earth-200 text-sm focus:outline-none focus:border-earth-400 transition-colors" placeholder="john@example.com" />
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-earth-500 font-semibold mb-2 block">Subject</label>
              <input className="w-full h-12 px-4 border border-earth-200 text-sm focus:outline-none focus:border-earth-400 transition-colors" placeholder="How can we help?" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-earth-500 font-semibold mb-2 block">Message</label>
              <textarea
                className="w-full min-h-[140px] px-4 py-3 border border-earth-200 text-sm focus:outline-none focus:border-earth-400 transition-colors resize-none"
                placeholder="Tell us more..."
              />
            </div>
            <button type="button" className="w-full h-12 bg-earth-900 text-white text-sm font-semibold uppercase tracking-wider hover:bg-earth-800 transition-colors flex items-center justify-center gap-2 group">
              Send Message <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;
