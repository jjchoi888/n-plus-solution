"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MainPortal = dynamic(() => import('./MainPortal'), { ssr: false });
const HotelWebsite = dynamic(() => import('./HotelWebsite'), { ssr: false });

export default function DomainRouter({ initialHotel }) {
  const [view, setView] = useState(null); // 'PORTAL' 또는 'HOTEL'
  const [targetHotel, setTargetHotel] = useState(null);

  useEffect(() => {
    const host = window.location.hostname;
    const params = new URLSearchParams(window.location.search);
    const hotelParam = params.get('hotel');

    // 💡 [판별 로직 우선순위]
    // 1순위: URL 파라미터에 hotel=sample 등이 있는가? (테스트용)
    // 2순위: 도메인 주소 자체에 sample 등 호텔 키워드가 포함되어 있는가?
    if (hotelParam || initialHotel || host.includes('sample')) {
      const matchedHotel = hotelParam || initialHotel || 'sample';
      setView('HOTEL');
      setTargetHotel(matchedHotel);
      
      // 💡 [핵심 보강] 하위 컴포넌트(BookingBar 등)가 호텔 코드를 잃어버리지 않도록 
      // 최상위 라우터에서 로컬 스토리지에 확실하게 박제해 줍니다!
      localStorage.setItem('hotelCode', matchedHotel);
    } 
    // 3순위: 그 외 (localhost나 vcl 주소 기본 접속)
    else {
      setView('PORTAL');
      setTargetHotel(null);
      
      // 💡 [핵심 보강] 포털(메인)로 접속 시 엉뚱한 호텔 코드가 남아있지 않도록 청소
      localStorage.removeItem('hotelCode');
    }
  }, [initialHotel]);

  // 로딩 중 깜빡임 방지
  if (!view) return <div className="min-h-screen bg-white" />;

  // 💡 결정된 뷰에 따라 컴포넌트 렌더링
  if (view === 'HOTEL') {
    return <HotelWebsite domain={targetHotel} />;
  } else {
    return <MainPortal />;
  }
}