/** Round initial badge for an inventory item, coloured by category (no stock photos needed). */
import { cx } from '../../../../lib/cx';

const TONE: Record<string, string> = {
  'Grains & Rice': 'bg-[#f3ead8] text-[#8a6a1f]',
  'Pulses & Lentils': 'bg-[#fbefcf] text-[#a07400]',
  Vegetables: 'bg-[#fde8e8] text-[#b42318]',
  'Cooking Oil & Ghee': 'bg-[#fff6d6] text-[#a47b00]',
  'Spices & Masala': 'bg-[#fff0e0] text-[#c2580c]',
  'Dairy Products': 'bg-[#e8f1fb] text-[#2457a7]',
  Beverages: 'bg-[#efe7dc] text-[#6b4423]',
  'Non-Veg Items': 'bg-[#fdecea] text-[#9b1c1c]',
};

export function ItemAvatar({ name, category, size = 40 }: { name: string; category?: string | null; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cx('rounded-full grid place-items-center font-semibold shrink-0', TONE[category ?? ''] ?? 'bg-kitchen-50 text-kitchen')}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
