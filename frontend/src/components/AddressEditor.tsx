import { useEffect, useState } from 'react';
import { Space, Typography, Button, Spin } from 'antd';
import { EditOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { useOwnProfile } from '../hooks/useOwnProfile';
import AddressAutocomplete from './AddressAutocomplete';
import { parseAddressFeature } from '../config/mapbox';
import type { MapboxFeature } from '../config/mapbox';

const { Text } = Typography;

const asId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return (value as any).id || (value as any)['@id'];
  return undefined;
};

type Props = {
  /** Called whenever we know whether the user currently has an address set. */
  onHasAddressChange?: (hasAddress: boolean) => void;
};

/** View/add/edit the user's own vcard:Location — self-contained, used both in onboarding and the
 * profile page. See sharing.service.js / OnboardingPage for the separate "share with contacts"
 * consent, which only needs to know whether an address exists (see onHasAddressChange). */
const AddressEditor = ({ onHasAddressChange }: Props) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const { profile, isLoading: profileLoading, refetch: refetchProfile } = useOwnProfile();
  const locationUri = asId(profile?.['vcard:hasAddress']);

  const { result: location, query: locationQuery } = useOne({
    resource: 'location',
    id: locationUri,
    queryOptions: { enabled: Boolean(locationUri) }
  });
  const currentAddressLabel = (location as any)?.['vcard:hasAddress']?.['vcard:given-name'];

  useEffect(() => {
    onHasAddressChange?.(Boolean(locationUri));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationUri]);

  const { mutateAsync: createLocation } = useCreate();
  const { mutateAsync: updateLocation } = useUpdate();
  const { mutateAsync: updateProfile } = useUpdate();

  const handleSelectAddress = async (feature: MapboxFeature) => {
    setSaving(true);
    setError(undefined);
    try {
      const addressFields = parseAddressFeature(feature);

      if (locationUri) {
        // Update the existing Location resource in place — keeps the same URI, so nothing else
        // (profile pointer, any already-granted public-read permission) needs to change.
        await updateLocation({
          resource: 'location',
          id: locationUri,
          values: { 'vcard:given-name': 'Domicile', 'vcard:hasAddress': addressFields }
        });
      } else if (profile) {
        const { data: newLocation } = await createLocation({
          resource: 'location',
          values: { 'vcard:given-name': 'Domicile', 'vcard:hasAddress': addressFields }
        });
        // Read-modify-write: the data provider's update() does a full PUT, so we need to resend
        // the whole profile (not just the new field) or we'd wipe out the rest of it.
        const { id: profileId, '@context': _context, ...profileFields } = profile as any;
        await updateProfile({
          resource: 'profile',
          id: profileId,
          values: { ...profileFields, 'vcard:hasAddress': { '@id': (newLocation as any).id } }
        });
      }

      await refetchProfile();
      await locationQuery.refetch();
      setEditing(false);
    } catch (e) {
      setError("Impossible d'enregistrer cette adresse pour le moment.");
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading) return <Spin />;

  return (
    <div>
      {locationUri && !editing ? (
        <Space>
          <EnvironmentOutlined />
          <Text>{locationQuery.isLoading ? <Spin size="small" /> : currentAddressLabel || 'Adresse enregistrée'}</Text>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(true)}>
            Modifier
          </Button>
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          <AddressAutocomplete onSelect={handleSelectAddress} />
          {saving && <Spin size="small" />}
          {locationUri && (
            <Button size="small" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          )}
        </Space>
      )}
      {error && <Text type="danger">{error}</Text>}
    </div>
  );
};

export default AddressEditor;
