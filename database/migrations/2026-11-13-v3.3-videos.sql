-- NoChat v3.3 — additive, non-destructive migration.
-- Apply once in the Lovable Cloud project that hosts the /api/public/nochat bridge.
-- It ONLY replaces the nochat_save function so it also accepts the new "videos" collection
-- (preloaded catalog entries, founder-managed videos and their view counts).
-- No table is dropped, truncated or altered, and no existing row is touched.
-- Group chats need NO migration: they are stored in the existing "conversations" and "messages" collections.
CREATE OR REPLACE FUNCTION public.nochat_save(expected_revision bigint, new_state jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rev bigint; pair record;
BEGIN
 INSERT INTO public.nochat_revision(id,revision) VALUES(1,0) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM public.nochat_revision WHERE id=1 FOR UPDATE;
 IF rev<>expected_revision THEN RAISE EXCEPTION 'Revision conflict: reload required'; END IF;
 FOR pair IN SELECT key,value FROM jsonb_each(new_state) LOOP
 IF pair.key NOT IN ('users','subscriptions','friends','friendRequests','reels','reelLikes','reelComments','conversations','messages','reports','reelUploads','videos') THEN RAISE EXCEPTION 'Invalid collection'; END IF;
 DELETE FROM public.nochat_records WHERE collection=pair.key AND id NOT IN (SELECT value->>'id' FROM jsonb_array_elements(pair.value));
 INSERT INTO public.nochat_records(collection,id,payload) SELECT pair.key,value->>'id',value FROM jsonb_array_elements(pair.value) ON CONFLICT(collection,id) DO UPDATE SET payload=excluded.payload;
 END LOOP;
 UPDATE public.nochat_revision SET revision=rev+1 WHERE id=1;
 RETURN rev+1;
END $$;
REVOKE ALL ON FUNCTION public.nochat_save(bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nochat_save(bigint,jsonb) TO service_role;
