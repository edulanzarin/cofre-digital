// Tipos do cofre de acessos (sites de prefeituras, portais, sistemas).

export const LOGIN_TYPES = [
  "CNPJ",
  "CPF",
  "E-mail",
  "Usuário",
  "Certificado digital",
  "Outro",
] as const;

export type LoginType = (typeof LOGIN_TYPES)[number];

// Resumo do certificado vinculado a um acesso (login por certificado digital).
export type LinkedCertificate = {
  id: string;
  holder: string;
  type: string;
  issuedAt: string;
  expiresAt: string;
};

export type Access = {
  id: string;
  name: string; // ex.: Prefeitura de Blumenau
  url: string;
  loginType: LoginType;
  loginValue: string;
  password?: string; // só vem no GET por id (Societário)
  certificateId?: string | null;
  certificate?: LinkedCertificate | null;
  notes?: string;
  tutorial?: string; // markdown
  hasTutorial?: boolean; // na listagem
  updatedAt?: string;
};
