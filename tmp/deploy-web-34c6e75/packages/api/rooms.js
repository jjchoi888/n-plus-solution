import { apiClient } from './client';

export const roomApi = {
  // 전체 객실 타입 목록 가져오기 (언어별 대응 가능)
  getAllRoomTypes: (lang) => apiClient('/api/room-types', { lang }),
  
  // 특정 객실 상세 정보 가져오기
  getRoomDetails: (roomId, lang) => apiClient(`/api/room-types/${roomId}`, { lang }),
  
  // 실시간 예약 가능 객실 조회
  getAvailableRooms: (checkIn, checkOut, lang) => 
    apiClient('/api/rooms/available', {
      method: 'POST',
      body: JSON.stringify({ checkIn, checkOut }),
      lang
    })
};