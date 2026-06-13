const BASE_URL = "";
const DEFAULT_PORTAL_IMAGE = "/hero1.png";

let portalHotelsCache = [];
let portalHotelsPromise = null;
const hotelDisplayNameCache = new Map();

const getHotelDate = (offsetDays = 0) => {
  const now = new Date();
  if (now.getHours() < 12) now.setDate(now.getDate() - 1);
  now.setDate(now.getDate() + offsetDays);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseJsonSafely = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeText = (value) => String(value || "").trim();

export const parseGoogleMapEmbedSrc = (rawValue, fallbackQuery = "Philippines") => {
  const raw = normalizeText(rawValue);
  const fallback = `https://maps.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&t=m&z=14&ie=UTF8&iwloc=&output=embed`;

  if (!raw) return fallback;

  const iframeMatch = raw.match(/src=["']([^"']+)["']/i);
  const candidate = iframeMatch?.[1] || raw;

  if (/output=embed/i.test(candidate)) return candidate;

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const query =
      parsed.searchParams.get("q") ||
      parsed.searchParams.get("query") ||
      parsed.searchParams.get("destination") ||
      parsed.searchParams.get("daddr");

    if (query) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=m&z=14&ie=UTF8&iwloc=&output=embed`;
    }

    if (host.includes("maps.google.") || host.includes("www.google.")) {
      const placeMatch = decodeURIComponent(parsed.pathname).match(/\/place\/([^/]+)/i);
      if (placeMatch?.[1]) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(placeMatch[1].replace(/\+/g, " "))}&t=m&z=14&ie=UTF8&iwloc=&output=embed`;
      }

      const atMatch = parsed.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (atMatch) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(`${atMatch[1]},${atMatch[2]}`)}&t=m&z=14&ie=UTF8&iwloc=&output=embed`;
      }
    }

    if (host.includes("maps.app.goo.gl")) return fallback;
  } catch {
    return `https://maps.google.com/maps?q=${encodeURIComponent(candidate)}&t=m&z=14&ie=UTF8&iwloc=&output=embed`;
  }

  return fallback;
};

const getSnsSettings = (config) => parseJsonSafely(config?.sns_json, {});

const extractHotelName = (config) => {
  const sns = getSnsSettings(config);
  return (
    normalizeText(config?.hotel_name) ||
    normalizeText(sns?.hotel_name) ||
    normalizeText(sns?.title) ||
    normalizeText(config?.footer_company_name) ||
    normalizeText(config?.property_name) ||
    normalizeText(config?.hotel_code) ||
    "Hotel"
  );
};

const extractAddress = (config) => {
  const sns = getSnsSettings(config);
  return normalizeText(
    sns?.address ||
      sns?.full_address ||
      config?.address ||
      config?.property_address ||
      config?.full_address,
  );
};

const cleanLocationParts = (address) =>
  address
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .filter((part) => !/^philippines$/i.test(part));

const extractProvince = (config, address) => {
  const sns = getSnsSettings(config);
  const configuredProvince =
    normalizeText(config?.province) ||
    normalizeText(config?.property_province) ||
    normalizeText(sns?.province);

  if (configuredProvince) return configuredProvince;

  const parts = cleanLocationParts(address);
  if (parts.length === 0) return "";
  return parts[parts.length - 1];
};

const extractCityMunicipality = (config, address, province) => {
  const sns = getSnsSettings(config);
  const configuredCity =
    normalizeText(config?.city_municipality) ||
    normalizeText(config?.city) ||
    normalizeText(config?.municipality) ||
    normalizeText(sns?.city_municipality) ||
    normalizeText(sns?.city) ||
    normalizeText(sns?.municipality);

  if (configuredCity) return configuredCity;

  const parts = cleanLocationParts(address);
  if (parts.length <= 1) return province;
  return parts[parts.length - 2];
};

const extractPrimaryImage = (config) => {
  const gallery = parseJsonSafely(config?.gallery_json, []);
  if (Array.isArray(gallery) && gallery.length > 0) return gallery[0];
  if (normalizeText(config?.bg_image_url)) return normalizeText(config.bg_image_url);
  if (normalizeText(config?.logo_url)) return normalizeText(config.logo_url);
  return DEFAULT_PORTAL_IMAGE;
};

const buildMapQuery = (name, address) => normalizeText(address) || normalizeText(name) || "Philippines";

const cachePortalHotels = (hotels) => {
  portalHotelsCache = hotels;
  hotelDisplayNameCache.clear();

  hotels.forEach((hotel) => {
    hotelDisplayNameCache.set(hotel.code, `📍 ${hotel.name}`);
  });

  return hotels;
};

const fetchAvailableHotelCodes = async (lang = "en") => {
  const checkIn = getHotelDate(0);
  const checkOut = getHotelDate(1);

  const response = await fetch(`${BASE_URL}/api/public/rooms/available?hotel=ALL&lang=${lang}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkIn, checkOut, hotel_code: "ALL" }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch available hotels: ${response.status}`);
  }

  const rooms = await response.json();
  const codes = Array.from(
    new Set(
      (Array.isArray(rooms) ? rooms : [])
        .map((room) => normalizeText(room?.hotelCode || room?.hotel_code))
        .filter(Boolean),
    ),
  );

  return codes;
};

const fetchHotelConfig = async (hotelCode) => {
  const response = await fetch(`${BASE_URL}/api/settings/website?hotel=${encodeURIComponent(hotelCode)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch hotel settings for ${hotelCode}: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.success || !data?.config) return null;

  const config = data.config;
  const name = extractHotelName(config);
  const address = extractAddress(config);
  const province = extractProvince(config, address);
  const cityMunicipal = extractCityMunicipality(config, address, province);
  const rawMapLink =
    normalizeText(config.map_embed_url) ||
    normalizeText(config.map_url) ||
    normalizeText(getSnsSettings(config)?.map_link);
  const mapQuery = buildMapQuery(name, address);

  return {
    code: hotelCode,
    name,
    address: address || hotelCode,
    province,
    cityMunicipal,
    mapQuery,
    mapEmbedUrl: parseGoogleMapEmbedSrc(rawMapLink, mapQuery),
    mapLink: rawMapLink,
    image: extractPrimaryImage(config),
    url: buildHotelUrl(hotelCode),
  };
};

export const buildHotelUrl = (hotelCode) => `/?hotel=${encodeURIComponent(hotelCode)}`;

export const getCachedHotelDisplayName = (hotelCode) =>
  hotelDisplayNameCache.get(hotelCode) || null;

export const groupHotelsByProvince = (hotels) =>
  Array.from(
    hotels
      .filter((hotel) => normalizeText(hotel.province))
      .reduce((provinceMap, hotel) => {
      if (!provinceMap.has(hotel.province)) {
        provinceMap.set(hotel.province, new Map());
      }

      const cityMap = provinceMap.get(hotel.province);
      if (!cityMap.has(hotel.cityMunicipal)) {
        cityMap.set(hotel.cityMunicipal, []);
      }

      cityMap.get(hotel.cityMunicipal).push(hotel);
      return provinceMap;
      }, new Map()).entries(),
  )
    .map(([province, cityMap]) => ({
      province,
      cities: Array.from(cityMap.entries()).map(([name, hotelsInCity]) => ({
        name,
        hotels: hotelsInCity,
      })),
    }))
    .sort((a, b) => a.province.localeCompare(b.province));

export const fetchPortalHotels = async (lang = "en", options = {}) => {
  const { forceRefresh = false } = options;

  if (!forceRefresh && portalHotelsCache.length > 0) {
    return portalHotelsCache;
  }

  if (!forceRefresh && portalHotelsPromise) {
    return portalHotelsPromise;
  }

  portalHotelsPromise = (async () => {
    const hotelCodes = await fetchAvailableHotelCodes(lang);
    const hotels = await Promise.all(hotelCodes.map((hotelCode) => fetchHotelConfig(hotelCode)));

    return cachePortalHotels(
      hotels
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  })();

  try {
    return await portalHotelsPromise;
  } finally {
    portalHotelsPromise = null;
  }
};
