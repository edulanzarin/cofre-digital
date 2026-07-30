// Layout das telas de lista (certificados, empresas, acessos, alvarás): o
// cabeçalho e a barra de filtros ficam FIXOS no topo e só a lista rola, com a
// barra de rolagem na própria tabela — não na página inteira. Isso mantém busca
// e filtros sempre à vista enquanto o conteúdo passa por baixo.
//
// Depende do AppShell dar um quadro de altura fixa (h-dvh) sem rolagem própria
// para as rotas de lista; aqui o `h-full` preenche esse quadro e o `flex-1` da
// região de baixo distribui o que sobra para a lista rolar dentro dela.
export default function ListShell({
  title,
  action,
  toolbar,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col px-6 lg:px-12">
      {/* Região fixa: título + ação */}
      <header className="anim-fade-up flex shrink-0 flex-wrap items-end justify-between gap-4 pt-8 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {action}
      </header>

      {/* Região fixa: busca + filtros */}
      {toolbar && (
        <div
          className="anim-fade-up flex shrink-0 flex-wrap items-center gap-3 pb-5"
          style={{ animationDelay: "60ms" }}
        >
          {toolbar}
        </div>
      )}

      {/* Região que rola: a lista tem a barra de rolagem própria (ver os
          componentes *List, cujo card é max-h-full overflow-auto). O fade-up
          fica aqui, no ancestral do card — não no card, que é o scroll
          container do cabeçalho sticky. */}
      <div
        className="anim-fade-up min-h-0 flex-1 pb-8"
        style={{ animationDelay: "120ms" }}
      >
        {children}
      </div>
    </div>
  );
}
