import { AppIcon } from '@/components/ui/app-icon';
import React from 'react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-xl text-center gap-md">
      <AppIcon name="find_in_page" className=" text-outline text-[64px]" />
      <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold">
        Page Not Found
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <a
        href="/dashboard"
        className="mt-sm px-6 py-3 bg-primary text-on-primary font-headline-md text-headline-md rounded-xl shadow-sm hover:bg-primary-container"
      >
        Return to Dashboard
      </a>
    </div>
  );
}
