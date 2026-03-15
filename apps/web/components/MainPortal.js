"use client";
import { useState, useEffect } from "react";
import Navbar from "./Navbar";
import BookingBar from "./BookingBar";
import RoomList from "./RoomList";

// 💡 1. 메인 대문(Hero)에 부드럽게 전환될 고화질 호텔 배경 이미지들
const heroImages = [
  "https://images.unsplash.com/photo-1542314831-c6a4d27a658d?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=2000"
];

// 💡 2. Our Destinations 에 들어갈 각 지점별 대표 사진과 설명
const destinations = [
  { code: "NPLUS01", name: "Metro Manila", img: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&q=80&w=800", desc: "Urban luxury in the heart of the city" },
  { code: "NPLUS02", name: "Seoul", img: "https://images.unsplash.com/photo-1538626606363-47201e74bf0e?auto=format&fit=crop&q=80&w=800", desc: "Modern elegance meets tradition" },
  { code: "NPLUS03", name: "Busan", img: "https://images.unsplash.com/photo-1620800720456-11f84dfcc021?auto=format&fit=crop&q=80&w=800", desc: "Oceanfront relaxation and style" },
  { code: "CEBU", name: "Cebu", img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&q=80&w=800", desc: "Tropical paradise getaway" }
];

export default function MainPortal() {
  const [lang, setLang] = useState("en"); 
  const [searchData, setSearchData] = useState(null); 
  const [currentSlide, setCurrentSlide] = useState(0);

  // 배경 이미지 자동 슬라이드 타이머
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-start overflow-x-hidden font-sans">
      <Navbar currentLang={lang} setLang={setLang} />

      {/* 🌟 1. Hero Section (메인 배경 슬라이드) */}
      <section className="relative w-full h-[65vh] md:h-[75vh] flex flex-col items-center justify-center mt-[72px]">
        {/* 슬라이더 배경 */}
        {heroImages.map((img, idx) => (
          <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? "opacity-100 z-0" : "opacity-0 z-0"}`}>
            <img src={img} alt="Hotel View" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40"></div> {/* 어두운 오버레이로 글씨가 잘 보이게 */}
          </div>
        ))}

        {/* 메인 텍스트 */}
        <div className="relative z-10 text-center px-4 max-w-4xl transform -translate-y-8 animate-fade-in-up">
          <h2 className="text-emerald-400 font-bold tracking-[0.25em] text-xs md:text-sm mb-4 uppercase drop-shadow-md">
            n+ HOTEL SOLUTION
          </h2>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif text-white leading-tight mb-6 drop-shadow-2xl">
            More Than Just a Stay
          </h1>
          <p className="text-lg md:text-xl text-slate-200 mb-10 leading-relaxed font-light drop-shadow max-w-2xl mx-auto">
            Experience world-class hospitality seamlessly integrated with our advanced PMS technology.
          </p>
        </div>

        {/* 💡 예약 검색바 (Hero 박스 하단에 반쯤 걸쳐서 고급스럽게 렌더링) */}
        <div className="absolute -bottom-10 md:-bottom-14 w-full max-w-6xl px-4 z-[60]">
           {/* 유리 질감(Glassmorphism) 효과 적용 */}
           <div className="shadow-2xl rounded-3xl backdrop-blur-md bg-white/20 p-1 md:p-2 border border-white/30">
             <BookingBar lang={lang} onSearchResults={setSearchData} />
           </div>
        </div>
      </section>

      {/* 🌟 2. 객실 검색 결과 (검색 버튼을 눌렀을 때만 나타남) */}
      {searchData && (
        <section className="w-full max-w-6xl mx-auto mt-28 px-4 animate-fade-in-up relative z-10 pb-20">
           <h3 className="text-2xl font-black text-slate-800 mb-6 border-b border-slate-200 pb-3 flex items-center gap-2">
             <span className="text-emerald-600">📍</span> Search Results
           </h3>
           <RoomList 
              hotelCode={searchData.destination} 
              lang={lang} 
              checkIn={searchData.checkIn} 
              checkOut={searchData.checkOut} 
              adults={searchData.adults} 
              kids={searchData.kids} 
           />
        </section>
      )}

      {/* 🌟 3. Our Destinations 갤러리 (검색 전, 평상시에만 보여서 시선 분산 방지) */}
      {!searchData && (
        <section className="w-full max-w-7xl mx-auto mt-32 mb-32 px-6 animate-fade-in">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-4">Our Destinations</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
              Explore our collection of exceptional properties across prime locations. Whether for business or leisure, find your perfect escape.
            </p>
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
      )}
    </main>
  );
}