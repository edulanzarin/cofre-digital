// Tipos das empresas — cada uma é dona de um cofre (certificados,
// acessos, alvarás e outros documentos).

export type Company = {
  id: string;
  cnpj: string; // só dígitos
  razaoSocial: string;
  groupId: string | null;
  group: { id: string; name: string } | null; // grupo econômico, se houver
  // Valores do contrato, em centavos. Nulo = não informado.
  honorarios: number | null; // honorário mensal
  alteracaoContratual: number | null; // valor da alteração contratual
  createdAt: string; // ISO
  certCount: number;
  accessCount: number;
  alvaraCount: number;
  nextExpiresAt: string | null; // vencimento mais próximo entre os certificados
};
