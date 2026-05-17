import { Heart, Globe, ShieldCheck } from 'lucide-react';

const About = () => {
  return (
    <div>
      {/* Hero — full-width image with overlay text */}
      <section className="relative h-[60vh] min-h-[400px] flex items-end overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=1600&auto=format&fit=crop"
          alt="Our process"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-earth-950 via-earth-950/40 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 pb-12 relative z-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-400 mb-4 block">About Us</span>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif font-bold text-white leading-tight">Our Story</h1>
        </div>
      </section>

      {/* Story — asymmetric layout */}
      <section className="container mx-auto px-4 sm:px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          <div className="lg:col-span-5">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-earth-400 block mb-3">Our Mission</span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-earth-900 mb-6 leading-tight">
              Purity Without Compromise
            </h2>
          </div>
          <div className="lg:col-span-7 space-y-6">
            <p className="text-earth-600 leading-relaxed text-lg">
              At Verdant, we believe that what you put on your body is just as important as what you put in it. Every ingredient is sourced from certified organic farms that respect biodiversity.
            </p>
            <p className="text-earth-600 leading-relaxed text-lg">
              Our laboratory combines traditional herbal wisdom with modern dermatological science to create formulas that are effective, safe, and entirely free from synthetic chemicals.
            </p>
            <p className="text-earth-600 leading-relaxed text-lg">
              What sets us apart is our intelligent recommendation engine — analyzing your purchase patterns to suggest the perfect products for your unique needs.
            </p>
          </div>
        </div>
      </section>

      {/* Numbers strip */}
      <section className="border-y border-earth-200">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-earth-200">
            {[
              { num: '17+', label: 'Products' },
              { num: '100%', label: 'Organic' },
              { num: '0', label: 'Chemicals' },
              { num: '7', label: 'Rec Rules' },
            ].map(s => (
              <div key={s.label} className="py-10 px-6 text-center">
                <p className="text-4xl font-serif font-bold text-earth-900 mb-1">{s.num}</p>
                <p className="text-xs uppercase tracking-[0.15em] text-earth-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="container mx-auto px-4 sm:px-6 py-20">
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-earth-400 block mb-3">What We Stand For</span>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-earth-900">Our Values</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-earth-200">
          {[
            { icon: <Heart className="w-6 h-6" />, title: 'Kindness', desc: 'Cruelty-free products that never test on animals. Beauty without suffering.' },
            { icon: <ShieldCheck className="w-6 h-6" />, title: 'Transparency', desc: 'Full ingredient disclosure on every product. You deserve to know what touches your skin.' },
            { icon: <Globe className="w-6 h-6" />, title: 'Planet First', desc: 'Carbon-neutral shipping and plastic-free packaging. Our planet commitment is unwavering.' },
          ].map(v => (
            <div key={v.title} className="bg-white p-10 lg:p-12">
              <div className="text-earth-400 mb-6">{v.icon}</div>
              <h3 className="text-xl font-serif font-bold text-earth-900 mb-3">{v.title}</h3>
              <p className="text-sm text-earth-500 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default About;
