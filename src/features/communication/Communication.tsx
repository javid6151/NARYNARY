/**
 * Staff Communication page: building/floor/room chats, the notices board, polls, resident posts
 * (suggestions, feedback, lost & found, marketplace) and visitor passes.
 */
import { useState } from 'react';
import { useBuilding } from '../access/useBuilding';
import { PageHeader, Tabs, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { Chat } from './components/Chat';
import { Notices } from './components/Notices';
import { PollsAdmin } from './components/PollsAdmin';
import { ResidentPosts } from './components/ResidentPosts';
import { VisitorPassesAdmin } from './components/VisitorPassesAdmin';

type Tab = 'chat' | 'notices' | 'polls' | 'posts' | 'visitors';

export default function Communication() {
  const { buildingId } = useBuilding();
  const [tab, setTab] = useState<Tab>('chat');
  const [toast, setToast] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title="Communication"
        subtitle="Chats, notices, polls, resident posts and visitor passes for the selected building."
        actions={<BuildingPicker />}
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'chat', label: 'Chats' },
          { id: 'notices', label: 'Notices & announcements' },
          { id: 'polls', label: 'Polls' },
          { id: 'posts', label: 'Resident posts' },
          { id: 'visitors', label: 'Visitor passes' },
        ]}
      />
      {tab === 'chat' && <Chat buildingId={buildingId} staffView />}
      {tab === 'notices' && <Notices onToast={setToast} />}
      {tab === 'polls' && <PollsAdmin onToast={setToast} />}
      {tab === 'posts' && <ResidentPosts onToast={setToast} />}
      {tab === 'visitors' && <VisitorPassesAdmin onToast={setToast} />}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
