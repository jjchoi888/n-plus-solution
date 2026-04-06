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

    // 💡 [도메인 기반 판별 로직 고도화]
    // 1순위: URL 파라미터가 있는가? (테스트/딥링킹 용)
    // 2순위: 'app.hotelnplus.com' 또는 'manage.hotelnplus.com' 등이 아닌 '개별 호텔용 도메인'인가?

    const isMainPortal = host === 'hotelnplus.com' || host === 'www.hotelnplus.com';
    const isSystemSubdomain = host.startsWith('app.') || host.startsWith('manage.') || host.startsWith('hq.');

    if (hotelParam || initialHotel || (!isMainPortal && !isSystemSubdomain && host !== 'localhost')) {
      // 💡 개별 호텔 웹사이트로 판별된 경우
      const matchedHotel = hotelParam || initialHotel || host.split('.')[0]; // 예: 'sample'.hotelnplus.com 에서 sample 추출

      setView('HOTEL');
      setTargetHotel(matchedHotel);

      // 하위 컴포넌트 공유를 위해 로컬 스토리지 박제
      localStorage.setItem('hotelCode', matchedHotel);
      console.log(`🏨 [Router] Hotel Mode Active: ${matchedHotel}`);
    }
    else {
      // 💡 메인 포털(통합웹)로 판별된 경우
      setView('PORTAL');
      setTargetHotel(null);

      // 포털 접속 시에는 기존 호텔 코드 제거 (혼선 방지)
      localStorage.removeItem('hotelCode');
      console.log(`🌐 [Router] Main Portal Mode Active`);
    }
  }, [initialHotel]);

  // 로딩 중 깜빡임 방지
  if (!view) return <div className="min-h-screen bg-white" />;

  // 결정된 뷰에 따라 컴포넌트 렌더링
  if (view === 'HOTEL') {
    return <HotelWebsite domain={targetHotel} />;
  } else {
    return <MainPortal />;
  }
}