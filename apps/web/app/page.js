import { headers } from 'next/headers';
import DomainRouter from '../components/DomainRouter';

// 💡 [수정1] 함수 앞에 'async'를 붙여 비동기 함수로 만듭니다.
export default async function RootPage() {
  // 💡 [수정2] headers() 앞에 'await'를 붙여 데이터를 다 가져올 때까지 기다리게 합니다.
  const headersList = await headers();
  const host = headersList.get('host') || '';

  // 2. 통합 포털 도메인인지 확인합니다. (로컬 테스트용 localhost 포함)
  const isMainPortal = host.includes('nplus-booking.com') || host.includes('localhost:3000');

  // 3. 판별한 결과(isMainPortal)와 도메인(host)을 클라이언트 라우터로 넘깁니다!
  return <DomainRouter isMainPortal={isMainPortal} domain={host} />;
}