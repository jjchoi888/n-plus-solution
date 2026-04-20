"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MainPortal = dynamic(() => import('./MainPortal'), { ssr: false });
const HotelWebsite = dynamic(() => import('./HotelWebsite'), { ssr: false });
const PortalAdmin = dynamic(() => import('./PortalAdmin'), { ssr: false });
// 💡 1. Register the new My Page (Member Dashboard) component
const MemberDashboard = dynamic(() => import('./MemberDashboard'), { ssr: false });

export default function DomainRouter({ initialHotel }) {
  const [view, setView] = useState(null);
  const [targetHotel, setTargetHotel] = useState(null);

  useEffect(() => {
    const host = window.location.hostname;
    const pathname = window.location.pathname; // 💡 Check current path (e.g., /member)
    const params = new URLSearchParams(window.location.search);
    const hotelParam = params.get('hotel');

    const isMainPortal = host === 'hotelnplus.com' || host === 'www.hotelnplus.com';
    const isSystemSubdomain = host.startsWith('app.') || host.startsWith('manage.');
    const isHQ = host === 'hq.hotelnplus.com' || host.startsWith('hq.localhost');

    // 💡 2. Check My Page entry condition (when entering via /member path)
    if (pathname === '/member') {
      setView('MEMBER');
      setTargetHotel(hotelParam || null); // If ?hotel=A001 exists, operate in that specific hotel's mode
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

  // 💡 3. Render view based on routing logic
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