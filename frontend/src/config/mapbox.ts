// Address search/parsing for vcard:Location resources, matching the field shape used by the
// ActivityPods pod-provider's own address input (@semapps/geo-components' LocationInput /
// extractContext) so addresses created here behave the same way in the pod-provider's own UI.

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;

export type MapboxFeature = {
  place_name: string;
  place_type: string[];
  text: string;
  address?: string;
  center: [number, number];
  context: { id: string; text: string }[];
};

export const searchAddress = async (query: string): Promise<MapboxFeature[]> => {
  if (!query || !MAPBOX_ACCESS_TOKEN) return [];

  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
  url.searchParams.set('types', 'place,address');
  url.searchParams.set('country', 'fr,be,ch');
  url.searchParams.set('language', 'fr');

  const response = await fetch(url.toString());
  if (!response.ok) return [];
  const json = await response.json();
  return json.features ?? [];
};

const extractContext = (context: MapboxFeature['context'], key: string): string | undefined =>
  context?.find(entry => entry.id.startsWith(`${key}.`))?.text;

/** Builds the nested vcard:Address value to store as a Location's vcard:hasAddress. */
export const parseAddressFeature = (feature: MapboxFeature) => ({
  type: 'vcard:Address',
  'vcard:given-name': feature.place_name,
  'vcard:locality': feature.place_type[0] === 'place' ? feature.text : extractContext(feature.context, 'place'),
  'vcard:street-address':
    feature.place_type[0] === 'address' ? [feature.address, feature.text].filter(Boolean).join(' ') : undefined,
  'vcard:postal-code': extractContext(feature.context, 'postcode'),
  'vcard:country-name': extractContext(feature.context, 'country'),
  'vcard:hasGeo': {
    'vcard:longitude': feature.center[0],
    'vcard:latitude': feature.center[1]
  }
});
