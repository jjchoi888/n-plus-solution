"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MainPortal = dynamic(() => import('./MainPortal'), { ssr: false });
const HotelWebsite = dynamic(() => import('./HotelWebsite'), { ssr: false });
const PortalAdmin = dynamic(() => import('./PortalAdmin'), { ssr: false });
// 💡 1. 신규 마이페이지 컴포넌트 등록
const MemberDashboard = dynamic(() => import('./MemberDashboard'), { ssr: false });

export default function DomainRouter({ initialHotel }) {
  const [view, setView] = useState(null);
  const [targetHotel, setTargetHotel] = useState(null);

  useEffect(() => {
    const host = window.location.hostname;
    const pathname = window.location.pathname; // 💡 현재 경로 확인용 (/member 등)
    const params = new URLSearchParams(window.location.search);
    const hotelParam = params.get('hotel');

    const isMainPortal = host === 'hotelnplus.com' || host === 'www.hotelnplus.com';
    const isSystemSubdomain = host.startsWith('app.') || host.startsWith('manage.');
    const isHQ = host === 'hq.hotelnplus.com' || host.startsWith('hq.localhost');

    // 💡 2. 마이페이지 진입 조건 확인 (/member 경로로 들어왔을 때)
    if (pathname === '/member') {
      setView('MEMBER');
      setTargetHotel(hotelParam || null); // ?hotel=A001 이 있으면 해당 호텔 모드로 작동
      return;
    }

    if (isHQ) {
      setView('HQ');
      setTargetHotel(null);
      localStorage.removeItem('hotelCode');
    }
    else if (hotelParam || initialHotel || (!isMainPortal && !isSystemSubdomain && host !== 'localhost')) {
      const matchedHotel = hotelParam || initialHotel || host.split('.')[0];
      setView('HOTEL');
      setTargetHotel(matchedHotel);
      localStorage.setItem('hotelCode', matchedHotel);
    }
    else {
      setView('PORTAL');
      setTargetHotel(null);
      localStorage.removeItem('hotelCode');
    }
  }, [initialHotel]);

  if (!view) return <div className="min-h-screen bg-white" />;

  // 💡 3. 화면 분기 렌더링
  if (view === 'MEMBER') {
    return <MemberDashboard hotelCode={targetHotel} />;
  } else if (view === 'HQ') {
    return <PortalAdmin />;
  } else if (view === 'HOTEL') {
    return <HotelWebsite domain={targetHotel} />;
  } else {
    return <MainPortal />;
  }
}