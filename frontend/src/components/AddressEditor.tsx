import { useEffect, useState } from 'react';
import { Space, Typography, Button, Spin, Checkbox, Alert } from 'antd';
import { EditOutlined, EnvironmentOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { fetchJson } from '@activitypods/refine-providers/utils';
import { useOwnProfile } from '../hooks/useOwnProfile';
import AddressAutocomplete from './AddressAutocomplete';
import { parseAddressFeature } from '../config/mapbox';
import type { MapboxFeature } from '../config/mapbox';
import { authProvider } from '../providers';

const { Text, Paragraph } = Typography;

const asId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return (value as any).id || (value as any)['@id'];
  return undefined;
};

type Props = {
  /** Called whenever the current Location URI changes (undefined if there isn't one yet). */
  onLocationChange?: (locationUri: string | undefined) => void;
};

/** View/add/edit the user's own vcard:Location — self-contained, used both in onboarding and the
 * profile page. Made publicly readable (visible to contacts) automatically as soon as it's
 * created, same as skills — see backend/services/location.service.js. Consent is asked once, up
 * front, right here: the address input only appears once the user has agreed to that. */
const AddressEditor = ({ onLocationChange }: Props) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [consent, setConsent] = useState(false);

  const { profile, isLoading: profileLoading, refetch: refetchProfile } = useOwnProfile();
  const locationUri = asId(profile?.['vcard:hasAddress']);

  const { result: location, query: locationQuery } = useOne({
    resource: 'location',
    id: locationUri,
    queryOptions: { enabled: Boolean(locationUri) }
  });
  const currentAddressLabel = (location as any)?.['vcard:hasAddress']?.['vcard:given-name'];

  useEffect(() => {
    onLocationChange?.(locationUri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationUri]);

  const { mutateAsync: createLocation } = useCreate();
  const { mutateAsync: updateLocation } = useUpdate();

  const handleSelectAddress = async (feature: MapboxFeature) => {
    setSaving(true);
    setError(undefined);
    try {
      const addressFields = parseAddressFeature(feature);

      if (locationUri) {
        // Update the existing Location resource in place — keeps the same URI, so nothing else
        // (profile pointer, already-granted public-read permission) needs to change.
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

        // A PUT here would need to resend the whole profile (the data provider's update() fully
        // overwrites), which turned out to 422 — some field on the fetched profile doesn't
        // round-trip cleanly. A Solid PATCH (SPARQL Update) only touches the one triple we
        // actually want to add, so it's both safer and simpler.
        const session = authProvider.getSession();
        if (!session) throw new Error('Not authenticated');
        await fetchJson(
          (profile as any).id,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/sparql-update' },
            body: `PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>\nINSERT DATA { <${(profile as any).id}> vcard:hasAddress <${(newLocation as any).id}> . }`
          },
          session.token
        );
      }

      await refetchProfile();
      await locationQuery.refetch();
      setEditing(false);
    } catch (e: any) {
      const status = e?.status ? ` (HTTP ${e.status})` : '';
      setError(`Impossible d'enregistrer cette adresse${status} : ${e?.body?.message || e?.message || 'erreur inconnue'}`);
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading) return <Spin />;

  if (locationUri && !editing) {
    return (
      <div>
        <Space>
          <EnvironmentOutlined />
          <Text>{locationQuery.isLoading ? <Spin size="small" /> : currentAddressLabel || 'Adresse enregistrée'}</Text>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(true)}>
            Modifier
          </Button>
        </Space>
        <div style={{ marginTop: 4 }}>
          <Space size={4}>
            <CheckCircleFilled style={{ color: '#52c41a' }} />
            <Text type="secondary">Visible par vos contacts.</Text>
          </Space>
        </div>
      </div>
    );
  }

  // No address yet (or editing): the address input only appears once the user has agreed it will
  // become visible to their contacts, since it's made public as soon as it's saved.
  return (
    <div>
      {!locationUri && (
        <Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Une fois enregistrée, votre adresse sera visible par vos contacts actuels (et par tout nouveau contact que
          vous ajouterez par la suite).
        </Paragraph>
      )}
      {locationUri || consent ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <AddressAutocomplete onSelect={handleSelectAddress} />
          {saving && <Spin size="small" />}
          {locationUri && (
            <Button size="small" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          )}
        </Space>
      ) : (
        <Checkbox checked={consent} onChange={event => setConsent(event.target.checked)}>
          J'accepte que mon adresse soit visible par mes contacts
        </Checkbox>
      )}
      {error && (
        <Alert style={{ marginTop: 8 }} type="error" message={error} />
      )}
    </div>
  );
};

export default AddressEditor;
