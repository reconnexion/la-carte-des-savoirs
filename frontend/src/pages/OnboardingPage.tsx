import { useState } from 'react';
import { Layout, Steps, Card, Select, Radio, Input, Button, List, Tag, Checkbox, Alert, Typography, Space, Result, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { useCreate, useOne, useUpdate } from '@refinedev/core';
import { fetchJson } from '@activitypods/refine-providers/utils';
import { useCatalogs } from '../hooks/useCatalogs';
import { useOwnProfile } from '../hooks/useOwnProfile';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { parseAddressFeature } from '../config/mapbox';
import type { MapboxFeature } from '../config/mapbox';
import type { SkillCatalogEntry, GradeCatalogEntry } from '../config/catalog';
import { authProvider } from '../providers';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const asId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return (value as any).id || (value as any)['@id'];
  return undefined;
};

type AddedSkill = { skillId: string; skillLabel: string; gradeId: string; gradeLabel: string; summary?: string };

const AddSkillsStep = ({
  skills,
  grades,
  added,
  setAdded,
  onNext
}: {
  skills: SkillCatalogEntry[];
  grades: GradeCatalogEntry[];
  added: AddedSkill[];
  setAdded: (skills: AddedSkill[]) => void;
  onNext: () => void;
}) => {
  const { mutateAsync: createExperience, mutation } = useCreate();
  const creating = mutation.isPending;
  const [categoryId, setCategoryId] = useState<string>();
  const [skillId, setSkillId] = useState<string>();
  const [gradeId, setGradeId] = useState<string>(grades[0]?.id);
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categories = skills.filter(skill => !skill.parentId);
  const preciseSkills = skills.filter(skill => skill.parentId === categoryId);

  const handleAdd = () => {
    const skill = skills.find(entry => entry.id === skillId);
    const grade = grades.find(entry => entry.id === gradeId);
    if (!skill || !grade) return;

    setAdded([...added, { skillId: skill.id, skillLabel: skill.label, gradeId: grade.id, gradeLabel: grade.label, summary }]);
    setCategoryId(undefined);
    setSkillId(undefined);
    setSummary('');
  };

  const handleRemove = (index: number) => setAdded(added.filter((_, i) => i !== index));

  const handleNext = async () => {
    setSubmitting(true);
    try {
      // Created one by one: the backend's onCreate hook (experience.service.js) makes each one
      // publicly readable and links it from the user's profile as it's created.
      for (const skill of added) {
        await createExperience({
          resource: 'experiences',
          values: {
            'http://virtual-assembly.org/ontologies/pair#experienceSkill': { '@id': skill.skillId },
            'http://virtual-assembly.org/ontologies/pair#experienceGrade': { '@id': skill.gradeId },
            ...(skill.summary ? { 'https://www.w3.org/ns/activitystreams#summary': skill.summary } : {})
          }
        });
      }
      onNext();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <Title level={4}>Vos compétences</Title>
      <Paragraph>
        Ajoutez au moins une compétence pour apparaître sur la carte. N'hésitez pas à indiquer "Débutant" : le but de
        la carte est de favoriser l'apprentissage de tous, pas seulement de montrer des experts !
      </Paragraph>

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space wrap>
          <Select
            style={{ width: 220 }}
            placeholder="Catégorie"
            value={categoryId}
            onChange={value => {
              setCategoryId(value);
              setSkillId(undefined);
            }}
            options={categories.map(category => ({ value: category.id, label: category.label }))}
          />
          <Select
            style={{ width: 260 }}
            placeholder="Compétence précise"
            value={skillId}
            disabled={!categoryId}
            onChange={setSkillId}
            options={preciseSkills.map(skill => ({ value: skill.id, label: skill.label }))}
          />
        </Space>

        <Radio.Group value={gradeId} onChange={event => setGradeId(event.target.value)} optionType="button">
          {grades.map(grade => (
            <Radio.Button key={grade.id} value={grade.id}>
              {grade.label}
            </Radio.Button>
          ))}
        </Radio.Group>

        <TextArea
          placeholder="Dites-en un peu plus sur votre expérience (facultatif)"
          value={summary}
          onChange={event => setSummary(event.target.value)}
          rows={2}
        />

        <Button type="dashed" icon={<PlusOutlined />} onClick={handleAdd} disabled={!skillId || !gradeId}>
          Ajouter cette compétence
        </Button>
      </Space>

      <List
        style={{ marginTop: 24 }}
        dataSource={added}
        renderItem={(item, index) => (
          <List.Item actions={[<Button type="text" icon={<DeleteOutlined />} onClick={() => handleRemove(index)} />]}>
            {item.skillLabel} <Tag>{item.gradeLabel}</Tag>
          </List.Item>
        )}
      />

      <Button type="primary" style={{ marginTop: 24 }} disabled={added.length === 0} loading={submitting || creating} onClick={handleNext}>
        Suivant
      </Button>
    </Card>
  );
};

const AddressConsentStep = ({ onNext }: { onNext: () => void }) => {
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [error, setError] = useState<string>();

  const { profile, isLoading: profileLoading, refetch: refetchProfile } = useOwnProfile();
  const locationUri = asId(profile?.['vcard:hasAddress']);

  const { result: location, query: locationQuery } = useOne({
    resource: 'location',
    id: locationUri,
    queryOptions: { enabled: Boolean(locationUri) }
  });
  const currentAddressLabel = (location as any)?.['vcard:hasAddress']?.['vcard:given-name'];

  const { mutateAsync: createLocation } = useCreate();
  const { mutateAsync: updateLocation } = useUpdate();
  const { mutateAsync: updateProfile } = useUpdate();

  const handleSelectAddress = async (feature: MapboxFeature) => {
    setSavingAddress(true);
    setError(undefined);
    try {
      const addressFields = parseAddressFeature(feature);

      if (locationUri) {
        // Update the existing Location resource in place — keeps the same URI, so nothing else
        // (profile pointer, any already-shared permission) needs to change.
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
      setEditingAddress(false);
    } catch (e) {
      setError("Impossible d'enregistrer cette adresse pour le moment.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleNext = async () => {
    if (!consent) {
      onNext();
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const session = authProvider.getSession();
      if (!session) throw new Error('Not authenticated');

      // There is no supported way for our backend to expose its own Bearer-verified HTTP
      // endpoint (see sharing.service.js), so we signal intent through the user's own Pod
      // instead: post a custom activity to their outbox, which our backend listens to.
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
      onNext();
    } catch (e) {
      setError(
        "Nous n'avons pas pu partager votre adresse pour le moment. Vous pourrez réessayer plus tard depuis votre profil."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <Title level={4}>Votre adresse</Title>
      <Paragraph>
        Pour apparaître sur la carte, vos contacts doivent pouvoir voir votre adresse approximative. Vous pouvez
        l'ajouter ou la modifier ici — elle sera aussi visible et modifiable depuis votre{' '}
        <Text strong>gestionnaire de porte-données</Text> (le tableau de bord de votre Pod ActivityPods).
      </Paragraph>

      {profileLoading ? (
        <Spin />
      ) : (
        <div style={{ marginBottom: 24 }}>
          {locationUri && !editingAddress ? (
            <Space>
              <EnvironmentOutlined />
              <Text>{locationQuery.isLoading ? <Spin size="small" /> : currentAddressLabel || 'Adresse enregistrée'}</Text>
              <Button size="small" icon={<EditOutlined />} onClick={() => setEditingAddress(true)}>
                Modifier
              </Button>
            </Space>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              <AddressAutocomplete onSelect={handleSelectAddress} />
              {savingAddress && <Spin size="small" />}
              {locationUri && (
                <Button size="small" onClick={() => setEditingAddress(false)}>
                  Annuler
                </Button>
              )}
            </Space>
          )}
        </div>
      )}

      <Paragraph type="secondary">
        Une fois partagée, votre adresse reste visible par toute personne connaissant son adresse web exacte, même si
        vous retirez un contact par la suite — comme pour vos compétences, "La Carte des Savoirs" ne l'affiche
        cependant jamais qu'à vos contacts actuels.
      </Paragraph>

      <Checkbox checked={consent} disabled={!locationUri} onChange={event => setConsent(event.target.checked)}>
        Partager mon adresse avec mes contacts
      </Checkbox>

      {error && <Alert style={{ marginTop: 16 }} type="error" message={error} />}

      <div>
        <Button type="primary" style={{ marginTop: 24 }} loading={submitting} onClick={handleNext}>
          Suivant
        </Button>
      </div>
    </Card>
  );
};

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { skills, grades, loading } = useCatalogs();
  const [step, setStep] = useState(0);
  const [added, setAdded] = useState<AddedSkill[]>([]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ maxWidth: 720, margin: '48px auto', width: '100%', padding: '0 24px' }}>
        <Steps
          current={step}
          items={[{ title: 'Vos compétences' }, { title: 'Votre position' }, { title: 'C\'est parti' }]}
          style={{ marginBottom: 32 }}
        />

        {loading && <Card loading />}

        {!loading && step === 0 && (
          <AddSkillsStep skills={skills} grades={grades} added={added} setAdded={setAdded} onNext={() => setStep(1)} />
        )}

        {!loading && step === 1 && <AddressConsentStep onNext={() => setStep(2)} />}

        {!loading && step === 2 && (
          <Result
            status="success"
            title="Votre profil est prêt !"
            subTitle="Vos compétences seront visibles par vos contacts actuels, et par tout nouveau contact que vous ajouterez."
            extra={
              <Button type="primary" onClick={() => navigate('/')}>
                Voir la carte
              </Button>
            }
          />
        )}
      </Content>
    </Layout>
  );
};

export default OnboardingPage;
