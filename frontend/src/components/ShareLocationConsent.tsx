import { useState } from 'react';
import { Checkbox, Button, Alert, Typography, Space } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { fetchJson } from '@activitypods/refine-providers/utils';
import { authProvider } from '../providers';

const { Text } = Typography;

type Props = {
  disabled?: boolean;
};

/** Lets the user share their (already-set) address with their contacts — see
 * backend/services/sharing.service.js for why this goes through a custom outbox activity rather
 * than a plain API call. */
const ShareLocationConsent = ({ disabled }: Props) => {
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

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
    } catch (e) {
      setError(
        "Nous n'avons pas pu partager votre adresse pour le moment. Vous pourrez réessayer plus tard depuis votre profil."
      );
    } finally {
      setSubmitting(false);
    }
  };

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
        <Checkbox checked={consent} disabled={disabled} onChange={event => setConsent(event.target.checked)}>
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
