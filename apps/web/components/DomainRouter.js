"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MainPortal = dynamic(() => import('./MainPortal'), { ssr: false });
const HotelWebsite = dynamic(() => import('./HotelWebsite'), { ssr: false });
const PortalAdmin = dynamic(() => import('./PortalAdmin'), { ssr: false });

export default function DomainRouter({ initialHotel }) {
  const [view, setView] = useState(null);
  const [targetHotel, setTargetHotel] = useState(null);

  useEffect(() => {
    const host = window.location.hostname;
    const params = new URLSearchParams(window.location.search);
    const hotelParam = params.get('hotel');

    const isMainPortal = host === 'hotelnplus.com' || host === 'www.hotelnplus.com';
    const isSystemSubdomain = host.startsWith('app.') || host.startsWith('manage.');

    const isHQ = host === 'hq.hotelnplus.com' || host.startsWith('hq.localhost');

    if (isHQ) {
      setView('HQ');
      setTargetHotel(null);
      localStorage.removeItem('hotelCode');
      // 💡 Vercel 빌드 에러 방지를 위해 console.log 삭제됨
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

  if (view === 'HQ') {
    return <PortalAdmin />;
  } else if (view === 'HOTEL') {
    return <HotelWebsite domain={targetHotel} />;
  } else {
    return <MainPortal />;
  }
}