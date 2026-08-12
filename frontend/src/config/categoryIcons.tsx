import {
  CoffeeOutlined,
  SunOutlined,
  ToolOutlined,
  LaptopOutlined,
  MedicineBoxOutlined,
  BulbOutlined,
  HomeOutlined,
  CarOutlined,
  ReadOutlined,
  BankOutlined,
  TeamOutlined,
  SmileOutlined,
  TagOutlined
} from '@ant-design/icons';

// Keyed by category label rather than id: ids are backend-generated slugs, labels are the
// stable, human-authored part of skills-catalog-fr.json. Shared between CategoryMenu (left menu)
// and MemberDrawer (right panel), so both show the same icon per category.
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Alimentation et cuisine': <CoffeeOutlined />,
  'Jardinage et nature': <SunOutlined />,
  'Bricolage et fabrication': <ToolOutlined />,
  'Numérique et informatique': <LaptopOutlined />,
  'Bien-être et santé': <MedicineBoxOutlined />,
  'Arts et créativité': <BulbOutlined />,
  'Savoirs de la maison': <HomeOutlined />,
  'Mobilité et mécanique': <CarOutlined />,
  'Éducation et langues': <ReadOutlined />,
  'Administratif et juridique': <BankOutlined />,
  'Communication et organisation': <TeamOutlined />,
  'Savoir-être et entraide': <SmileOutlined />
};

export const getCategoryIcon = (label?: string): React.ReactNode => (label && CATEGORY_ICONS[label]) || <TagOutlined />;
