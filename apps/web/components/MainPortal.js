"use client";
import { useState, useEffect } from "react";
import Navbar from "./Navbar";
import BookingBar from "./BookingBar";
import RoomList from "./RoomList";

// 💡 1. 메인 대문(Hero) 배경 이미지
const heroImages = [
  "https://images.unsplash.com/photo-1542314831-c6a4d27a658d?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=2000"
];

// 💡 2. Our Destinations 지점 데이터
const destinations = [
  { code: "NPLUS01", name: "Metro Manila", img: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&q=80&w=800", desc: "Urban luxury in the heart of the city" },
  { code: "NPLUS02", name: "Seoul", img: "https://images.unsplash.com/photo-1538626606363-47201e74bf0e?auto=format&fit=crop&q=80&w=800", desc: "Modern elegance meets tradition" },
  { code: "NPLUS03", name: "Busan", img: "https://images.unsplash.com/photo-1620800720456-11f84dfcc021?auto=format&fit=crop&q=80&w=800", desc: "Oceanfront relaxation and style" },
  { code: "CEBU", name: "Cebu", img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&q=80&w=800", desc: "Tropical paradise getaway" }
];

// 💡 3. Special Offers 프로모션 데이터
const offers = [
  { title: "Early Bird Escape", desc: "Book 14 days in advance and enjoy up to 20% off your stay with complimentary breakfast.", tag: "SAVE 20%", img: "https://images.unsplash.com/photo-1551882547-ff40c0d13c84?auto=format&fit=crop&q=80&w=800" },
  { title: "Romantic Getaway", desc: "Spark romance with sparkling wine, in-room dining, and late check-out.", tag: "COUPLES", img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=800" },
  { title: "Long Stay Advantage", desc: "Stay 5 nights or more and receive exclusive dining credits and lounge access.", tag: "EXTENDED", img: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&q=80&w=800" }
];

// 💡 4. n+ Experience 브랜드 특징 데이터
const experiences = [
  { icon: "📱", title: "Smart Check-in", desc: "Seamless mobile key and contactless arrival via our PMS." },
  { icon: "🍽️", title: "World-Class Dining", desc: "Culinary excellence from award-winning global chefs." },
  { icon: "💆‍♀️", title: "Signature Spa", desc: "Rejuvenate your senses with bespoke holistic treatments." },
  { icon: "💎", title: "n+ Rewards", desc: "Earn points and unlock exclusive member-only benefits." }
];

export default function MainPortal() {
  const [lang, setLang] = useState("en"); 
  const [searchData, setSearchData] = useState(null); 
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-start overflow-x-hidden font-sans">
      <Navbar currentLang={lang} setLang={setLang} />

      {/* 🌟 1. Hero Section */}
      <section className="relative w-full h-[65vh] md:h-[75vh] flex flex-col items-center justify-center mt-[72px]">
        {heroImages.map((img, idx) => (
          <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? "opacity-100 z-0" : "opacity-0 z-0"}`}>
            <img src={img} alt="Hotel View" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
        ))}
        <div className="relative z-10 text-center px-4 max-w-4xl transform -translate-y-8 animate-fade-in-up">
          <h2 className="text-emerald-400 font-bold tracking-[0.25em] text-xs md:text-sm mb-4 uppercase drop-shadow-md">n+ HOTEL SOLUTION</h2>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif text-white leading-tight mb-6 drop-shadow-2xl">More Than Just a Stay</h1>
          <p className="text-lg md:text-xl text-slate-200 mb-10 leading-relaxed font-light drop-shadow max-w-2xl mx-auto">Experience world-class hospitality seamlessly integrated with our advanced PMS technology.</p>
        </div>
        <div className="absolute -bottom-10 md:-bottom-14 w-full max-w-6xl px-4 z-[60]">
           <div className="shadow-2xl rounded-3xl backdrop-blur-md bg-white/20 p-1 md:p-2 border border-white/30">
             <BookingBar lang={lang} onSearchResults={setSearchData} />
           </div>
        </div>
      </section>

      {/* 🌟 검색 결과 (검색 시 홍보 섹션 숨김) */}
      {searchData ? (
        <section className="w-full max-w-6xl mx-auto mt-28 px-4 animate-fade-in-up relative z-10 pb-20 flex-grow">
           <h3 className="text-2xl font-black text-slate-800 mb-6 border-b border-slate-200 pb-3 flex items-center gap-2">
             <span className="text-emerald-600">📍</span> Search Results
           </h3>
           <RoomList hotelCode={searchData.destination} lang={lang} checkIn={searchData.checkIn} checkOut={searchData.checkOut} adults={searchData.adults} kids={searchData.kids} />
        </section>
      ) : (
        <div className="w-full flex-grow flex flex-col items-center">
          {/* 🌟 2. Our Destinations */}
          <section className="w-full max-w-7xl mx-auto mt-32 px-6 animate-fade-in-up">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-4 font-serif">Our Destinations</h2>
              <p className="text-slate-500 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">Explore our collection of exceptional properties across prime locations. Whether for business or leisure, find your perfect escape.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {destinations.map((dest, idx) => (
                <div key={idx} className="group relative h-[400px] rounded-3xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
                  <img src={dest.img} alt={dest.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute bottom-0 left-0 w-full p-6 text-white transform transition-transform duration-300">
                    <p className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase mb-2">Hotel & Resort</p>
                    <h3 className="text-2xl font-black mb-2">{dest.name}</h3>
                    <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-300">
                       <p className="text-sm text-slate-300 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">{dest.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 🌟 3. Special Offers */}
          <section className="w-full bg-white mt-24 py-24 px-6 border-t border-slate-100 animate-fade-in-up">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
                <div>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-4 font-serif">Special Offers</h2>
                  <p className="text-slate-500 max-w-xl text-sm md:text-base leading-relaxed">Elevate your stay with our curated packages and exclusive promotions designed for unforgettable moments.</p>
                </div>
                <button className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors uppercase tracking-widest text-sm border-b-2 border-emerald-600 pb-1">View All Offers</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {offers.map((offer, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-3xl overflow-hidden group cursor-pointer border border-slate-100 hover:shadow-xl transition-all duration-300">
                    <div className="h-48 overflow-hidden relative">
                      <img src={offer.img} alt={offer.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute top-4 left-4 bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{offer.tag}</div>
                    </div>
                    <div className="p-8">
                      <h3 className="text-xl font-black text-slate-800 mb-3 group-hover:text-emerald-600 transition-colors">{offer.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed mb-6">{offer.desc}</p>
                      <button className="text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors flex items-center gap-2">Learn More <span>→</span></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 🌟 4. The n+ Experience */}
          <section className="w-full bg-slate-900 text-white py-24 px-6 animate-fade-in-up">
            <div className="max-w-7xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-black mb-4 font-serif">The n+ Experience</h2>
              <p className="text-slate-400 max-w-2xl mx-auto mb-16 text-sm md:text-base leading-relaxed">Discover a new standard of hospitality where innovative technology meets personalized luxury.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                {experiences.map((exp, idx) => (
                  <div key={idx} className="flex flex-col items-center group">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-3xl mb-6 group-hover:bg-emerald-600 group-hover:-translate-y-2 transition-all duration-300 shadow-lg">
                      {exp.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3">{exp.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{exp.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 🌟 5. Global Footer */}
      <footer className="w-full bg-slate-950 text-slate-400 py-16 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-black text-white mb-6 tracking-widest uppercase">n+ HOTEL</h2>
            <p className="text-sm leading-relaxed mb-6">Redefining modern hospitality with state-of-the-art property management and unforgettable guest experiences globally.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Destinations</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Metro Manila, PH</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Cebu, PH</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Seoul, KR</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Busan, KR</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Press & Media</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Contact Us</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Newsletter</h4>
            <p className="text-sm mb-4">Subscribe to receive exclusive offers and updates.</p>
            <div className="flex">
              <input type="email" placeholder="Email address" className="bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-l-lg w-full outline-none focus:border-emerald-500 text-sm" />
              <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-r-lg font-bold transition-colors text-sm">Join</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <p>&copy; {new Date().getFullYear()} n+ HOTEL SOLUTION. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
          </div>
        </div>
      </footer>
    </main>
  );
}