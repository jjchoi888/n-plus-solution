"use client";
import { useEffect } from 'react';
import dynamic from 'next/dynamic';

const MainPortal = dynamic(() => import('./MainPortal'), { ssr: false });
const HotelWebsite = dynamic(() => import('./HotelWebsite'), { ssr: false });

function getMatchedHotel(initialHotel) {
  if (typeof window === 'undefined') {
    return initialHotel || null;
  }

  const params = new URLSearchParams(window.location.search);
  const hotelParam = params.get('hotel')?.trim();
  if (hotelParam) {
    return hotelParam;
  }

  if (initialHotel) {
    return initialHotel;
  }

  const host = window.location.hostname.toLowerCase();
  if (host.endsWith('.localhost')) {
    return host.replace(/\.localhost$/, '') || null;
  }

  return null;
}

export default function DomainRouter({ initialHotel }) {
  const targetHotel = getMatchedHotel(initialHotel);
  const view = targetHotel ? 'HOTEL' : 'PORTAL';

  useEffect(() => {
    if (targetHotel) {
      localStorage.setItem('hotelCode', targetHotel);
    } else {
      localStorage.removeItem('hotelCode');
    }
  }, [targetHotel]);

  // 💡 결정된 뷰에 따라 컴포넌트 렌더링
  if (view === 'HOTEL') {
    return <HotelWebsite domain={targetHotel} />;
  } else {
    return <MainPortal />;
  }
}
