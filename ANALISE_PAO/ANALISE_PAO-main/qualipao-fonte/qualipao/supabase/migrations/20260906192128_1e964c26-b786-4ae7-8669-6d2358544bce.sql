CREATE TABLE public.numeros_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL UNIQUE,
  loja_codigo text NOT NULL,
  loja_nome text NOT NULL,
  produto_padrao text NOT NULL DEFAULT 'Pão francês',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.numeros_whatsapp TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.numeros_whatsapp TO authenticated;
GRANT ALL ON public.numeros_whatsapp TO service_role;

ALTER TABLE public.numeros_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Numeros visiveis para todos" ON public.numeros_whatsapp FOR SELECT USING (true);
CREATE POLICY "Qualquer um pode cadastrar numero" ON public.numeros_whatsapp FOR INSERT WITH CHECK (true);
CREATE POLICY "Qualquer um pode atualizar numero" ON public.numeros_whatsapp FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Qualquer um pode remover numero" ON public.numeros_whatsapp FOR DELETE USING (true);

CREATE TABLE public.whatsapp_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL,
  loja_codigo text NOT NULL,
  loja_nome text NOT NULL,
  produto text NOT NULL,
  imagens jsonb NOT NULL DEFAULT '[]'::jsonb,
  situacao text NOT NULL DEFAULT 'aguardando',
  auditoria_id uuid REFERENCES public.auditorias(id) ON DELETE SET NULL,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.whatsapp_fila TO service_role;

ALTER TABLE public.whatsapp_fila ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_numeros_whatsapp_updated_at BEFORE UPDATE ON public.numeros_whatsapp
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_fila_updated_at BEFORE UPDATE ON public.whatsapp_fila
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();