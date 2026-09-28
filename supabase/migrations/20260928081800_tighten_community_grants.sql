revoke all privileges on table public.community_posts, public.community_comments, public.community_likes from anon, authenticated;
grant select on table public.community_posts, public.community_comments, public.community_likes to anon;
grant select, insert, update, delete on table public.community_posts, public.community_comments, public.community_likes to authenticated;

revoke all privileges on sequence public.community_comments_id_seq from anon, authenticated;
grant usage, select on sequence public.community_comments_id_seq to authenticated;
