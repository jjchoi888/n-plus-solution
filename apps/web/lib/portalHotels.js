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

const CATEGORY_DEFINITIONS = [
  { id: "city-hotel", label: "City Hotel", icon: "🏙️", group: "propertyType" },
  { id: "business-hotel", label: "Business Hotel", icon: "💼", group: "propertyType" },
  { id: "airport-hotel", label: "Airport Hotel", icon: "✈️", group: "propertyType" },
  { id: "beach-hotel-resort", label: "Beach Hotel & Resort", icon: "🏖️", group: "propertyType" },
  { id: "island-resort", label: "Island Resort", icon: "🌴", group: "propertyType" },
  { id: "lakeside-hotel-resort", label: "Lakeside Hotel & Resort", icon: "🏞️", group: "propertyType" },
  { id: "mountain-hotel-resort", label: "Mountain Hotel & Resort", icon: "⛰️", group: "propertyType" },
  { id: "boutique-hotel", label: "Boutique Hotel", icon: "🛍️", group: "propertyType" },
  { id: "heritage-hotel", label: "Heritage Hotel", icon: "🏛️", group: "propertyType" },
  { id: "wellness-resort", label: "Wellness Resort", icon: "🌿", group: "propertyType" },
  { id: "pet-friendly", label: "Pet Friendly", icon: "🐾", group: "guestHighlight" },
  { id: "family-friendly", label: "Family Friendly", icon: "👨‍👩‍👧‍👦", group: "guestHighlight" },
  { id: "couple-getaway", label: "Couple Getaway", icon: "💕", group: "guestHighlight" },
  { id: "workation-friendly", label: "Workation Friendly", icon: "💻", group: "guestHighlight" },
  { id: "with-pool", label: "With Pool", icon: "🏊", group: "guestHighlight" },
  { id: "spa-wellness", label: "Spa & Wellness", icon: "🧖", group: "guestHighlight" },
  { id: "event-wedding-venue", label: "Event & Wedding Venue", icon: "💍", group: "guestHighlight" },
  { id: "nature-escape", label: "Nature Escape", icon: "🍃", group: "guestHighlight" },
  { id: "near-tourist-spots", label: "Near Tourist Spots", icon: "📍", group: "guestHighlight" },
  { id: "long-stay-friendly", label: "Long Stay Friendly", icon: "🧳", group: "guestHighlight" },
  { id: "luxury-stay", label: "Luxury Stay", icon: "✨", group: "guestHighlight" },
  { id: "all-inclusive-feel", label: "All-Inclusive Feel", icon: "🍽️", group: "guestHighlight" },
];

const normalizeCategoryKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const CATEGORY_INDEX = new Map(
  CATEGORY_DEFINITIONS.flatMap((category) => [
    [normalizeCategoryKey(category.id), category],
    [normalizeCategoryKey(category.label), category],
  ]),
);

const CATEGORY_FIELD_MATCHER =
  /(category|categories|tag|tags|highlight|property[_\s-]?type|propertytype|guest[_\s-]?search|guestsearch)/i;

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

const coerceCategoryValues = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => coerceCategoryValues(item));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
      try {
        return coerceCategoryValues(JSON.parse(trimmed));
      } catch {
        return trimmed.split(/[\n,]/).map((item) => normalizeText(item)).filter(Boolean);
      }
    }

    return trimmed.split(/[\n,]/).map((item) => normalizeText(item)).filter(Boolean);
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, objectValue]) => {
      if (objectValue === true) return [key];
      return coerceCategoryValues(objectValue);
    });
  }

  return [String(value)];
};

const extractHotelCategories = (config) => {
  const sns = getSnsSettings(config);
  const rawValues = [];

  [config, sns].forEach((source) => {
    Object.entries(source || {}).forEach(([key, value]) => {
      if (CATEGORY_FIELD_MATCHER.test(key)) {
        rawValues.push(...coerceCategoryValues(value));
      }
    });
  });

  const matched = [];
  const seen = new Set();

  rawValues.forEach((value) => {
    const normalized = normalizeCategoryKey(value);
    const category = CATEGORY_INDEX.get(normalized);
    if (category && !seen.has(category.id)) {
      matched.push(category);
      seen.add(category.id);
    }
  });

  return matched;
};

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
  const categories = extractHotelCategories(config);

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
    categories,
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

export const buildCategoryGroups = (hotels) =>
  CATEGORY_DEFINITIONS.map((category) => ({
    ...category,
    hotels: hotels.filter((hotel) =>
      Array.isArray(hotel.categories) && hotel.categories.some((item) => item.id === category.id),
    ),
  })).filter((category) => category.hotels.length > 0);

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
