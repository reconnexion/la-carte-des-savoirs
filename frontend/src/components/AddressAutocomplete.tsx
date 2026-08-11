import { useMemo, useState } from 'react';
import { AutoComplete } from 'antd';
import { searchAddress } from '../config/mapbox';
import type { MapboxFeature } from '../config/mapbox';

type Props = {
  placeholder?: string;
  onSelect: (feature: MapboxFeature) => void;
};

const AddressAutocomplete = ({ placeholder, onSelect }: Props) => {
  const [query, setQuery] = useState('');
  const [features, setFeatures] = useState<MapboxFeature[]>([]);

  const debouncedSearch = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (value: string) => {
      clearTimeout(timeout);
      if (!value) {
        setFeatures([]);
        return;
      }
      timeout = setTimeout(async () => setFeatures(await searchAddress(value)), 250);
    };
  }, []);

  return (
    <AutoComplete
      style={{ width: '100%' }}
      value={query}
      options={features.map(feature => ({ value: feature.place_name, feature }))}
      onSearch={value => {
        setQuery(value);
        debouncedSearch(value);
      }}
      onSelect={(_value, option: any) => {
        setQuery(option.feature.place_name);
        setFeatures([]);
        onSelect(option.feature);
      }}
      placeholder={placeholder || 'Tapez votre adresse…'}
    />
  );
};

export default AddressAutocomplete;
