import { useEffect, useState } from 'react';
import { Checkbox, Button, Alert, Typography, Space, Spin } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { fetchJson } from '@activitypods/refine-providers/utils';
import { authProvider } from '../providers';

const { Text } = Typography;

type Props = {
  /** URI of the vcard:Location to share/check — undefined while there isn't one yet. */
  locationUri?: string;
};

/** Lets the user share their (already-set) address with their contacts — see
 * backend/services/sharing.service.js for why this goes through a custom outbox activity rather
 * than a plain API call. */
const ShareLocationConsent = ({ locationUri }: Props) => {
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  // The component only ever had local state before, so it always started as "not shared" even
  // if a previous share had actually succeeded (or the page was simply reloaded) — check whether
  // the address is already publicly readable instead of assuming.
  useEffect(() => {
    if (!locationUri) {
      setDone(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    fetch(locationUri, { headers: { Accept: 'application/ld+json' } })
      .then(response => {
        if (!cancelled) setDone(response.ok);
      })
      .catch(() => {
        if (!cancelled) setDone(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationUri]);

  const handleShare = async () => {
    setSubmitting(true);
    setError(undefined);
    try {
      const session = authProvider.getSession();
      if (!session) throw new Error('Not authenticated');

      const { json: webIdDoc } = await fetchJson(session.webId, {}, session.token);
      const outboxUri = webIdDoc?.outbox?.id || webIdDoc?.outbox?.['@id'] || webIdDoc?.outbox;
      if (!outboxUri) throw new Error('Could not find the outbox of the current user');

      await fetchJson(
        outboxUri,
        {
          method: 'POST',
          body: JSON.stringify({
            '@context': 'https://www.w3.org/ns/activitystreams',
            type: 'ShareLocation',
            actor: session.webId
          })
        },
        session.token
      );
      setDone(true);
    } catch (e: any) {
      // Surfacing the real error (rather than a generic message) on purpose while this flow is
      // still being validated against the live Pod provider.
      const status = e?.status ? ` (HTTP ${e.status})` : '';
      setError(`Échec du partage${status} : ${e?.body?.message || e?.message || 'erreur inconnue'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return <Spin size="small" />;

  if (done) {
    return (
      <Space>
        <CheckCircleFilled style={{ color: '#52c41a' }} />
        <Text>Votre adresse est partagée avec vos contacts.</Text>
      </Space>
    );
  }

  return (
    <div>
      <Space direction="vertical">
        <Checkbox checked={consent} disabled={!locationUri} onChange={event => setConsent(event.target.checked)}>
          Partager mon adresse avec mes contacts
        </Checkbox>
        {consent && (
          <Button type="primary" size="small" loading={submitting} onClick={handleShare}>
            Confirmer le partage
          </Button>
        )}
      </Space>
      {error && <Alert style={{ marginTop: 8 }} type="error" message={error} />}
    </div>
  );
};

export default ShareLocationConsent;
