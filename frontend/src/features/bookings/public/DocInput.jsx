import { useState } from 'react';
import { Field, Input } from '@/components/ui/Form';
import { cn } from '@/lib/utils';
import { formatRut, isValidRut } from '@/lib/rut';

/** RUT chileno (validado con dígito verificador) u otro documento para quien no tiene RUT. */
export function DocInput({ docType, docNumber, onChange, error }) {
  const [touched, setTouched] = useState(false);
  const isRut = docType === 'RUT';
  const rutOk = isRut && isValidRut(docNumber);
  const liveError = isRut && touched && docNumber && !rutOk ? 'RUT inválido: revisa los números y el dígito verificador' : undefined;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
        {[
          ['RUT', 'Tengo RUT'],
          ['OTRO', 'No tengo RUT chileno'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTouched(false);
              onChange({ docType: value, docNumber: '' });
            }}
            className={cn(
              'rounded-lg px-3 py-2 font-medium transition',
              docType === value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <Field
        label={isRut ? 'Tu RUT' : 'Pasaporte u otro documento'}
        htmlFor="doc_number"
        error={error || liveError}
        hint={rutOk ? 'RUT válido ✓' : isRut ? 'Ej: 12.345.678-5' : 'Lo usarás para cancelar la reserva si lo necesitas'}
      >
        <Input
          id="doc_number"
          className="h-12 text-base"
          inputMode={isRut ? 'text' : undefined}
          autoComplete="off"
          placeholder={isRut ? '12.345.678-5' : 'N° de documento'}
          value={docNumber}
          onChange={(e) => onChange({ docType, docNumber: isRut ? formatRut(e.target.value) : e.target.value.slice(0, 20) })}
          onBlur={() => setTouched(true)}
          aria-invalid={!!(error || liveError) || undefined}
        />
      </Field>
    </div>
  );
}

export const docIsValid = (docType, docNumber) => (docType === 'RUT' ? isValidRut(docNumber) : docNumber.trim().length >= 3);
