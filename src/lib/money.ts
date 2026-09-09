// Dinheiro do cadastro da empresa (honorário, alteração contratual).
//
// O valor mora em centavos, como inteiro, do banco até a tela. Texto livre
// de preço em português é ambíguo — "1.200" é mil e duzentos, "250.50" é
// duzentos e cinquenta e cinquenta, e o parser ingênuo salva R$ 1,20 sem
// reclamar. Aqui a entrada só aceita dígito e cada tecla empurra os
// centavos, então não há o que interpretar.

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const PLAIN = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// R$ 950,00 — e o travessão quando o valor nunca foi informado.
export function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return BRL.format(cents / 100);
}

// "950,00" — o que aparece dentro do campo, com o "R$" fora dele.
export function moneyDigits(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return PLAIN.format(cents / 100);
}

// O que a pessoa digitou vira centavos: só os dígitos importam. Vazio é
// nulo (não informado), não zero — zero é um honorário de verdade.
export function centsFromTyping(raw: string): number | null {
  const digits = raw.replace(/\D/g, "").slice(0, 11); // ~R$ 999 milhões
  if (digits === "") return null;
  return Number(digits);
}
