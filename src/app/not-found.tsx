'use client';

import { AppIcon } from '@/components/ui/app-icon';
import React from 'react';
import { useLightLanguage } from '@/lib/i18n-light';

export default function NotFound() {
  const { messages: m } = useLightLanguage();

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-xl text-center gap-md">
      <AppIcon name="find_in_page" className="text-outline text-[64px]" />
      {/*
        A landmark heading: this page has no other <h1>, and a 404 whose only
        heading is an <h2> gives screen readers no page title and crawlers no
        heading structure.
      */}
      <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold">
        {m.errors.notFound}
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
        {m.errors.notFoundDescription}
      </p>
      {/*
        A 404 is reached by anonymous visitors too; sending them to /dashboard
        only bounces them through /login. The landing page is the honest target.
      */}
      <a
        href="/"
        className="mt-sm px-6 py-3 bg-primary text-on-primary font-headline-md text-headline-md rounded-xl shadow-sm hover:bg-primary-container"
      >
        {m.errors.goHome}
      </a>
    </div>
  );
}
