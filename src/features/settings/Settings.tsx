import { useState } from 'react';
import { ShieldCheck, User } from 'lucide-react';
import { Tabs, Toast } from '../../components/ui';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import { Categories } from './components/Categories';
import { MealRules } from './components/MealRules';
import { ProfileSettings } from './components/ProfileSettings';
import { Subscription } from './components/Subscription';
import { Team } from './components/Team';

export default function Settings() {
  const [tab, setTab] = useState<'profile' | 'team' | 'subscription' | 'meals' | 'categories'>('profile');
  const [toast, setToast] = useState<string | null>(null);
  return (
    <>
      <SectionPromoBanner
        fromTop
        eyebrow="ORGANIZATION & CONTROLS"
        title="Enterprise Configuration, Ironclad Security."
        subtitle="Manage your personal profile, team member roles, subscription billing, automated meal rules, and accounting expense categories."
        imageSrc="/owner-assets/hero-interior.jpg"
        primaryAction={{
          label: 'Owner Profile',
          onClick: () => setTab('profile'),
          icon: User,
        }}
        secondaryAction={{
          label: 'Team & Access',
          onClick: () => setTab('team'),
          icon: ShieldCheck,
        }}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'profile', label: 'Owner Profile' },
          { id: 'team', label: 'Team & access' },
          { id: 'subscription', label: 'Subscription' },
          { id: 'meals', label: 'Meal rules' },
          { id: 'categories', label: 'Categories' },
        ]}
      />
      {tab === 'profile' && <ProfileSettings onToast={setToast} />}
      {tab === 'team' && <Team onToast={setToast} onEditProfile={() => setTab('profile')} />}
      {tab === 'subscription' && <Subscription />}
      {tab === 'meals' && <MealRules onToast={setToast} />}
      {tab === 'categories' && <Categories onToast={setToast} />}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
