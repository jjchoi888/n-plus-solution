"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MainPortal = dynamic(() => import('./MainPortal'), { ssr: false });
const HotelWebsite = dynamic(() => import('./HotelWebsite'), { ssr: false });
// 💡 [추가] 본사 포털(HQ) 컴포넌트를 불러옵니다.
const PortalAdmin = dynamic(() => import('./PortalAdmin'), { ssr: false });

export default function DomainRouter({ initialHotel }) {
  const [view, setView] = useState(null); // 'PORTAL', 'HOTEL', 또는 'HQ'
  const [targetHotel, setTargetHotel] = useState(null);

  useEffect(() => {
    const host = window.location.hostname;
    const params = new URLSearchParams(window.location.search);
    const hotelParam = params.get('hotel');

    const isMainPortal = host === 'hotelnplus.com' || host === 'www.hotelnplus.com';
    // 💡 hq는 별도로 뺄 것이므로 isSystemSubdomain에서 hq 조건은 제외합니다.
    const isSystemSubdomain = host.startsWith('app.') || host.startsWith('manage.');

    // 💡 [추가] HQ 도메인 감지 로직
    const isHQ = host === 'hq.hotelnplus.com' || host.startsWith('hq.localhost');

    if (isHQ) {
      // 💡 1. 본사 포털(HQ) 접속 시
      setView('HQ');
      setTargetHotel(null);
      localStorage.removeItem('hotelCode');
      console.log(`🏢 [Router] HQ Portal Mode Active`);
    }
    else if (hotelParam || initialHotel || (!isMainPortal && !isSystemSubdomain && host !== 'localhost')) {
      // 💡 2. 개별 호텔 웹사이트로 판별된 경우
      const matchedHotel = hotelParam || initialHotel || host.split('.')[0];

      setView('HOTEL');
      setTargetHotel(matchedHotel);

      // 하위 컴포넌트 공유를 위해 로컬 스토리지 박제
      localStorage.setItem('hotelCode', matchedHotel);
      console.log(`🏨 [Router] Hotel Mode Active: ${matchedHotel}`);
    }
    else {
      // 💡 3. 메인 포털(통합웹)로 판별된 경우
      setView('PORTAL');
      setTargetHotel(null);

      // 포털 접속 시에는 기존 호텔 코드 제거 (혼선 방지)
      localStorage.removeItem('hotelCode');
      console.log(`🌐 [Router] Main Portal Mode Active`);
    }
  }, [initialHotel]);

  // 로딩 중 깜빡임 방지
  if (!view) return <div className="min-h-screen bg-white" />;

  // 💡 결정된 뷰에 따라 컴포넌트 렌더링
  if (view === 'HQ') {
    return <PortalAdmin />;
  } else if (view === 'HOTEL') {
    return <HotelWebsite domain={targetHotel} />;
  } else {
    return <MainPortal />;
  }
}