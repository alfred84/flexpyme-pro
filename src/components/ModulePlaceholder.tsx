import { Construction } from "lucide-react";

interface ModulePlaceholderProps {
  title: string;
  description: string;
}

/**
 * Placeholder temporal para módulos en construcción (se sustituye al implementar
 * cada módulo de la v2).
 *
 * @param props - Título y descripción del módulo.
 * @returns Tarjeta de "en construcción".
 */
export function ModulePlaceholder(props: ModulePlaceholderProps) {
  const { title, description } = props;
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="card max-w-md bg-base-200">
        <div className="card-body items-center text-center">
          <Construction className="h-12 w-12 text-warning" />
          <h2 className="card-title">{title}</h2>
          <p className="text-sm text-base-content/70">{description}</p>
        </div>
      </div>
    </section>
  );
}
