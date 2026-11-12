CREATE TABLE public.nochat_records (collection text NOT NULL, id text NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(collection,id));
GRANT ALL ON public.nochat_records TO service_role;
ALTER TABLE public.nochat_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX nochat_record_user ON public.nochat_records ((payload->>'userId'));
CREATE INDEX nochat_record_conversation ON public.nochat_records ((payload->>'conversationId'));
CREATE TABLE public.nochat_revision (id integer PRIMARY KEY CHECK(id=1), revision bigint NOT NULL DEFAULT 0);
GRANT ALL ON public.nochat_revision TO service_role;
ALTER TABLE public.nochat_revision ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.nochat_user_roles (user_id text PRIMARY KEY, role text NOT NULL CHECK(role IN ('admin','moderator')));
GRANT ALL ON public.nochat_user_roles TO service_role;
ALTER TABLE public.nochat_user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.nochat_load() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb; rev bigint;
BEGIN
 SELECT revision INTO rev FROM public.nochat_revision WHERE id=1;
 SELECT coalesce(jsonb_object_agg(collection,rows),'{}'::jsonb) INTO result FROM (SELECT collection,jsonb_agg(payload ORDER BY id) rows FROM public.nochat_records GROUP BY collection) q;
 RETURN jsonb_build_object('revision',coalesce(rev,0),'state',result);
END $$;
REVOKE ALL ON FUNCTION public.nochat_load() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nochat_load() TO service_role;
CREATE OR REPLACE FUNCTION public.nochat_save(expected_revision bigint, new_state jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rev bigint; pair record;
BEGIN
 INSERT INTO public.nochat_revision(id,revision) VALUES(1,0) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM public.nochat_revision WHERE id=1 FOR UPDATE;
 IF rev<>expected_revision THEN RAISE EXCEPTION 'Revision conflict: reload required'; END IF;
 FOR pair IN SELECT key,value FROM jsonb_each(new_state) LOOP
 IF pair.key NOT IN ('users','subscriptions','friends','friendRequests','reels','reelLikes','reelComments','conversations','messages','reports','reelUploads') THEN RAISE EXCEPTION 'Invalid collection'; END IF;
 DELETE FROM public.nochat_records WHERE collection=pair.key AND id NOT IN (SELECT value->>'id' FROM jsonb_array_elements(pair.value));
 INSERT INTO public.nochat_records(collection,id,payload) SELECT pair.key,value->>'id',value FROM jsonb_array_elements(pair.value) ON CONFLICT(collection,id) DO UPDATE SET payload=excluded.payload;
 END LOOP;
 UPDATE public.nochat_revision SET revision=rev+1 WHERE id=1;
 RETURN rev+1;
END $$;
REVOKE ALL ON FUNCTION public.nochat_save(bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nochat_save(bigint,jsonb) TO service_role;