/** One chat, full screen (`/resident/community/chat/:id`). Opening and leaving it marks it read. */
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../../../lib/hooks';
import { Async, Empty } from '../../../components/ui';
import { useAuth } from '../../access/useAuth';
import { ChatThread } from '../../communication/components/ChatThread';
import { getChatOverview, markChannelRead } from '../../community/api';
import { TopBar } from '../ui/Headers';

export function ChatScreen() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const st = useAsync(() => getChatOverview(), []);
  const ch = (st.data ?? []).find((c) => c.id === id);

  useEffect(() => {
    if (!id) return;
    markChannelRead(id).catch(() => undefined);
    return () => {
      markChannelRead(id).catch(() => undefined);
    };
  }, [id]);

  return (
    <>
      <TopBar title={ch?.name ?? 'Chat'} back="/resident/community" />
      <Async state={st}>
        {() =>
          !ch ? (
            <Empty title="Chat not found" />
          ) : (
            <div className="bg-white border border-line rounded-2xl overflow-hidden flex flex-col h-[calc(100dvh-170px)]">
              <ChatThread channel={ch} me={session?.user.id ?? ''} staffView={false} />
            </div>
          )
        }
      </Async>
    </>
  );
}
