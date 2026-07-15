// Tipos das empresas — cada uma é dona de um cofre (certificados,
// acessos e, futuramente, alvarás e outros documentos).

export type Company = {
  id: string;
  cnpj: string; // só dígitos
  razaoSocial: string;
  createdAt: string; // ISO
  certCount: number;
  accessCount: number;
  nextExpiresAt: string | null; // vencimento mais próximo entre os certificados
};
