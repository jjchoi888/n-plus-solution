const HOTEL_DIRECTORY = [
  {
    code: "sample001",
    name: "Sample Hotel",
    portalName: "Sample Hotel",
    locationLabel: "📍 sample001",
    address: "Sample Test Property",
    region: "Test Hotels",
    city: "Sample",
    portalImage: "/manila.png",
    descKey: "pms",
    featured: true,
  },
  {
    code: "bay001",
    name: "Bay Hotel",
    portalName: "Bay Hotel",
    locationLabel: "📍 bay001",
    address: "Bay Test Property",
    region: "Test Hotels",
    city: "Bay",
    portalImage: "/baguio.png",
    descKey: "db",
    featured: true,
  },
];

export const buildHotelUrl = (hotelCode) => `/?hotel=${encodeURIComponent(hotelCode)}`;

export const HOTEL_REGIONS = Array.from(
  HOTEL_DIRECTORY.reduce((regionMap, hotel) => {
    if (!regionMap.has(hotel.region)) {
      regionMap.set(hotel.region, new Map());
    }

    const cityMap = regionMap.get(hotel.region);
    if (!cityMap.has(hotel.city)) {
      cityMap.set(hotel.city, []);
    }

    cityMap.get(hotel.city).push({
      code: hotel.code,
      name: hotel.name,
      address: hotel.address,
    });

    return regionMap;
  }, new Map()).entries(),
).map(([region, cityMap]) => ({
  region,
  cities: Array.from(cityMap.entries()).map(([name, hotels]) => ({ name, hotels })),
}));

export const FEATURED_HOTELS = HOTEL_DIRECTORY.filter((hotel) => hotel.featured).map((hotel) => ({
  code: hotel.code,
  name: hotel.portalName,
  img: hotel.portalImage,
  descKey: hotel.descKey,
  url: buildHotelUrl(hotel.code),
}));

export const getHotelDirectoryEntry = (code) =>
  HOTEL_DIRECTORY.find((hotel) => hotel.code === code) || null;

export const getHotelDisplayName = (code) => {
  if (!code || code === "ALL") return null;

  const hotel = getHotelDirectoryEntry(code);
  return hotel?.locationLabel || `📍 ${code}`;
};

export { HOTEL_DIRECTORY };
