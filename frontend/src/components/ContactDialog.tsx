import { useState } from 'react';
import { Modal, Input, Avatar, Space, Typography, Alert, App } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { fetchJson } from '@activitypods/refine-providers/utils';
import { authProvider } from '../providers';
import type { NetworkMember } from '../hooks/useNetworkSkills';

const { Text } = Typography;
const { TextArea } = Input;

type Props = {
  open: boolean;
  onClose: () => void;
  member: NetworkMember;
};

/**
 * Sends a plain as:Note to the recipient's outbox — activitypub.object.wrap auto-wraps it into a
 * Create (Note is one of the standard AS2 OBJECT_TYPES), and the Pod provider's own native
 * contacts.message service (not anything of ours) then adds the recipient to the sender's
 * contacts WebACL group and emails them, exactly like the messaging already built into the Pod
 * provider frontend/Arena. No app-specific backend handling needed for this at all.
 */
const ContactDialog = ({ open, onClose, member }: Props) => {
  const { message: messageApi } = App.useApp();
  const { data: identity } = useGetIdentity<{ id: string }>();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const reset = () => {
    setSubject('');
    setContent('');
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

      await fetchJson(
        outboxUri,
        {
          method: 'POST',
          body: JSON.stringify({
            '@context': 'https://www.w3.org/ns/activitystreams',
            type: 'Note',
            attributedTo: identity.id,
            to: [member.webId],
            summary: subject || undefined,
            content
          })
        },
        session.token
      );

      messageApi.success('Message envoyé !');
      handleClose();
    } catch (e: any) {
      setError(e?.body?.message || e?.message || 'Erreur inconnue');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      title="Contacter"
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
        <Text strong>{member.name}</Text>
      </Space>

      <Input
        placeholder="Sujet (optionnel)"
        value={subject}
        onChange={event => setSubject(event.target.value)}
        style={{ marginBottom: 12 }}
      />

      <TextArea
        rows={5}
        placeholder="Votre message..."
        value={content}
        onChange={event => setContent(event.target.value)}
      />

      {error && <Alert style={{ marginTop: 12 }} type="error" message={error} />}
    </Modal>
  );
};

export default ContactDialog;
