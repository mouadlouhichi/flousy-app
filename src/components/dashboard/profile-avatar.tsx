'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { isProfileAvatarSource } from '@/lib/profile-avatar';

interface ProfileAvatarProps {
  /** Saved profile photo or the current auth-provider photo. */
  src?: string | null;
  /** Stable initials shown immediately while a remote image is loading. */
  initial: string;
  alt?: string;
  /** Circle by default; settings uses its existing softly rounded tile shape. */
  shape?: 'circle' | 'rounded';
  className?: string;
  fallbackClassName?: string;
}

/**
 * A stable profile image with an initials layer underneath. Keeping the
 * fallback mounted means the dashboard never flashes a random/empty avatar
 * while a provider image is loading or if that remote image later fails.
 */
export function ProfileAvatar({
  src,
  initial,
  alt = '',
  shape = 'circle',
  className,
  fallbackClassName,
}: ProfileAvatarProps) {
  const source = isProfileAvatarSource(src) ? src.trim() : undefined;
  // Remember the one source that failed. A newly saved photo has a different
  // URL, so it is shown immediately without waiting for an effect to reset.
  const [failedSource, setFailedSource] = useState<string | undefined>();
  const showImage = Boolean(source && failedSource !== source);

  return (
    <span
      className={cn(
        'relative flex shrink-0 overflow-hidden',
        shape === 'rounded' ? 'rounded-2xl' : 'rounded-full',
        className,
      )}
    >
      <span
        aria-hidden={showImage}
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          fallbackClassName,
        )}
      >
        {initial}
      </span>
      {showImage && source ? (
        // Native <img> supports both persisted JPEG data URLs and Google
        // profile URLs without configuring a Next.js remote-image allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={alt}
          draggable={false}
          className="relative z-[1] size-full object-cover"
          onError={() => {
            // Leave the deterministic initials visible if a remote provider
            // photo expires or is unavailable.
            setFailedSource(source);
          }}
        />
      ) : null}
    </span>
  );
}
