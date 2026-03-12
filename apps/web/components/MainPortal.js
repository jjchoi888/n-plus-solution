"use client";
import { useState } from "react";
// 💡 위치가 components 폴더 안으로 이동했으므로 import 경로를 ./ 로 수정했습니다.
import Navbar from "./Navbar";
import BookingBar from "./BookingBar";
import RoomList from "./RoomList";

export default function MainPortal() {
  const [lang, setLang] = useState("en"); 
  const [searchData, setSearchData] = useState(null); 

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-start p-8 pt-32 overflow-x-hidden">
      <Navbar currentLang={lang} setLang={setLang} />
      
      <div className="fixed top-0 right-0 w-1/2 h-screen bg-emerald-light opacity-20 -z-10 skew-x-12" />

      <div className="text-center max-w-4xl w-full flex flex-col items-center animate-fade-in">
        <h2 className="text-emerald font-bold tracking-widest text-xl mb-4">
          n+ HOTEL SOLUTION
        </h2>
        
        <h1 className="text-5xl md:text-7xl font-serif text-gray-900 leading-tight mb-6">
          More Than Just a Stay
        </h1>
        
        <p className="text-xl text-gray-600 mb-10 leading-relaxed max-w-3xl">
          Experience world-class hospitality seamlessly integrated with our advanced PMS technology.
        </p>
        
        <BookingBar lang={lang} onSearchResults={setSearchData} />
      </div>

      <div className="w-full max-w-6xl mt-16 animate-slide-up">
        <RoomList lang={lang} searchData={searchData} />
      </div>
    </main>
  );
}