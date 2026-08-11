import { useState } from 'react';
import { Layout, Steps, Card, Button, List, Tag, Typography, Result } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { useCreate } from '@refinedev/core';
import { useCatalogs } from '../hooks/useCatalogs';
import SkillPicker from '../components/SkillPicker';
import type { PickedSkill } from '../components/SkillPicker';
import AddressEditor from '../components/AddressEditor';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const AddSkillsStep = ({
  skills,
  grades,
  added,
  setAdded,
  onNext
}: {
  skills: import('../config/catalog').SkillCatalogEntry[];
  grades: import('../config/catalog').GradeCatalogEntry[];
  added: PickedSkill[];
  setAdded: (skills: PickedSkill[]) => void;
  onNext: () => void;
}) => {
  const { mutateAsync: createExperience, mutation } = useCreate();
  const [submitting, setSubmitting] = useState(false);

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

      <SkillPicker skills={skills} grades={grades} onAdd={pick => setAdded([...added, pick])} />

      <List
        style={{ marginTop: 24 }}
        dataSource={added}
        renderItem={(item, index) => (
          <List.Item actions={[<Button type="text" icon={<DeleteOutlined />} onClick={() => handleRemove(index)} />]}>
            {item.skillLabel} <Tag>{item.gradeLabel}</Tag>
          </List.Item>
        )}
      />

      <Button
        type="primary"
        style={{ marginTop: 24 }}
        disabled={added.length === 0}
        loading={submitting || mutation.isPending}
        onClick={handleNext}
      >
        Suivant
      </Button>
    </Card>
  );
};

const AddressConsentStep = ({ onNext }: { onNext: () => void }) => (
  <Card>
    <Title level={4}>Votre adresse</Title>
    <Paragraph>
      Pour apparaître sur la carte, ajoutez votre adresse approximative ici — elle sera aussi visible et modifiable
      depuis votre gestionnaire de porte-données (le tableau de bord de votre Pod ActivityPods). Vous pouvez aussi
      passer cette étape et l'ajouter plus tard depuis votre profil.
    </Paragraph>

    <div style={{ marginBottom: 24 }}>
      <AddressEditor />
    </div>

    <Button type="primary" onClick={onNext}>
      Suivant
    </Button>
  </Card>
);

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { skills, grades, loading } = useCatalogs();
  const [step, setStep] = useState(0);
  const [added, setAdded] = useState<PickedSkill[]>([]);

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
