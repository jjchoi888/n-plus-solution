"use client"; // 💡 여긴 클라이언트 컴포넌트이므로 ssr: false 사용이 가능합니다!
import dynamic from 'next/dynamic';

// AOS 에러를 막기 위해 클라이언트에서만 렌더링하도록 설정
const MainPortal = dynamic(() => import('./MainPortal'), { ssr: false });
const HotelWebsite = dynamic(() => import('./HotelWebsite'), { ssr: false });

export default function DomainRouter({ isMainPortal, domain }) {
  // 전달받은 결과에 따라 안전하게 화면을 띄워줍니다.
  if (isMainPortal) {
    return <MainPortal />;
  } else {
    return <HotelWebsite domain={domain} />;
  }
}