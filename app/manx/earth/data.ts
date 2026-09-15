type ManxAreaShape = {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  zoom: number;
  marker?: { x: number; y: number };
  streetView: boolean;
  note: string;
};

export const manxAreas = [
  { id: "island", name: "Whole island", district: "Ellan Vannin", latitude: 54.2361, longitude: -4.5481, zoom: 10, streetView: false, note: "Begin with the Island as a whole before narrowing to a town, village or coastal district." },
  { id: "douglas", name: "Douglas", district: "East coast · capital", latitude: 54.1523, longitude: -4.4861, zoom: 15, marker: { x: 63, y: 66 }, streetView: true, note: "Promenade, ferry terminal, business district and the principal centre of government." },
  { id: "ramsey", name: "Ramsey", district: "North", latitude: 54.3227, longitude: -4.3843, zoom: 15, marker: { x: 83, y: 9 }, streetView: true, note: "Northern harbour town with access towards Maughold, the Ayres and the mountain road." },
  { id: "peel", name: "Peel", district: "West coast", latitude: 54.2226, longitude: -4.6917, zoom: 15, marker: { x: 22, y: 43 }, streetView: true, note: "Historic west-coast harbour, castle quarter and coastal visitor centre." },
  { id: "castletown", name: "Castletown", district: "South", latitude: 54.074, longitude: -4.6541, zoom: 16, marker: { x: 29, y: 92 }, streetView: true, note: "Historic capital centred on Castle Rushen, the harbour and the old civic core." },
  { id: "port-erin", name: "Port Erin", district: "South-west", latitude: 54.0849, longitude: -4.7503, zoom: 16, marker: { x: 10, y: 88 }, streetView: true, note: "Sheltered bay and southern visitor base near Bradda Head and the steam railway." },
  { id: "laxey", name: "Laxey", district: "East · Garff", latitude: 54.2302, longitude: -4.4, zoom: 16, marker: { x: 80, y: 40 }, streetView: true, note: "Village and valley associated with the Great Laxey Wheel and the Snaefell railway." },
  { id: "kirk-michael", name: "Kirk Michael", district: "West · Michael", latitude: 54.2847, longitude: -4.5898, zoom: 16, marker: { x: 42, y: 22 }, streetView: true, note: "West-coast village on the TT course, between Peel and the northern plain." },
  { id: "onchan", name: "Onchan", district: "East · Garff", latitude: 54.174, longitude: -4.4532, zoom: 16, marker: { x: 70, y: 59 }, streetView: true, note: "Large settlement immediately north of Douglas with its own local centre and coastline." },
] as const satisfies readonly ManxAreaShape[];

export type ManxArea = (typeof manxAreas)[number];

export const manxPlaceCategories = [
  { id: "hotels", label: "Hotels", code: "HTL", query: "hotels" },
  { id: "bars", label: "Bars", code: "BAR", query: "bars" },
  { id: "fuel", label: "Gas / petrol", code: "FUEL", query: "petrol stations" },
  { id: "coffee", label: "Coffee shops", code: "CAFÉ", query: "coffee shops" },
] as const;

export type ManxPlaceCategoryId = (typeof manxPlaceCategories)[number]["id"];

export const manxLocalityCount = manxAreas.filter((area) => area.id !== "island").length;
export const manxPlaceCategoryCount = manxPlaceCategories.length;
