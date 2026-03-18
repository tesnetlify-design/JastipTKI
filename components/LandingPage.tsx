
import React, { useState, useEffect, useRef } from 'react';
import { SERVICES, TESTIMONIALS } from '../constants';
import { db } from '../firebase';
import { Testimonial } from '../types';
import { useAppConfig } from '../hooks/useAppConfig';
import { getTestimonialsCached, TESTIMONIAL_LANDING_LIMIT } from '../services/testimonialService';

interface LandingPageProps {
  onStart: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, isDarkMode, toggleDarkMode }) => {
  const [isStoryExpanded, setIsStoryExpanded] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [liveTestimonials, setLiveTestimonials] = useState<Testimonial[]>([]);
  const { config: appConfig } = useAppConfig();
  const imageSectionRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { name: 'Cerita Kami', id: 'cerita' },
    { name: 'Layanan', id: 'layanan' },
    { name: 'Ulasan', id: 'ulasan' }
  ];

  const LOGO_URL = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjmCTzDlM1UQDugbZX9g67GUOQk0OHE2_ZbdK_QPzUEzpd1rZ69mbau1aiMoymI41D5nm-OtRspMQlNRd4oBCIkq0GDxa2T8V8-s8B0H9ZGkKRFejZLSBSlRIklYOSxtZZYtKJ9xJd-VxJeqXfPTJjVbwGKFKeKXT2PLE4qUF6apRWV0Ijhu9FxGdaT2AXv/s1600/IMG_0119.jpeg";
  const HERO_IMAGE_URL = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiz1QTBCZ05Ba56HUH95z3HAXAS1JG0LWn6jERddrBKQ7aEyTOntm8aYaJKhH1a5ymzydjbkWmaZTOY1BMlqhAbjAnAKoc-YDbuHa_f5od6l6cUfsbgBpbYfPNn0_YPVdSgiJL534NZGvM_RBKNkMAVEY_wSfyQTHspl0NgFTr9ZQ3Lv_yYPiglhwNLWR_9/s1600/IMG_0121.jpeg";

  useEffect(() => {
    // Load testimonials dengan cache 24 jam (hemat quota)
    getTestimonialsCached((fetched) => {
      setLiveTestimonials(fetched.length > 0 ? fetched : TESTIMONIALS);
    });

    const handleScroll = () => {
      if (!imageSectionRef.current) return;
      const rect = imageSectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const centerPos = rect.top + rect.height / 2;
      const screenCenter = windowHeight / 2;
      const distanceFromCenter = centerPos - screenCenter;
      const speed = 0.03;
      const offset = Math.max(-20, Math.min(20, distanceFromCenter * speed));
      setScrollOffset(offset);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      return new Date(dateStr).toLocaleDateString('id-ID', options);
    } catch {
      return dateStr;
    }
  };

  const scrollToSection = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Hanya tampilkan 3 testimoni di landing page
  const displayTestimonials = (liveTestimonials.length > 0 ? liveTestimonials : TESTIMONIALS).slice(0, TESTIMONIAL_LANDING_LIMIT);

  return (
    <div className="bg-white dark:bg-slate-950 transition-colors duration-300 min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md z-[100] border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl overflow-hidden shadow-lg shadow-blue-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
              <img src={LOGO_URL} alt="JastipTKI Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-xl md:text-2xl text-slate-900 dark:text-white tracking-tight">JastipTKI</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-400">
            {navLinks.map((link) => (
              <a 
                key={link.id} 
                href={`#${link.id}`}
                onClick={(e) => scrollToSection(e, link.id)}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={toggleDarkMode}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle dark mode"
            >
              <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button 
              onClick={onStart}
              className="bg-blue-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-full font-bold text-xs md:text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              Masuk / Daftar
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-10 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-20 right-10 w-72 h-72 bg-emerald-400 rounded-full blur-[120px]"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
          <span className="inline-block px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-bold mb-6 border border-blue-100 dark:border-blue-800">
            #1 Solusi Pengiriman TKI
          </span>
          <h1 className="text-4xl md:text-7xl font-extrabold text-slate-900 dark:text-white leading-[1.1] mb-8 tracking-tight">
            Membawa <span className="gradient-text">Hangatnya Indonesia</span> Ke Genggaman Anda.
          </h1>
          <p className="text-lg md:text-2xl text-slate-600 dark:text-slate-400 mb-12 leading-relaxed font-medium">
            Bukan sekadar jasa titip, kami adalah jembatan rindu bagi Anda yang berjuang di negeri orang. Kirim rasa sayang, terima kebahagiaan.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center">
            <button 
              onClick={onStart}
              className="px-8 md:px-10 py-4 md:py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg md:text-xl hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all transform hover:-translate-y-1 active:scale-95"
            >
              Coba Jastip Sekarang
            </button>
            <a 
              href="#cerita"
              onClick={(e) => scrollToSection(e, 'cerita')}
              className="px-8 md:px-10 py-4 md:py-5 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-lg md:text-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              Baca Cerita Kami <i className="fas fa-arrow-down text-sm"></i>
            </a>
          </div>
        </div>
      </section>

      {/* Cerita Kami */}
      <section id="cerita" className="py-24 bg-white dark:bg-slate-950 transition-colors duration-300 scroll-mt-24 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12 space-y-6 animate-fade-in-up">
            <div className="inline-block p-1">
              <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tighter">
                Mengapa Kami Memulai JastipTKI?
              </h2>
              <div className="w-20 h-1.5 bg-blue-600 mx-auto rounded-full mt-4"></div>
            </div>
            
            <div className="max-w-3xl mx-auto space-y-4">
              <p className="text-lg md:text-xl text-slate-700 dark:text-slate-300 font-bold leading-relaxed">
                Semua berawal dari sebuah kerinduan sederhana yang kami temui di setiap sudut mess pekerja migran.
              </p>
              <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium italic">
                "Andai saja saya bisa mencicipi sambal buatan ibu di rumah saat ini juga." Kalimat itu terus membekas di hati kami. Kami melihat ribuan pahlawan devisa berjuang keras jauh dari tanah air, namun seringkali kesulitan untuk sekadar merasakan barang dari rumah.
              </p>
            </div>
          </div>
          
          <div ref={imageSectionRef} className="relative mb-16">
             <div 
               className="relative group max-w-4xl mx-auto transition-all duration-700 ease-out will-change-transform"
               style={{ transform: `translateY(${scrollOffset}px)` }}
             >
                <div className="absolute -inset-6 bg-blue-600/5 rounded-[3rem] blur-2xl group-hover:bg-blue-600/15 transition-all duration-1000"></div>
                
                <div className="relative rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-soft-xl border-4 md:border-[10px] border-white dark:border-slate-800 animate-slow-pulse z-20">
                   <img 
                    src={HERO_IMAGE_URL} 
                    alt="JastipTKI Story Background" 
                    className="w-full aspect-video object-cover transition-transform duration-1000 group-hover:scale-105" 
                   />
                </div>
                
                <div className="absolute -bottom-6 -right-2 md:-right-8 bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 animate-floating z-30 hidden sm:block">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200">
                         <i className="fas fa-heart"></i>
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kirim Dengan</p>
                         <p className="text-lg font-black text-slate-900 dark:text-white">Penuh Cinta</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className={`overflow-hidden transition-all duration-1000 ease-in-out ${isStoryExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 lg:max-h-none opacity-0 lg:opacity-100'}`}>
            <div className="grid md:grid-cols-2 gap-8 items-stretch animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
               <div className="p-8 md:p-10 bg-blue-50 dark:bg-blue-900/20 rounded-[2.5rem] border border-blue-100 dark:border-blue-800 flex flex-col justify-center">
                  <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-3">
                     <i className="fas fa-hands-holding-heart"></i> Misi Sosial Kami
                  </h3>
                  <p className="text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    JastipTKI hadir untuk merobohkan batasan jarak. Kami percaya bahwa geografis tidak seharusnya menjadi penghalang bagi kebahagiaan sederhana dari rumah. Kami menghubungkan Anda kembali dengan akar Indonesia melalui logistik yang murah, aman, dan transparan.
                  </p>
               </div>

               <div className="p-8 md:p-10 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-center">
                  <div className="relative z-10 space-y-4">
                    <p className="text-lg font-bold italic leading-relaxed text-blue-50">
                      "Bagi kami, setiap paket yang kami antar bukan sekadar barang logistik, melainkan 'surat cinta' dari rumah yang memberikan kekuatan bagi Anda."
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-0.5 bg-blue-500 rounded-full"></div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Tim JastipTKI — Melayani Sepenuh Hati</p>
                    </div>
                  </div>
                  <i className="fas fa-quote-right absolute -bottom-10 -right-10 text-white/5 text-[12rem] pointer-events-none"></i>
               </div>
            </div>
          </div>

          <div className="mt-12 text-center lg:hidden">
            <button 
              onClick={() => setIsStoryExpanded(!isStoryExpanded)}
              className="flex items-center gap-3 mx-auto px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl"
            >
              {isStoryExpanded ? 'Tampilkan Lebih Sedikit' : 'Baca Visi Selengkapnya'}
              <i className={`fas ${isStoryExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} transition-transform duration-300`}></i>
            </button>
          </div>
        </div>
      </section>

      {/* Layanan */}
      <section id="layanan" className="py-24 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800 transition-colors duration-300 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight">Layanan Yang Kami Tawarkan</h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium">Dirancang untuk memudahkan segala urusan belanja dan kirim dari Indonesia.</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12">
            {SERVICES.map((service) => (
              <div key={service.id} className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-xl shadow-slate-200/50 dark:shadow-none group relative overflow-hidden">
                <div className={`w-20 h-20 ${service.color} text-white rounded-3xl flex items-center justify-center text-3xl mb-8 shadow-xl shadow-slate-200 dark:shadow-none relative z-10 group-hover:scale-110 transition-transform duration-500`}>
                  <i className={`fas ${service.icon}`}></i>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 relative z-10">{service.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-8 relative z-10 font-medium">{service.description}</p>
                <div className="space-y-3 mb-8 relative z-10">
                  {service.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
                      <i className="fas fa-check-circle text-blue-500"></i>
                      {feature}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800 relative z-10">
                  <span className="font-bold text-slate-900 dark:text-white">{service.priceTag}</span>
                  <button onClick={onStart} className="text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
                    Pesan Sekarang <i className="fas fa-arrow-right text-[10px]"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ulasan */}
      <section id="ulasan" className="py-24 bg-white dark:bg-slate-950 transition-colors duration-300 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight">Suara Pahlawan Devisa</h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 font-medium">Kepercayaan Anda adalah amanah bagi kami.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {displayTestimonials.map((t) => (
              <div key={t.id} className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                <div className="flex gap-1 text-yellow-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <i key={i} className={`fas fa-star ${i < t.rating ? 'opacity-100' : 'opacity-20'}`}></i>
                  ))}
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-medium mb-6 italic leading-relaxed">"{t.message}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-black text-xs">{t.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{t.name}</h4>
                    <div className="flex flex-col mt-0.5">
                      {t.date && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-tight">{formatDate(t.date)}</span>}
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">{t.location}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tombol Lihat Semua Testimoni → arahkan ke form daftar */}
          <div className="mt-14 text-center">
            <div className="inline-flex flex-col items-center gap-4">
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                Masih banyak lagi ulasan dari ribuan pengguna kami 🌟
              </p>
              <button
                onClick={onStart}
                className="group relative inline-flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold text-base hover:bg-blue-700 shadow-2xl shadow-blue-200 dark:shadow-none transition-all transform hover:-translate-y-1 active:scale-95"
              >
                <i className="fas fa-star text-yellow-300"></i>
                Lihat Semua Ulasan
                <i className="fas fa-arrow-right text-sm group-hover:translate-x-1 transition-transform"></i>
              </button>
              <p className="text-[11px] text-slate-400 font-medium">
                Daftar gratis untuk melihat semua testimoni pengguna
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-800">
                <img src={LOGO_URL} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-bold text-2xl tracking-tight">JastipTKI</span>
            </div>
            <p className="text-slate-400 max-w-sm mb-8 font-medium">
              Membantu Pekerja Migran Indonesia terhubung kembali dengan rumah melalui layanan logistik yang aman, murah, dan terpercaya.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-blue-600 transition-all text-sm" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-blue-600 transition-all text-sm" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
              <a href={`https://wa.me/${appConfig?.adminWhatsApp || '6281299887766'}`} target="_blank" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-blue-600 transition-all text-sm" aria-label="WhatsApp"><i className="fab fa-whatsapp"></i></a>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest text-slate-500 mb-6">Tautan Cepat</h4>
            <ul className="space-y-4 text-slate-400 font-bold text-sm">
              <li><a href="#cerita" onClick={(e) => scrollToSection(e, 'cerita')} className="hover:text-white transition-colors">Cerita Kami</a></li>
              <li><a href="#layanan" onClick={(e) => scrollToSection(e, 'layanan')} className="hover:text-white transition-colors">Layanan</a></li>
              <li><a href="#ulasan" onClick={(e) => scrollToSection(e, 'ulasan')} className="hover:text-white transition-colors">Ulasan</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest text-slate-500 mb-6">Kontak Kami</h4>
            <ul className="space-y-4 text-slate-400 font-bold text-sm">
              <li className="flex items-center gap-3"><i className="fas fa-envelope text-blue-500"></i> {appConfig?.adminEmail || 'halo@jastiptki.com'}</li>
              <li className="flex items-center gap-3"><i className="fas fa-phone text-blue-500"></i> +{appConfig?.adminWhatsApp || '62 812 9988 7766'}</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-12 mt-12 border-t border-slate-900 text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest">
          <p>© 2024 JastipTKI. All rights reserved. Made with ❤️ for Pahlawan Devisa.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
