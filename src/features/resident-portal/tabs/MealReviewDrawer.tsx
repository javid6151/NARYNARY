/** 1–5 star rating with an optional comment for a served meal. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { cx } from '../../../lib/cx';
import { Button, Drawer, ErrorBanner, Field, Textarea } from '../../../components/ui';
import { submitMealReview } from '../api';

export function MealReviewDrawer({ menu, onClose, onDone }: {
  menu: { id: string; meal: string; items: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const m = useMutation(() => submitMealReview(menu.id, rating, comment || null));

  const footer = (
    <Button
      busy={m.busy}
      disabled={!rating}
      onClick={async () => {
        if ((await m.run()) !== undefined) onDone();
      }}
    >
      Submit review
    </Button>
  );

  return (
    <Drawer open onClose={onClose} title={`Rate ${menu.meal}`} footer={footer}>
      <p className="text-[13px]">{menu.items}</p>
      <ErrorBanner error={m.error} />
      <div role="radiogroup" aria-label="Rating" className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => setRating(n)}
            className={cx(
              'size-11 rounded-lg border text-xl cursor-pointer',
              n <= rating ? 'border-warn bg-warn-bg text-warn' : 'border-line text-line',
            )}
          >
            ★
          </button>
        ))}
      </div>
      <Field label="Comments (optional)">
        {(id) => (
          <Textarea
            id={id}
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Please reduce oil in sabzi"
          />
        )}
      </Field>
    </Drawer>
  );
}
