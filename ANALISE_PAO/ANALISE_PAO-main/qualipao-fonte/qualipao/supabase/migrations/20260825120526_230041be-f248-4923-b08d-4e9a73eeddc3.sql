CREATE TABLE public.auditorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_codigo TEXT NOT NULL,
  loja_nome TEXT NOT NULL,
  produto TEXT NOT NULL,
  total_fotos INTEGER NOT NULL DEFAULT 0,
  nota NUMERIC NOT NULL,
  status TEXT NOT NULL,
  relatorio JSONB NOT NULL,
  pdf_path TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.auditorias TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditorias TO authenticated;
GRANT ALL ON public.auditorias TO service_role;

ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auditorias visiveis para todos" ON public.auditorias FOR SELECT USING (true);
CREATE POLICY "Qualquer um pode registrar auditoria" ON public.auditorias FOR INSERT WITH CHECK (true);
CREATE POLICY "Qualquer um pode atualizar auditoria" ON public.auditorias FOR UPDATE USING (true) WITH CHECK (true);