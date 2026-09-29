alter table public.community_posts
  add column if not exists image_urls text[] not null default '{}'::text[],
  add column if not exists image_paths text[] not null default '{}'::text[];

alter table public.community_posts
  drop constraint if exists community_posts_image_urls_limit,
  add constraint community_posts_image_urls_limit check (cardinality(image_urls) <= 4),
  drop constraint if exists community_posts_image_paths_limit,
  add constraint community_posts_image_paths_limit check (cardinality(image_paths) <= 4),
  drop constraint if exists community_posts_images_match,
  add constraint community_posts_images_match check (cardinality(image_urls) = cardinality(image_paths));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "community_media_select_own" on storage.objects;
create policy "community_media_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "community_media_insert_own" on storage.objects;
create policy "community_media_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "community_media_delete_own" on storage.objects;
create policy "community_media_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
