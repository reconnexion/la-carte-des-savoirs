import Map, { Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { NetworkMember } from '../hooks/useNetworkSkills';

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;

type Props = {
  members: NetworkMember[];
  selectedWebId?: string;
  onSelect: (member: NetworkMember) => void;
};

const NetworkMap = ({ members, selectedWebId, onSelect }: Props) => {
  const located = members.filter(member => member.lat !== undefined && member.lng !== undefined);
  const center = located[0] ?? { lat: 46.6, lng: 2.4 }; // Roughly the middle of France as a default

  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <div style={{ padding: 24 }}>
        Aucun jeton d'accès Mapbox n'est configuré (VITE_MAPBOX_ACCESS_TOKEN). Voir le README pour en obtenir un.
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: located.length > 0 ? 10 : 5 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
    >
      {located.map(member => (
        <Marker
          key={member.webId}
          longitude={member.lng!}
          latitude={member.lat!}
          onClick={() => onSelect(member)}
        >
          <Avatar
            src={member.photo}
            icon={!member.photo && <UserOutlined />}
            style={{
              border: `2px solid ${selectedWebId === member.webId ? '#1677ff' : '#fff'}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              cursor: 'pointer'
            }}
          />
        </Marker>
      ))}
    </Map>
  );
};

export default NetworkMap;
