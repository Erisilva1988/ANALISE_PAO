export type Loja = { codigo: string; nome: string };

export const LOJAS: Loja[] = [
  { codigo: "01", nome: "Loja Alecrim" },
  { codigo: "02", nome: "Loja Petrópolis" },
  { codigo: "03", nome: "Loja Lagoa Nova" },
  { codigo: "04", nome: "Loja Cidade Jardim" },
  { codigo: "05", nome: "Loja Santa Catarina" },
  { codigo: "06", nome: "Loja Igapó" },
  { codigo: "07", nome: "Loja Tirol" },
  { codigo: "08", nome: "Loja Nova Parnamirim" },
  { codigo: "09", nome: "Loja Ponta Negra" },
  { codigo: "35", nome: "SF Moema Tinoco" },
  { codigo: "37", nome: "SF Rodoviária" },
  { codigo: "39", nome: "Loja Rota do Sol" },
  { codigo: "40", nome: "SF João Pessoa" },
  { codigo: "41", nome: "SF São Gonçalo" },
  { codigo: "42", nome: "Loja Abolição III" },
  { codigo: "43", nome: "SF Alto São Manoel" },
  { codigo: "44", nome: "SF Vale do Sol" },
  { codigo: "45", nome: "SF Nova Betânia" },
  { codigo: "46", nome: "Loja Doze Anos" },
  { codigo: "51", nome: "SF Emáus" },
];

export function nomeLoja(codigo: string): string {
  return LOJAS.find((l) => l.codigo === codigo)?.nome ?? `Loja ${codigo}`;
}
