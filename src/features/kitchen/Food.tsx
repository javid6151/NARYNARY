import { useState } from 'react';
import { Users, UtensilsCrossed } from 'lucide-react';
import { useBuilding } from '../access/useBuilding';
import { Tabs } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import { MealReviews } from './components/MealReviews';
import { TodayHeadcount } from './components/TodayHeadcount';
import { WeekPlanner } from './components/WeekPlanner';

export default function Food() {
  const { buildingId } = useBuilding();
  const [tab, setTab] = useState<'today' | 'week' | 'reviews'>('today');
  return (
    <>
      <SectionPromoBanner
        fromTop
        eyebrow="NUTRITION & DINING"
        title="Wholesome Daily Meals, Delighted Residents."
        subtitle="Plan breakfast, lunch, and dinner menus with live resident headcounts and rating feedback."
        imageSrc="/owner-assets/food-hero.jpg"
        controls={<BuildingPicker />}
        primaryAction={{
          label: tab === 'week' ? 'Weekly Menu Planner' : 'Plan Weekly Menu',
          onClick: () => setTab('week'),
          icon: UtensilsCrossed,
        }}
        secondaryAction={{
          label: 'Headcount Summary',
          onClick: () => setTab('today'),
          icon: Users,
        }}
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
