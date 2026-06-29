import DomainRouter from '../components/DomainRouter';

// 💡 Next.js의 고질적인 서버 사이드 에러를 방지하기 위해 
// 렌더링 방식을 '강제 동적(force-dynamic)'으로 설정합니다.
export const dynamic = 'force-dynamic';

// 💡 컴포넌트 앞에 반드시 async를 붙여줍니다.
export default async function RootPage({ searchParams }) {
  // 💡 Next.js 15 최신 문법: searchParams를 await로 먼저 풀어줍니다.
  const params = await searchParams;

  return (
    <DomainRouter
      initialHotel={params?.hotel || null}
    />
  );
}