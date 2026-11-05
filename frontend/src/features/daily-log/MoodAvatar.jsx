import { cn } from '@/lib/utils';
import { ResidentAvatar } from '@/features/residents/ResidentAvatar';
import { moodByValue } from './options';

const BUBBLE = {
  sm: 'size-5 text-xs -bottom-0.5 -right-0.5',
  md: 'size-6 text-sm -bottom-0.5 -right-0.5',
  lg: 'size-9 text-xl bottom-0 right-0',
};

/**
 * Avatar del residente con la carita del último ánimo registrado.
 * Pensado para reutilizarse en la lista de residentes cuando el API entregue `last_mood`.
 */
export function MoodAvatar({ resident, mood, size = 'md', className }) {
  const m = moodByValue(mood);
  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      <ResidentAvatar resident={resident} size={size} />
      {m && (
        <span
          className={cn('absolute flex items-center justify-center rounded-full bg-white shadow ring-2 ring-white', BUBBLE[size])}
          title={`Ánimo: ${m.label}`}
          aria-label={`Ánimo: ${m.label}`}
        >
          {m.emoji}
        </span>
      )}
    </div>
  );
}
