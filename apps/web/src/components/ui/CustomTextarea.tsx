'use client';

import React, { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CustomTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const CustomTextarea = forwardRef<HTMLTextAreaElement, CustomTextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-sm">
        {label && (
          <label className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full min-h-[120px] px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl',
            'font-body-md text-base md:text-body-md text-on-surface placeholder:text-on-surface-variant/50',
            'hover:border-outline hover:bg-surface-container-low',
            'focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none',
            'transition-all duration-200 resize-y',
            error && 'border-error focus:border-error focus:ring-error/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && (
          <p className="font-label-sm text-label-sm text-error mt-1">{error}</p>
        )}
      </div>
    );
  }
);

CustomTextarea.displayName = 'CustomTextarea';
