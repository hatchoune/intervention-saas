-- ============================================================================
-- 0006_storage
-- Private bucket for intervention before/after photos.
--
-- Object naming convention (enforced by the policies below):
--   {organization_id}/{intervention_id}/{uuid}.{ext}
--
-- Files are private: reads are only possible through signed URLs created by an
-- authenticated member of the owning organisation.
--
-- The whole file is wrapped defensively because `storage.objects` is owned by
-- the storage service role on hosted Supabase and may not exist on a vanilla
-- PostgreSQL instance. If a policy cannot be created the migration still
-- succeeds and a NOTICE is raised (see docs/SETUP.md for the manual step).
-- ============================================================================

-- Extracts the organisation id from a storage object path.
-- Declared in plpgsql so the body is only resolved at run time: this keeps the
-- migration runnable on PostgreSQL instances without the storage schema.
create or replace function public.storage_path_organization_id(p_object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return public.safe_uuid((storage.foldername(p_object_name))[1]);
exception
  when others then
    return null;
end;
$$;

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'intervention-photos',
    'intervention-photos',
    false,
    10485760, -- 10 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "intervention_photos_storage_select" on storage.objects;
  create policy "intervention_photos_storage_select" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'intervention-photos'
      and public.is_org_member(public.storage_path_organization_id(name))
    );

  drop policy if exists "intervention_photos_storage_insert" on storage.objects;
  create policy "intervention_photos_storage_insert" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'intervention-photos'
      and public.is_org_member(public.storage_path_organization_id(name))
    );

  drop policy if exists "intervention_photos_storage_update" on storage.objects;
  create policy "intervention_photos_storage_update" on storage.objects
    for update to authenticated
    using (
      bucket_id = 'intervention-photos'
      and public.is_org_member(public.storage_path_organization_id(name))
    )
    with check (
      bucket_id = 'intervention-photos'
      and public.is_org_member(public.storage_path_organization_id(name))
    );

  drop policy if exists "intervention_photos_storage_delete" on storage.objects;
  create policy "intervention_photos_storage_delete" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'intervention-photos'
      and public.is_org_member(public.storage_path_organization_id(name))
      and (
        public.can_manage_org_data(public.storage_path_organization_id(name))
        or owner = auth.uid()
      )
    );
exception
  when insufficient_privilege then
    raise notice
      'Skipped storage.objects policies (insufficient privilege). Create the bucket "%" and its policies manually - see docs/SETUP.md.',
      'intervention-photos';
  when undefined_table then
    raise notice
      'storage schema not found - skipping storage bucket setup. This is expected outside Supabase.';
end
$$;
