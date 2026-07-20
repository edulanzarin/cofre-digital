"use client";

// Esqueletos de carregamento. A ideia é mostrar a FORMA do conteúdo que vem
// (linhas, avatares, colunas), não um retângulo cinza genérico — assim a
// página não "salta" quando os dados chegam.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`vlt-skeleton ${className}`} />;
}

// Linha de lista: bloco de texto à esquerda + métrica curta à direita,
// que é o formato das listas do cofre (certificados, alvarás, acessos).
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-3.5">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
      <Skeleton className="h-5 w-14 rounded-full max-sm:hidden" />
      <div className="w-16 shrink-0 space-y-1.5">
        <Skeleton className="ml-auto h-3.5 w-9" />
        <Skeleton className="ml-auto h-2.5 w-12" />
      </div>
    </div>
  );
}

// Lista dentro de um card já existente (o card desenha a borda).
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

// Lista solta: cada item é o seu próprio card.
export function SkeletonCards({
  rows = 4,
  className = "h-16",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <ul className="space-y-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i}>
          <Skeleton className={`w-full ${className}`} />
        </li>
      ))}
    </ul>
  );
}

// Tabela dentro de um card: faixa de cabeçalho + linhas de colunas.
// Usada onde a lista é uma <table> (certificados, alvarás).
export function SkeletonTable({
  rows = 6,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  // Larguras alternadas pra tabela não virar um grid de barras idênticas.
  const widths = ["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4", "w-2/5"];

  return (
    <div className="vlt-card overflow-hidden">
      <div className="flex gap-4 border-b border-line px-5 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3.5">
            {Array.from({ length: cols }, (_, c) => (
              <div key={c} className="flex-1">
                <Skeleton className={`h-3.5 ${widths[(r + c) % widths.length]}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Cabeçalho de página: título + subtítulo.
export function SkeletonHeader() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-3.5 w-64" />
    </div>
  );
}
