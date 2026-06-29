// 💡 API base URL configuration: Uses environment variable if available, else defaults to production API
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hotelnplus.com';

/**
 * Global API Client wrapper
 * @param {string} endpoint - The API endpoint path
 * @param {object} options - Options including method, body, lang, and hotelCode
 */
export const apiClient = async (endpoint, options = {}) => {
  const { lang, hotelCode, ...customOptions } = options;
  const url = new URL(`${BASE_URL}${endpoint}`);

  if (lang) url.searchParams.append('lang', lang);

  // 💡 Append destination (hotelCode) to query params
  const targetHotel = hotelCode || 'ALL';
  url.searchParams.append('hotel', targetHotel);

  try {
    const response = await fetch(url.toString(), {
      method: customOptions.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...customOptions.headers
      },
      ...customOptions,
    });

    if (!response.ok) {
      throw new Error(`[API Error] Status: ${response.status}`);
    }

    // 💡 Robust JSON parsing with error handling
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error; // Rethrow to let the component handle the UI state
  }
};

export const roomApi = {
  // 💡 Get available rooms with hotel context
  getAvailableRooms: async (checkIn, checkOut, lang, destination = 'ALL') => {
    return apiClient('/api/public/rooms/available', {
      method: 'POST',
      body: JSON.stringify({ checkIn, checkOut }),
      lang,
      hotelCode: destination
    });
  }
};