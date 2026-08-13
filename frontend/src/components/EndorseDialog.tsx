import { useState } from 'react';
import { Modal, Input, Switch, Select, Avatar, Space, Typography, Alert, Collapse, App } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useList, useGetIdentity } from '@refinedev/core';
import { fetchJson } from '@activitypods/refine-providers/utils';
import { authProvider } from '../providers';
import type { NetworkMember, NetworkSkill } from '../hooks/useNetworkSkills';

const { Text } = Typography;
const { TextArea } = Input;

const AS_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';
// Full IRI, not the apods: CURIE — sent as-is with no dependency on the request's own @context
// mapping that prefix (see endorsement.service.js for the matching half of this).
const APODS_ENDORSE = 'http://activitypods.org/ns/core#Endorse';

const asId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return (value as any).id || (value as any)['@id'];
  return undefined;
};

const asLiteral = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') return (value as any)['@value'];
  return undefined;
};

type Props = {
  open: boolean;
  onClose: () => void;
  member: NetworkMember;
  skill: NetworkSkill;
  /** Called once the activity has actually been sent — recommendations only show up once the
   * recipient's own backend has processed the activity (apods:recommendedBy), which is
   * asynchronous, so this is just a "sent" acknowledgement, not a guarantee it's visible yet. */
  onSent: () => void;
};

const EndorseDialog = ({ open, onClose, member, skill, onSent }: Props) => {
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<{ id: string }>();
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [ccWebIds, setCcWebIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  // Reuses the same 'profile' list query used throughout the app (self + contacts) — cheap, no
  // extra request beyond React Query's normal dedup.
  const { result: contactsResult } = useList({ resource: 'profile', pagination: { pageSize: 200 } });
  const ccOptions = ((contactsResult?.data ?? []) as any[])
    .map(profile => ({
      webId: asId(profile['describes']),
      name: asLiteral(profile['vcard:given-name']) || asLiteral(profile['vcard:fn'])
    }))
    .filter(contact => contact.webId && contact.webId !== identity?.id && contact.webId !== member.webId);

  const reset = () => {
    setContent('');
    setIsPublic(true);
    setCcWebIds([]);
    setError(undefined);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSend = async () => {
    if (!identity) return;
    setSending(true);
    setError(undefined);
    try {
      const session = authProvider.getSession();
      if (!session) throw new Error('Not authenticated');

      // The outbox URL isn't predictable from the WebID alone, so it's fetched fresh rather than
      // guessed — same convention as elsewhere in this app.
      const { json: myActor } = await fetchJson(identity.id, {}, session.token);
      const outboxUri = myActor?.outbox;
      if (!outboxUri) throw new Error("Impossible de trouver votre boîte d'envoi (outbox)");

      // The Pod provider's own built-in setRightsHandler (activitypub.activity's own
      // ActivitiesHandlerMixin, match: '*') automatically grants read rights matching to/cc — and
      // public read when the activity is publicly addressed — on every emitted activity,
      // Endorse included. No app-side ACL code needed here at all; confirmed by inspecting the
      // triplestore directly after a send (a correct #Read acl:Authorization was already there
      // before this app ever touched it).
      await fetchJson(
        outboxUri,
        {
          method: 'POST',
          body: JSON.stringify({
            '@context': 'https://www.w3.org/ns/activitystreams',
            type: APODS_ENDORSE,
            object: skill.uri,
            content,
            to: isPublic ? [member.webId, AS_PUBLIC] : [member.webId],
            ...(ccWebIds.length > 0 ? { cc: ccWebIds } : {})
          })
        },
        session.token
      );

      message.success('Recommandation envoyée !');
      onSent();
      handleClose();
    } catch (e: any) {
      setError(e?.body?.message || e?.message || 'Erreur inconnue');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      title="Recommander cette compétence"
      open={open}
      onCancel={handleClose}
      onOk={handleSend}
      okText="Envoyer"
      okButtonProps={{ disabled: content.trim().length === 0 }}
      confirmLoading={sending}
      destroyOnHidden
    >
      <Space align="center" style={{ marginBottom: 16 }}>
        <Avatar src={member.photo} icon={!member.photo && <UserOutlined />} />
        <div>
          <Text strong>{member.name}</Text>
          <br />
          <Text type="secondary">
            {skill.skillLabel} · {skill.gradeLabel}
          </Text>
        </div>
      </Space>

      <TextArea
        rows={4}
        placeholder="Je peux témoigner que..."
        value={content}
        onChange={event => setContent(event.target.value)}
        style={{ marginBottom: 16 }}
      />

      <Space align="center" style={{ marginBottom: 8 }}>
        <Switch checked={isPublic} onChange={setIsPublic} />
        <Text>Recommandation publique</Text>
      </Space>

      {ccOptions.length > 0 && (
        <Collapse
          ghost
          size="small"
          items={[
            {
              key: 'cc',
              label: <Text type="secondary">Avertir d'autres contacts (optionnel)</Text>,
              children: (
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Choisir des contacts à avertir par e-mail"
                  style={{ width: '100%' }}
                  value={ccWebIds}
                  onChange={setCcWebIds}
                  options={ccOptions.map(contact => ({ value: contact.webId, label: contact.name }))}
                />
              )
            }
          ]}
        />
      )}

      {error && <Alert style={{ marginTop: 12 }} type="error" message={error} />}
    </Modal>
  );
};

export default EndorseDialog;
