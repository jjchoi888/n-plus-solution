"use client";
import { useState, useEffect } from "react";
import Navbar from "./Navbar";
import BookingBar from "./BookingBar";
import RoomList from "./RoomList";

const heroImages = [
  "https://images.unsplash.com/photo-1556761175-5973dc0f32b7?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1551882547-ff40c0d13c84?auto=format&fit=crop&q=80&w=2000"
];

const partnerHotels = [
  { code: "NPLUS01", name: "Metro Manila Hotel", img: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&q=80&w=800", desc: "Powered by n+ Smart PMS" },
  { code: "NPLUS02", name: "Seoul Boutique", img: "https://images.unsplash.com/photo-1538626606363-47201e74bf0e?auto=format&fit=crop&q=80&w=800", desc: "Powered by n+ Kiosk" },
  { code: "NPLUS03", name: "Busan Ocean Resort", img: "https://images.unsplash.com/photo-1620800720456-11f84dfcc021?auto=format&fit=crop&q=80&w=800", desc: "Powered by n+ Channel Manager" },
  { code: "CEBU", name: "Cebu Tropical", img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&q=80&w=800", desc: "Powered by n+ Direct Booking" }
];

const saasFeatures = [
  { icon: "☁️", title: "Cloud-based PMS", desc: "Manage your property anywhere, anytime with our lightning-fast cloud architecture." },
  { icon: "🔄", title: "Channel Manager", desc: "Sync inventory across OTA platforms in real-time to prevent overbookings." },
  { icon: "💻", title: "Direct Booking Engine", desc: "Drive commission-free direct bookings through our integrated web portal." },
  { icon: "📊", title: "Smart Analytics", desc: "Make data-driven decisions with real-time revenue and occupancy reports." }
];

export default function MainPortal() {
  const [lang, setLang] = useState("en"); 
  const [searchData, setSearchData] = useState(null); 
  const [currentSlide, setCurrentSlide] = useState(0);
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-start overflow-x-hidden font-sans">
      <Navbar currentLang={lang} setLang={setLang} />

      {/* 🌟 1. SaaS Hero Section (모바일 겹침 현상 해결) */}
      <section className="relative w-full min-h-[75vh] md:min-h-[85vh] flex flex-col items-center justify-center mt-[72px] pb-16 md:pb-0 pt-10 md:pt-0">
        {heroImages.map((img, idx) => (
          <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? "opacity-100 z-0" : "opacity-0 z-0"}`}>
            <img src={img} alt="SaaS Background" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-900/60"></div>
          </div>
        ))}
        
        {/* 텍스트와 예약바가 자연스럽게 세로로 나열되도록 relative 플로우 사용 */}
        <div className="relative z-10 text-center px-4 max-w-5xl animate-fade-in-up mt-8 md:mt-0">
          <div className="inline-block bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold tracking-widest text-xs md:text-sm px-4 py-1.5 rounded-full mb-6">
            THE ALL-IN-ONE HOTEL SOFTWARE
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-6 drop-shadow-2xl tracking-tight">
            Empowering Hotels.<br/>Delighting Guests.
          </h1>
          <p className="text-lg md:text-xl text-slate-300 mb-8 md:mb-10 leading-relaxed font-light drop-shadow max-w-3xl mx-auto">
            n+ is a next-generation Cloud PMS designed to maximize hotel revenue and streamline operations. 
            <br className="hidden md:block"/>Guests can easily book our partner hotels directly below.
          </p>
        </div>

        {/* 💡 예약바 위치 조정: 화면 중간 바로 아래에 안정적으로 위치하도록 수정 */}
        <div className="relative z-[60] w-full max-w-6xl px-4 mt-6 md:mt-12 md:-mb-32">
           <div className="bg-white rounded-3xl md:rounded-[40px] shadow-2xl p-4 md:p-6 border border-slate-100 flex flex-col gap-4">
             <div className="flex justify-between items-center px-2">
                <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                  <span className="text-emerald-600">✨</span> Book with n+ Partner Hotels
                </h3>
                <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 md:px-3 py-1 rounded-full">Zero Commission</span>
             </div>
             <BookingBar lang={lang} onSearchResults={setSearchData} />
           </div>
        </div>
      </section>

      {searchData ? (
        <section className="w-full max-w-6xl mx-auto mt-20 md:mt-32 px-4 animate-fade-in-up relative z-10 pb-20 flex-grow">
           <h3 className="text-2xl font-black text-slate-800 mb-6 border-b border-slate-200 pb-3 flex items-center gap-2">
             <span className="text-emerald-600">📍</span> Search Results
           </h3>
           <RoomList hotelCode={searchData.destination} lang={lang} checkIn={searchData.checkIn} checkOut={searchData.checkOut} adults={searchData.adults} kids={searchData.kids} />
        </section>
      ) : (
        <div className="w-full flex-grow flex flex-col items-center">
          
          {/* 🌟 2. B2B 핵심: n+ SaaS Features (아이콘 중앙 정렬) */}
          <section className="w-full bg-white mt-20 md:mt-32 pt-24 pb-20 px-6 border-b border-slate-100 animate-fade-in-up">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">Why Hoteliers Choose n+</h2>
                <p className="text-slate-500 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
                  Our comprehensive suite of tools helps you reduce operational costs, increase direct bookings, and elevate the guest experience.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {saasFeatures.map((feat, idx) => (
                  // 💡 카드의 내용을 중앙으로 정렬 (flex-col, items-center, text-center 추가)
                  <div key={idx} className="bg-slate-50 p-8 rounded-3xl border border-slate-100 hover:border-emerald-200 hover:shadow-xl transition-all duration-300 group flex flex-col items-center text-center">
                    <div className="text-4xl mb-6 bg-white w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                      {feat.icon}
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-3 group-hover:text-emerald-600 transition-colors">{feat.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 🌟 3. 가맹 호텔 네트워크 */}
          <section className="w-full max-w-7xl mx-auto py-24 px-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
              <div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">Our Partner Network</h2>
                <p className="text-slate-500 max-w-xl text-sm md:text-base leading-relaxed">
                  Join hundreds of properties globally powered by n+. By joining our network, your hotel gains direct exposure to our unified booking portal.
                </p>
              </div>
              <button className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors uppercase tracking-widest text-sm border-b-2 border-emerald-600 pb-1">View All Partners</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {partnerHotels.map((dest, idx) => (
                <div 
                  key={idx} 
                  onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      setAlertMessage(`[ ${dest.name} ] is powered by n+ Hotel Solution.\nUse the booking bar above to find available rooms.`);
                  }}
                  className="group relative h-[350px] rounded-3xl overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-slate-200"
                >
                  <img src={dest.img} alt={dest.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute bottom-0 left-0 w-full p-6 text-white transform transition-transform duration-300">
                    <p className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase mb-2">Partner Hotel</p>
                    <h3 className="text-xl font-black mb-2">{dest.name}</h3>
                    <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-300">
                       <p className="text-xs text-slate-300 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 border-t border-white/20 pt-2 flex items-center gap-2">
                         <span>⚡</span> {dest.desc}
                       </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 🌟 4. B2B CTA */}
          <section className="w-full bg-emerald-600 py-20 px-6 mt-10">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-6 tracking-tight">Ready to Transform Your Hotel?</h2>
              <p className="text-emerald-100 text-lg mb-10 max-w-2xl mx-auto">
                Stop paying high OTA commissions. Empower your staff and delight your guests with the ultimate Cloud PMS.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button onClick={() => setAlertMessage("Thank you for your interest! Our sales team will contact you shortly.")} className="bg-white text-emerald-700 font-black px-8 py-4 rounded-full shadow-lg hover:bg-slate-50 transition-transform active:scale-95 text-lg">
                  Request a Demo
                </button>
                <button onClick={() => setAlertMessage("Partner login portal will be available soon.")} className="bg-emerald-700 text-white border border-emerald-500 font-bold px-8 py-4 rounded-full hover:bg-emerald-800 transition-colors text-lg">
                  Partner Login
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 🌟 5. B2B SaaS Footer */}
      <footer className="w-full bg-slate-950 text-slate-400 py-16 px-6 border-t border-slate-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-black text-white mb-6 tracking-widest uppercase">n+ SaaS</h2>
            <p className="text-sm leading-relaxed mb-6">The operating system for modern hoteliers. Streamline operations, boost direct bookings, and maximize revenue globally.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Solutions</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Cloud PMS</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Channel Manager</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Direct Booking Engine</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Smart Kiosk API</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">About n+</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Partner Hotels</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Contact Sales</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Stay Updated</h4>
            <p className="text-sm mb-4">Get the latest hospitality tech news.</p>
            <div className="flex">
              <input type="email" placeholder="Work email" className="bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-l-lg w-full outline-none focus:border-emerald-500 text-sm" />
              <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-r-lg font-bold transition-colors text-sm">Join</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <p>&copy; {new Date().getFullYear()} n+ HOTEL SOLUTION. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Security</a>
          </div>
        </div>
      </footer>

      {/* 💡 전역 알림 모달 */}
      {alertMessage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setAlertMessage('')}>
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center border border-slate-100" onClick={e => e.stopPropagation()}>
                  <div className="bg-emerald-600 p-4 text-white flex justify-center items-center">
                      <h3 className="font-black text-lg">Notification</h3>
                  </div>
                  <div className="p-8 text-slate-700 font-bold text-[15px] whitespace-pre-wrap leading-relaxed">
                      {alertMessage}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                      <button onClick={() => setAlertMessage('')} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-black transition-transform active:scale-95 shadow-md">
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </main>
  );
}