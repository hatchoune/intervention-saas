'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, UploadCloud } from 'lucide-react';

import { ActionAlert, Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/controls';
import { Spinner } from '@/components/ui/submit-button';
import { attachInterventionPhotoAction } from '@/lib/actions/interventions';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Direct-to-Storage uploader for intervention evidence photos.
 *
 * The file never transits through a Server Action (the payload limit is 4 MB).
 * The browser uploads with the anon key — RLS on `storage.objects` only accepts
 * the `${org}/{intervention}/{uuid}.{ext}` convention — then a Server Action
 * records the metadata row.
 */

/** Mirrors `INTERVENTION_PHOTO_BUCKET` in the server data layer. */
const BUCKET = 'intervention-photos';

/** Same list as the bucket's `allowed_mime_types`. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = Object.keys(EXTENSIONS).join(',');

type UploadPhase = 'idle' | 'uploading' | 'saving';

export interface PhotoUploaderProps {
  organizationId: string;
  interventionId: string;
}

export function PhotoUploader({ organizationId, interventionId }: PhotoUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<'before' | 'after'>('before');
  const [caption, setCaption] = useState('');
  const [fileName, setFileName] = useState('');
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const busy = phase !== 'idle';

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFileName(event.target.files?.[0]?.name ?? '');
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a photo before uploading.');
      return;
    }

    const extension = EXTENSIONS[file.type];
    if (!extension) {
      setError('Only JPEG, PNG, WebP, HEIC and HEIF images are supported.');
      return;
    }

    if (file.size > MAX_BYTES) {
      setError('Photos must be 10 MB or smaller.');
      return;
    }

    // Path convention enforced by the storage policies.
    const storagePath = `${organizationId}/${interventionId}/${crypto.randomUUID()}.${extension}`;
    const supabase = createSupabaseBrowserClient();

    setPhase('uploading');

    try {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }

      setPhase('saving');

      const payload = new FormData();
      payload.set('interventionId', interventionId);
      payload.set('kind', kind);
      payload.set('storagePath', storagePath);
      payload.set('fileName', file.name);
      payload.set('mimeType', file.type);
      payload.set('sizeBytes', String(file.size));
      payload.set('caption', caption);

      const result = await attachInterventionPhotoAction(IDLE_ACTION_STATE, payload);

      if (result.status === 'error') {
        // Do not leave an orphaned object behind when the row cannot be saved.
        await supabase.storage.from(BUCKET).remove([storagePath]);
        setError(result.message ?? 'We could not save this photo.');
        return;
      }

      setSuccess(result.message ?? 'Photo added.');
      setCaption('');
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } catch (uploadFailure) {
      setError(
        uploadFailure instanceof Error ? uploadFailure.message : 'The upload could not be completed.',
      );
    } finally {
      setPhase('idle');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ActionAlert status={error ? 'error' : success ? 'success' : 'idle'} message={error ?? success ?? undefined} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="photo-kind" label="Photo type">
          <Select
            id="photo-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value === 'after' ? 'after' : 'before')}
            disabled={busy}
          >
            <option value="before">Before the work</option>
            <option value="after">After the work</option>
          </Select>
        </Field>

        <Field htmlFor="photo-caption" label="Caption" hint="Optional, shown under the photo.">
          <Input
            id="photo-caption"
            value={caption}
            maxLength={300}
            onChange={(event) => setCaption(event.target.value)}
            disabled={busy}
            placeholder="Boiler before replacement"
          />
        </Field>
      </div>

      <Field
        htmlFor="photo-file"
        label="Photo"
        hint="JPEG, PNG, WebP, HEIC or HEIF — up to 10 MB."
      >
        <Input
          id="photo-file"
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFileChange}
          disabled={busy}
          className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-slate-700"
        />
      </Field>

      {busy ? (
        <Alert variant="info" live>
          <span className="flex items-center gap-2">
            <Spinner />
            <span className="tabular-nums">
              {phase === 'uploading'
                ? `Uploading ${fileName || 'photo'} to secure storage…`
                : 'Saving photo details…'}
            </span>
          </span>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? <Spinner /> : <UploadCloud aria-hidden className="size-4" />}
          Upload photo
        </Button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ImagePlus aria-hidden className="size-3.5" />
        Photos are stored privately and shown through short-lived signed links.
      </p>
    </form>
  );
}
