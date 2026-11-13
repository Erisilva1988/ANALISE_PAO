export const PRODUTOS = [
  "Pão francês",
  "Pão de forma",
  "Pão doce",
  "Baguete",
  "Croissant",
  "Bolo",
  "Sonho",
];

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Encontra um produto conhecido citado em um texto livre (legenda do WhatsApp). */
export function produtoNoTexto(texto: string): string | null {
  const alvo = semAcento(texto);
  return PRODUTOS.find((p) => alvo.includes(semAcento(p))) ?? null;
}
