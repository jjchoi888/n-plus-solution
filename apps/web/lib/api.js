// 1. Local 백엔드 서버 주소
const BASE_URL = '';

// 💡 [삭제] 더 이상 단일 호텔 코드에 묶이지 않으므로 환경 변수(HOTEL_CODE)를 고정하지 않습니다.

export const apiClient = async (endpoint, options = {}) => {
  // 💡 [수정] 컴포넌트에서 넘겨주는 'hotelCode'를 추가로 받아냅니다.
  const { lang, hotelCode, ...customOptions } = options;
  const url = new URL(`${BASE_URL}${endpoint}`);
  
  if (lang) url.searchParams.append('lang', lang);

  // 💡 [핵심] BookingBar에서 넘겨준 목적지(ALL, NPLUS01 등)를 URL에 붙입니다.
  // 아무것도 안 넘어오면 기본값으로 'ALL'을 세팅합니다.
  const targetHotel = hotelCode || 'ALL';
  url.searchParams.append('hotel', targetHotel);

  const response = await fetch(url.toString(), {
    method: customOptions.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...customOptions,
  });

  if (!response.ok) {
    throw new Error(`[API Error] Network response was not ok: ${response.status}`);
  }
  return response.json();
};

export const roomApi = {
  // 💡 [수정] BookingBar에서 전달받는 destination(지점) 파라미터를 추가했습니다.
  getAvailableRooms: async (checkIn, checkOut, lang, destination = 'ALL') => {
    return apiClient('/api/public/rooms/available', {
      method: 'POST',
      body: JSON.stringify({ checkIn, checkOut }),
      lang,
      hotelCode: destination // 👉 apiClient로 목적지를 쏘아줍니다!
    });
  }
};