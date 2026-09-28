import { ImageOff } from 'lucide-react';

import { PhotoDeleteButton } from '@/components/interventions/photo-delete-button';
import { EmptyState } from '@/components/ui/empty-state';
import type { InterventionPhotoWithUrl } from '@/lib/db/interventions';
import { formatDateTime } from '@/lib/utils/format';
import type { PhotoKind } from '@/types/database';

/**
 * Before/after evidence gallery. Images are rendered from short-lived signed
 * URLs computed on the server — the bucket itself stays private.
 */

const SECTIONS: { kind: PhotoKind; title: string; empty: string }[] = [
  { kind: 'before', title: 'Before', empty: 'No “before” photo yet.' },
  { kind: 'after', title: 'After', empty: 'No “after” photo yet.' },
];

export interface PhotoGalleryProps {
  photos: InterventionPhotoWithUrl[];
  /** Managers may remove any photo; everybody else only their own uploads. */
  canManage: boolean;
  currentUserId: string;
}

export function PhotoGallery({ photos, canManage, currentUserId }: PhotoGalleryProps) {
  if (photos.length === 0) {
    return (
      <EmptyState
        icon={<ImageOff aria-hidden className="size-5" />}
        title="No photos yet"
        description="Evidence photos added on site appear here, grouped by before and after."
      />
    );
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => {
        const sectionPhotos = photos.filter((entry) => entry.photo.kind === section.kind);

        return (
          <section key={section.kind} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {section.title}{' '}
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 tabular-nums">
                {sectionPhotos.length}
              </span>
            </h3>

            {sectionPhotos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                {section.empty}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {sectionPhotos.map(({ photo, url }) => {
                  const label = photo.caption ?? photo.file_name ?? `${section.title} photo`;
                  const mayDelete = canManage || photo.uploaded_by === currentUserId;

                  return (
                    <li key={photo.id} className="space-y-2 rounded-lg border border-slate-200 p-2">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block overflow-hidden rounded-md bg-slate-100"
                        >
                          {/* Signed URLs point at a private bucket: `next/image`
                              optimisation is neither possible nor desirable here. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={label}
                            loading="lazy"
                            className="aspect-[4/3] w-full object-cover"
                          />
                        </a>
                      ) : (
                        <p className="flex aspect-[4/3] items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500">
                          Preview unavailable
                        </p>
                      )}

                      <div className="space-y-1">
                        <p className="line-clamp-2 text-xs font-medium text-slate-700">{label}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatDateTime(photo.created_at)}
                        </p>
                        {mayDelete ? (
                          <PhotoDeleteButton photoId={photo.id} label={label} />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
