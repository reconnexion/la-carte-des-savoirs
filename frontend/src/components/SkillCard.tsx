import { useEffect, useRef, useState } from 'react';
import { Avatar, Typography, Tag, Space, Button, List, Popconfirm, App } from 'antd';
import { PlusOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { fetchJson } from '@activitypods/refine-providers/utils';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import type { NetworkMember, NetworkSkill } from '../hooks/useNetworkSkills';
import { useEndorsements } from '../hooks/useEndorsements';
import type { Endorsement } from '../hooks/useEndorsements';
import { getCategoryIcon } from '../config/categoryIcons';
import { GRADE_COLORS } from '../config/gradeColors';
import { openAppProfileUrl } from '../config/openApp';
import { authProvider } from '../providers';
import EndorseDialog from './EndorseDialog';

const { Text, Paragraph } = Typography;

// Antd v5 dropped the Comment component (the older docs some people still land on are the v4
// site) — this recreates the same visual shape (avatar, author + datetime, content) with a plain
// List instead of pulling in a separate dependency for it.
const formatEndorsementDate = (iso?: string) => (iso ? dayjs(iso).locale('fr').format('D MMM YYYY') : undefined);

/** Links out to the recommender's profile on the Pod provider frontend itself (same openApp
 * mechanism Welcome To My Place uses) — except for an unresolved "Inconnu" recommender, who has
 * nowhere useful to link to. stopPropagation because these avatars often sit inside a clickable
 * row (the stacked-avatars summary toggles the expanded list on click). */
const EndorserAvatar = ({ endorsement, size, viewerWebId }: { endorsement: Endorsement; size?: number; viewerWebId?: string }) => {
  const avatar = <Avatar size={size} src={endorsement.photo} icon={!endorsement.photo && <UserOutlined />} />;
  if (!viewerWebId || !endorsement.known || !endorsement.profileUri) return avatar;
  return (
    <a
      href={openAppProfileUrl(viewerWebId, endorsement.profileUri)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={event => event.stopPropagation()}
    >
      {avatar}
    </a>
  );
};

const STACK_LIMIT = 3;
// A recommendation only shows up here once the recommended person's own backend has processed
// the Endorse activity it received (apods:recommendedBy is added asynchronously) — same for its
// removal after an Undo. There's no push signal for "it's done now", so a one-shot delayed
// refetch is the simplest way to pick it up without the user having to reload the page.
const REFETCH_DELAY_MS = 30000;

const AS_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';
const APODS_RECOMMENDED_BY = ['http://activitypods.org/ns/core#recommendedBy', 'apods:recommendedBy'];

const asId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return (value as any).id || (value as any)['@id'];
  return undefined;
};

const asArray = <T,>(value: T | T[] | undefined): T[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

const fetchRecommendationUris = async (skillUri: string, token?: string): Promise<string[]> => {
  try {
    const headers: Record<string, string> = { Accept: 'application/ld+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(skillUri, { headers });
    if (!response.ok) return [];
    const body = await response.json();
    const resource = Array.isArray(body) ? body[0] : body;
    for (const key of APODS_RECOMMENDED_BY) {
      if (resource[key] !== undefined) return asArray(resource[key]).map(asId).filter(Boolean) as string[];
    }
    return [];
  } catch {
    return [];
  }
};

type Props = {
  member: NetworkMember;
  skill: NetworkSkill;
  /** Only for the connected user's own skills — a private recommendation addressed to them needs
   * their own auth to be readable at all, same convention as useNetworkSkills. */
  token?: string;
};

/** One skill, always showing its own label/grade/comment (no fold-away — the person's skills and
 * words are the point of the drawer), with its recommendations (stacked avatars, expandable) and
 * a way to add one of your own underneath. */
const SkillCard = ({ member, skill, token }: Props) => {
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<{ id: string }>();
  const [recommendationUris, setRecommendationUris] = useState(skill.recommendationUris);
  useEffect(() => setRecommendationUris(skill.recommendationUris), [skill.recommendationUris]);

  const { endorsements, loading } = useEndorsements(recommendationUris, token);
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingUri, setDeletingUri] = useState<string>();
  const refetchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(refetchTimer.current), []);

  const scheduleRefetch = () => {
    clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(async () => {
      setRecommendationUris(await fetchRecommendationUris(skill.uri, token));
    }, REFETCH_DELAY_MS);
  };

  const handleDelete = async (endorsementUri: string) => {
    setDeletingUri(endorsementUri);
    try {
      const session = authProvider.getSession();
      if (!session || !identity) throw new Error('Not authenticated');
      const { json: myActor } = await fetchJson(identity.id, {}, session.token);
      const outboxUri = myActor?.outbox;
      if (!outboxUri) throw new Error("Impossible de trouver votre boîte d'envoi (outbox)");

      await fetchJson(
        outboxUri,
        {
          method: 'POST',
          body: JSON.stringify({
            '@context': 'https://www.w3.org/ns/activitystreams',
            type: 'Undo',
            object: endorsementUri,
            to: [member.webId, AS_PUBLIC]
          })
        },
        session.token
      );

      // Optimistic: the recipient's own backend removes apods:recommendedBy asynchronously, same
      // as adding one — hide it locally right away, then reconcile with a delayed refetch.
      setRecommendationUris(uris => uris.filter(uri => uri !== endorsementUri));
      scheduleRefetch();
    } catch (e: any) {
      message.error(e?.body?.message || e?.message || "Impossible de retirer cette recommandation");
    } finally {
      setDeletingUri(undefined);
    }
  };

  return (
    <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f0f0f0' }}>
      <Space align="center">
        <Avatar size={32} icon={getCategoryIcon(skill.categoryLabel)} style={{ background: '#e6f4ff', color: '#1677ff' }} />
        <Text strong>{skill.skillLabel}</Text>
        <Tag color={GRADE_COLORS[skill.gradePosition] ?? 'default'}>{skill.gradeLabel}</Tag>
      </Space>

      {skill.summary && (
        <Paragraph style={{ marginTop: 8, marginBottom: 8 }} type="secondary">
          {skill.summary}
        </Paragraph>
      )}

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {endorsements.length > 0 ? (
          <Space style={{ cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
            <Avatar.Group max={{ count: STACK_LIMIT }} size="small">
              {endorsements.map(endorsement => (
                <EndorserAvatar key={endorsement.uri} endorsement={endorsement} viewerWebId={identity?.id} />
              ))}
            </Avatar.Group>
            <Text type="secondary">
              {endorsements.length} recommandation{endorsements.length > 1 ? 's' : ''}
            </Text>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {loading ? '' : 'Aucune recommandation pour l’instant'}
          </Text>
        )}

        {!member.isSelf && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => setDialogOpen(true)}>
            Recommander
          </Button>
        )}
      </div>

      {expanded && endorsements.length > 0 && (
        <List
          style={{ marginTop: 12 }}
          size="small"
          dataSource={endorsements}
          renderItem={endorsement => (
            <List.Item
              actions={
                endorsement.recommenderWebId === identity?.id
                  ? [
                      <Popconfirm
                        key="delete"
                        title="Retirer cette recommandation ?"
                        onConfirm={() => handleDelete(endorsement.uri)}
                        okText="Retirer"
                        cancelText="Annuler"
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          loading={deletingUri === endorsement.uri}
                        />
                      </Popconfirm>
                    ]
                  : undefined
              }
            >
              <List.Item.Meta
                avatar={<EndorserAvatar endorsement={endorsement} viewerWebId={identity?.id} />}
                title={
                  <Space size={8}>
                    <Text strong>{endorsement.name}</Text>
                    {endorsement.published && (
                      <Text type="secondary" style={{ fontWeight: 'normal', fontSize: 12 }}>
                        {formatEndorsementDate(endorsement.published)}
                      </Text>
                    )}
                  </Space>
                }
                description={endorsement.content}
              />
            </List.Item>
          )}
        />
      )}

      {!member.isSelf && (
        <EndorseDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          member={member}
          skill={skill}
          onSent={scheduleRefetch}
        />
      )}
    </div>
  );
};

export default SkillCard;
