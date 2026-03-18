"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MainPortal = dynamic(() => import('./MainPortal'), { ssr: false });
const HotelWebsite = dynamic(() => import('./HotelWebsite'), { ssr: false });

export default function DomainRouter({ initialHotel }) {
  const [isMainPortal, setIsMainPortal] = useState(true);
  const [targetHotel, setTargetHotel] = useState(null);

  useEffect(() => {
    const host = window.location.hostname; // 접속한 주소 (예: n-plus-solution.vercel.app)

    // 💡 [핵심 로직] 
    // 1. URL 뒤에 ?hotel=sample 이 붙어있으면 무조건 개별웹!
    // 2. 주소에 'sample' 이라는 글자가 포함되어 있으면 개별웹!
    // 3. 그 외 Vercel 주소나 localhost는 모두 '통합웹'으로 실행!
    if (initialHotel === 'sample' || host.includes('sample')) {
      setIsMainPortal(false);
      setTargetHotel('sample');
    } else {
      setIsMainPortal(true);
      setTargetHotel(null);
    }
  }, [initialHotel]);

  // 화면 렌더링
  if (isMainPortal) {
    return <MainPortal />;
  } else {
    return <HotelWebsite domain={targetHotel} />;
  }
}