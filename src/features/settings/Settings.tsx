import { useState } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { PageHeader, Tabs, Toast } from '../../components/ui';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import { Categories } from './components/Categories';
import { MealRules } from './components/MealRules';
import { Subscription } from './components/Subscription';
import { Team } from './components/Team';

export default function Settings() {
  const [tab, setTab] = useState<'team' | 'subscription' | 'meals' | 'categories'>('team');
  const [toast, setToast] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Settings" subtitle="Team access, plan, meal rules and categories." />
      <SectionPromoBanner
        eyebrow="ORGANIZATION & CONTROLS"
        title="Enterprise Configuration, Ironclad Security."
        subtitle="Manage team member roles, subscription billing, automated meal rules, and accounting expense categories."
        imageSrc="/owner-assets/hero-interior.jpg"
        primaryAction={{
          label: 'Team & Access',
          onClick: () => setTab('team'),
          icon: ShieldCheck,
        }}
        secondaryAction={{
          label: 'Subscription Plan',
          onClick: () => setTab('subscription'),
          icon: Sparkles,
        }}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'team', label: 'Team & access' },
          { id: 'subscription', label: 'Subscription' },
          { id: 'meals', label: 'Meal rules' },
          { id: 'categories', label: 'Categories' },
        ]}
      />
      {tab === 'team' && <Team onToast={setToast} />}
      {tab === 'subscription' && <Subscription />}
      {tab === 'meals' && <MealRules onToast={setToast} />}
      {tab === 'categories' && <Categories onToast={setToast} />}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
