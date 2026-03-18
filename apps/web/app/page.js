import DomainRouter from '../components/DomainRouter';

// 💡 Next.js의 고질적인 서버 사이드 에러를 방지하기 위해 
// 렌더링 방식을 '강제 동적(force-dynamic)'으로 설정합니다.
export const dynamic = 'force-dynamic';

export default function RootPage({ searchParams }) {
  // 💡 서버에서 헤더를 복잡하게 읽는 대신, searchParams만 DomainRouter로 넘깁니다.
  // 실제 도메인 판별 로직은 DomainRouter 안에서 처리하도록 구조를 변경했습니다.
  
  return (
    <DomainRouter 
      initialHotel={searchParams?.hotel || null} 
    />
  );
}