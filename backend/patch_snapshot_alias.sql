-- Fix the competition table alias without publishing the private dispatcher source.
-- Already applied to the linked Supabase project.
DO $patch$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_functiondef('arena_private.dispatch(text,jsonb)'::regprocedure)
    INTO definition;
  IF strpos(definition, $old$jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.arena_competitions c where c.status<>'draft'$old$) > 0 THEN
    EXECUTE replace(definition, $old$jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.arena_competitions c where c.status<>'draft'$old$, $new$jsonb_agg(to_jsonb(comp) order by comp.created_at desc) from public.arena_competitions comp where comp.status<>'draft'$new$);
  ELSIF strpos(definition, $new$jsonb_agg(to_jsonb(comp) order by comp.created_at desc) from public.arena_competitions comp where comp.status<>'draft'$new$) = 0 THEN
    RAISE EXCEPTION 'Unexpected dispatcher version: review before patching';
  END IF;
END
$patch$;
