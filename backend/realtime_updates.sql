-- Database notifications contain no orders, balances, user IDs, or trade data.
-- Clients still obtain all data through the existing authenticated Arena API.
CREATE OR REPLACE FUNCTION arena_private.can_receive_updates(topic_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.arena_members m
  WHERE m.user_id = auth.uid() AND topic_name = 'arena:' || m.competition_id::text
 );
$$;
REVOKE ALL ON FUNCTION arena_private.can_receive_updates(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION arena_private.can_receive_updates(text) TO authenticated;

CREATE POLICY arena_member_receive_updates ON realtime.messages
FOR SELECT TO authenticated
USING (extension = 'broadcast' AND arena_private.can_receive_updates(realtime.topic()));

CREATE OR REPLACE FUNCTION arena_private.notify_arena_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE data jsonb; competition uuid;
BEGIN
 data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_TABLE_NAME = 'arena_competitions' THEN competition := (data->>'id')::uuid;
 ELSIF TG_TABLE_NAME = 'arena_positions' THEN
  SELECT m.competition_id INTO competition FROM public.arena_members m WHERE m.id=(data->>'member_id')::uuid;
 ELSE competition := (data->>'competition_id')::uuid;
 END IF;
 IF competition IS NOT NULL THEN
  PERFORM realtime.send('{}'::jsonb, 'refresh', 'arena:' || competition::text, true);
 END IF;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION arena_private.notify_arena_update() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER arena_orders_notify AFTER INSERT OR UPDATE OR DELETE ON public.arena_orders FOR EACH ROW EXECUTE FUNCTION arena_private.notify_arena_update();
CREATE TRIGGER arena_fills_notify AFTER INSERT OR UPDATE OR DELETE ON public.arena_fills FOR EACH ROW EXECUTE FUNCTION arena_private.notify_arena_update();
CREATE TRIGGER arena_positions_notify AFTER INSERT OR UPDATE OR DELETE ON public.arena_positions FOR EACH ROW EXECUTE FUNCTION arena_private.notify_arena_update();
CREATE TRIGGER arena_markets_notify AFTER INSERT OR UPDATE OR DELETE ON public.arena_markets FOR EACH ROW EXECUTE FUNCTION arena_private.notify_arena_update();
CREATE TRIGGER arena_members_notify AFTER INSERT OR UPDATE OR DELETE ON public.arena_members FOR EACH ROW EXECUTE FUNCTION arena_private.notify_arena_update();
CREATE TRIGGER arena_competitions_notify AFTER INSERT OR UPDATE OR DELETE ON public.arena_competitions FOR EACH ROW EXECUTE FUNCTION arena_private.notify_arena_update();
