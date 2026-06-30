import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CustomerDisplay from './pages/CustomerDisplay';
import PosDisplay from './pages/PosDisplay';
import BreakfastPOS from './pages/BreakfastPOS';

// 💡 [최적화] 동기적 import를 lazy loading으로 변경 (접속하는 화면만 로딩하여 초기 속도 극대화)
const Home = lazy(() => import('./pages/Home'));
const Front = lazy(() => import('./pages/Front'));
const Admin = lazy(() => import('./pages/Admin'));
const Kitchen = lazy(() => import('./pages/Kitchen'));
const Tv = lazy(() => import('./pages/Tv'));
// 💡 [신규 추가] TV 관리자 초기 세팅 화면도 lazy 로딩으로 추가
const TvAdminSetup = lazy(() => import('./pages/TvAdminSetup'));
const Pos = lazy(() => import('./pages/Pos'));
const Housekeeping = lazy(() => import('./pages/Housekeeping'));
const SelfCheckin = lazy(() => import('./pages/SelfCheckin'));
const MobileCheckin = lazy(() => import('./pages/MobileCheckin'));
const Finance = lazy(() => import('./pages/Finance'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const Inventory = lazy(() => import('./pages/Inventory'));
const ApprovalCenter = lazy(() => import('./pages/ApprovalCenter'));

// 메신저는 항상 떠있어야 하므로 기존 import 방식 유지
import FloatingApprovalInbox from './FloatingApprovalInbox';
import FloatingMessenger from './FloatingMessenger';

// 🛡️ [강력한 접근 권한 제어 컴포넌트 - 정밀 매칭 적용]
const ProtectedRoute = ({ children, requiredMenu }) => {
  const userId = sessionStorage.getItem('userId');
  const userRole = sessionStorage.getItem('role');
  const accessibleMenus = sessionStorage.getItem('accessible_menus') || '';
  const accessArray = accessibleMenus.split(','); // 💡 정밀 매칭을 위해 배열로 분리

  // 💡 [신규 추가] 서브 시스템 어드민 여부 불러오기
  const isSubAdmin = sessionStorage.getItem('is_sub_admin');

  if (!userId || !userRole) {
    alert('You do not have access rights. Please log in first.');
    return <Navigate to="/" />;
  }

  // 💡 [핵심 수정] SUPER_ADMIN 이거나 서브 시스템 어드민(is_sub_admin === '1')이면 무조건 프리패스!
  if (userRole === 'SUPER_ADMIN' || isSubAdmin === '1') return children;

  // [A] 백오피스(Admin): 배열 중 하나라도 'ADMIN_'으로 시작하면 통과
  if (requiredMenu === 'ADMIN' && accessArray.some(m => m.startsWith('ADMIN_'))) return children;

  // [B] 일반 모듈: 글자가 완벽하게 일치해야 통과 (ADMIN_FINANCE와 FINANCE 철저히 구분)
  if (requiredMenu && requiredMenu !== 'ADMIN' && requiredMenu !== 'POS' && requiredMenu !== 'KDS') {
    if (accessArray.includes(requiredMenu)) return children;
  }

  // [C] POS / KDS
  if (requiredMenu === 'POS' || requiredMenu === 'KDS') {
    const pathParts = window.location.pathname.split('/');
    const storeId = pathParts[pathParts.length - 1];
    if (accessArray.includes(`${requiredMenu}_${storeId}`)) return children;
  }

  alert('⛔ Access Denied: You do not have permission to view this page.');
  return <Navigate to="/" />;
};

export default function App() {
  return (
    <BrowserRouter>
      {/* 💡 [최적화] 페이지를 불러오는 찰나의 순간에 보여줄 세련된 로딩 화면 */}
      <Suspense fallback={
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white">
          <div className="animate-spin text-4xl mb-4">⚙️</div>
          <h2 className="font-bold tracking-widest text-slate-400">Loading System...</h2>
        </div>
      }>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/self-checkin" element={<SelfCheckin />} />
          <Route path="/mobile-checkin" element={<MobileCheckin />} />

          {/* 💡 [신규 연동] TV 라우트 설정 */}
          <Route path="/tv/setup" element={<TvAdminSetup />} />
          <Route path="/tv/:roomNumber" element={<Tv />} />
          {/* 방 번호 없이 /tv 로 들어오면 안전하게 setup 화면으로 돌려보냅니다 */}
          <Route path="/tv" element={<Navigate to="/tv/setup" replace />} />

          <Route path="/tablet" element={<CustomerDisplay />} />
          <Route path="/posdisplay" element={<PosDisplay />} />
          <Route path="/breakfast" element={<BreakfastPOS />} />

          {/* 🛡️ 프라이빗 라우트 (accessible_menus 기반 세밀한 통제) */}
          <Route path="/admin" element={<ProtectedRoute requiredMenu="ADMIN"><Admin /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute requiredMenu="FINANCE"><Finance /></ProtectedRoute>} />
          <Route path="/front" element={<ProtectedRoute requiredMenu="FRONT"><Front /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute requiredMenu="INVENTORY"><Inventory /></ProtectedRoute>} />
          <Route path="/housekeeping" element={<ProtectedRoute requiredMenu="HK"><Housekeeping /></ProtectedRoute>} />
          <Route path="/maintenance" element={<ProtectedRoute requiredMenu="MAINTENANCE"><Maintenance /></ProtectedRoute>} />
          <Route path="/approvals" element={<ApprovalCenter />} />

          <Route path="/pos/:id" element={<ProtectedRoute requiredMenu="POS"><Pos /></ProtectedRoute>} />
          <Route path="/kitchen/:id" element={<ProtectedRoute requiredMenu="KDS"><Kitchen /></ProtectedRoute>} />
        </Routes>
      </Suspense>

      <FloatingApprovalInbox />
      <FloatingMessenger />
    </BrowserRouter>
  );
}
