// Grupo econômico: um punhado de empresas do mesmo dono/rede. Serve para
// filtrar o cofre de todas de uma vez, sem repetir a busca empresa a empresa.

export type CompanyGroup = {
  id: string;
  name: string;
  companyCount: number;
};

// Valor do filtro de grupo na listagem de empresas: além dos ids, "none"
// isola as empresas que ainda não foram agrupadas.
export const NO_GROUP = "none";
