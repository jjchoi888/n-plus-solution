// 기본 API 클라이언트 설정
const BASE_URL = 'http://136.117.49.111:5000'; // j.j님의  백엔드 주소

export const apiClient = async (endpoint, options = {}) => {
  const { lang, ...customOptions } = options;
  
  // URL에 언어 파라미터 자동 추가 (다국어 대응)
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (lang) url.searchParams.append('lang', lang);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    ...customOptions,
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  return response.json();
};