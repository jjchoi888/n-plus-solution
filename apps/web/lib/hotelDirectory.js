import { buildHotelUrl, getCachedHotelDisplayName } from "./portalHotels";

export const getHotelDisplayName = (code) => {
  if (!code || code === "ALL") return null;
  return getCachedHotelDisplayName(code) || `📍 ${code}`;
};
export { buildHotelUrl };
