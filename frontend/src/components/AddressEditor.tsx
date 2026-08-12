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
 * profile page. The Location itself (street address, postal code...) stays private; only an
 * approximate (deliberately jittered) position gets copied onto the profile automatically, same
 * moment skills become visible — see backend/services/location.service.js. Consent is asked
 * once, up front, right here: the address input only appears once the user has agreed to that. */
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

      let targetLocationUri = locationUri;
      if (locationUri) {
        // '@type' must be included explicitly: update() does a full PUT of exactly what we send —
        // omitting it silently strips the resource's own type declaration (confirmed by inspecting
        // the triplestore: a first attempt without this left rdf:type, dc:created, dc:modified and
        // dc:creator all wiped from the resource).
        await updateLocation({
          resource: 'location',
          id: locationUri,
          values: { '@type': 'vcard:Location', 'vcard:given-name': 'Domicile', 'vcard:hasAddress': addressFields }
        });
      } else if (profile) {
        const { data: newLocation } = await createLocation({
          resource: 'location',
          values: { 'vcard:given-name': 'Domicile', 'vcard:hasAddress': addressFields }
        });
        targetLocationUri = (newLocation as any).id;
      }

      // A real PUT of the profile (not a PATCH) is required here: the Pod provider's own
      // `before.put` hook on the profile container (pod-provider/backend/services/profiles/
      // profile.ts) is what actually computes vcard:hasGeo from the linked Location's address —
      // synchronously, no activity/webhook involved. vcard:Location itself is a container flagged
      // `excludeFromMirror` on the Pod provider, so it never emits an AS2 activity at all: a
      // PATCH-based / onCreate-hook approach (what this used to do, see location.service.js's
      // git history) can structurally never observe a Location change, no matter what access the
      // app is granted. We fetch the profile's own current raw document right before PUTting it
      // back (rather than reusing the Refine-normalized `profile` object, whose reshaped `id` key
      // and dropped `@context` caused an 422 the first time this was tried) so nothing else on the
      // profile is lost in the round-trip.
      if (targetLocationUri && profile) {
        const session = authProvider.getSession();
        if (!session) throw new Error('Not authenticated');
        const { json: rawProfile } = await fetchJson((profile as any).id, {}, session.token);
        await fetchJson(
          (profile as any).id,
          {
            method: 'PUT',
            body: JSON.stringify({ ...rawProfile, 'vcard:hasAddress': targetLocationUri })
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
            <Text type="secondary">Votre position est visible par vos contacts.</Text>
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
          Les détails de votre adresse (rue, code postal...) ne sont jamais partagés. Seule sa position sur la carte
          sera visible par vos contacts actuels, et par tout nouveau contact que vous ajouterez par la suite.
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
          J'accepte que ma position soit visible par mes contacts
        </Checkbox>
      )}
      {error && (
        <Alert style={{ marginTop: 8 }} type="error" message={error} />
      )}
    </div>
  );
};

export default AddressEditor;
