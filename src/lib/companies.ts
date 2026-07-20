// Tipos das empresas — cada uma é dona de um cofre (certificados,
// acessos, alvarás e outros documentos).

export type Company = {
  id: string;
  cnpj: string; // só dígitos
  razaoSocial: string;
  groupId: string | null;
  group: { id: string; name: string } | null; // grupo econômico, se houver
  createdAt: string; // ISO
  certCount: number;
  accessCount: number;
  alvaraCount: number;
  nextExpiresAt: string | null; // vencimento mais próximo entre os certificados
};
