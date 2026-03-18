import { headers } from 'next/headers';
import DomainRouter from '../components/DomainRouter';

export default function RootPage({ searchParams }) {
  const headersList = headers();
  const host = headersList.get('host') || '';

  // 💡 1. 통합웹(Main Portal) 판별 로직
  // 로컬호스트(localhost:3000)이거나, Vercel 도메인이면서 'sample'이라는 단어가 없으면 통합웹으로 간주!
  let isMainPortal = host.includes('localhost:3000') || (host.includes('vercel.app') && !host.includes('sample'));

  // 💡 2. 개별웹 테스트를 위한 강제 분기 (Query Parameter 사용)
  // 주소 끝에 ?hotel=sample 을 붙여서 접속하면 강제로 개별웹 화면을 띄웁니다.
  let domain = host;
  
  if (searchParams?.hotel === 'sample' || host.includes('sample')) {
      isMainPortal = false;
      domain = 'sample'; // 호텔 코드를 'sample'로 고정
  }

  // DomainRouter로 최종 결과 전달
  return <DomainRouter isMainPortal={isMainPortal} domain={domain} />;
}