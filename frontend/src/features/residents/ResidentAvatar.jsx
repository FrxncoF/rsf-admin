import { useState } from 'react';
import { cn, initials } from '@/lib/utils';
import { residentsApi } from './residentsApi';

const SIZES = {
  sm: 'size-9 text-sm',
  md: 'size-12 text-base',
  lg: 'size-24 text-2xl',
};

/** Foto del residente o, si no tiene, sus iniciales. `fill` ocupa todo el contenedor (tarjetas). */
export function ResidentAvatar({ resident, size = 'md', fill = false, className }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = resident.has_photo && !failed;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-accent-100 font-semibold text-accent-800',
        fill ? 'size-full' : cn('rounded-full', SIZES[size]),
        className,
      )}
    >
      {showPhoto ? (
        <img
          src={residentsApi.photoUrl(resident)}
          alt={`${resident.first_name} ${resident.last_name}`}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={fill ? 'text-4xl' : undefined} aria-hidden="true">
          {initials(resident.first_name, resident.last_name)}
        </span>
      )}
    </div>
  );
}
