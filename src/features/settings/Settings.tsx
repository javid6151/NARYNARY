/** Owner-only Settings page: team access, subscription, meal rules and categories. */
import { useState } from 'react';
import { PageHeader, Tabs, Toast } from '../../components/ui';
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
