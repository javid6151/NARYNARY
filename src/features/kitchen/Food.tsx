/** Food / Mess page (owner/manager): today's headcount, weekly menu planner, and meal reviews. */
import { useState } from 'react';
import { useBuilding } from '../access/useBuilding';
import { PageHeader, Tabs } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { MealReviews } from './components/MealReviews';
import { TodayHeadcount } from './components/TodayHeadcount';
import { WeekPlanner } from './components/WeekPlanner';

export default function Food() {
  const { buildingId } = useBuilding();
  const [tab, setTab] = useState<'today' | 'week' | 'reviews'>('today');
  return (
    <>
      <PageHeader
        title="Food / Mess"
        subtitle="Plan menus, see live headcounts from residents’ meal responses, and read reviews."
        actions={<BuildingPicker />}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'today', label: 'Today & headcount' },
          { id: 'week', label: 'Weekly menu planner' },
          { id: 'reviews', label: 'Reviews & ratings' },
        ]}
      />
      {buildingId &&
        (tab === 'today' ? (
          <TodayHeadcount buildingId={buildingId} />
        ) : tab === 'week' ? (
          <WeekPlanner buildingId={buildingId} />
        ) : (
          <MealReviews buildingId={buildingId} />
        ))}
    </>
  );
}
