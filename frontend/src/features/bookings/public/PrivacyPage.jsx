import { PublicShell } from './PublicShell';

/**
 * Aviso de privacidad de la página de reservas (Ley 19.628 / Ley 21.719).
 * Texto base: conviene que lo revise el abogado de la residencia.
 */
export default function PrivacyPage() {
  return (
    <PublicShell title="Privacidad de tus datos">
      <div className="space-y-4 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">¿Quién usa tus datos?</h2>
          <p>Residencia San Francisco, para gestionar las visitas a sus residentes.</p>
        </section>
        <section>
          <h2 className="font-semibold text-slate-900">¿Qué datos pedimos y para qué?</h2>
          <p>
            Nombre, apellido, RUT u otro documento y teléfono, junto con el residente que visitas y el horario elegido. Los usamos solo para
            organizar las visitas, verificar que correspondan a la familia del residente y contactarte si hay que cambiar o cancelar la visita.
            No los compartimos con terceros ni los usamos para publicidad.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-slate-900">¿Qué mostramos en esta página?</h2>
          <p>
            Para proteger a los residentes y a sus familias, en esta página solo mostramos datos parciales: el nombre corto del residente y tus
            datos de contacto ocultos en parte.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-slate-900">¿Cuánto tiempo los guardamos?</h2>
          <p>
            Si no eres apoderado registrado, tus datos personales se eliminan automáticamente 12 meses después de la visita. Los de apoderados
            registrados se mantienen mientras dure el contrato del residente.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-slate-900">Tus derechos</h2>
          <p>
            Puedes pedir acceder a tus datos, corregirlos o eliminarlos comunicándote directamente con la administración de la residencia.
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
