'use client';

import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CustomInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const CustomInput = forwardRef<HTMLInputElement, CustomInputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="flex min-w-0 max-w-full flex-col gap-sm">
        {label && (
          <label className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative min-w-0 max-w-full">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full min-w-0 max-w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl',
              // 16px on mobile so iOS Safari does not zoom on focus; 14px from md up.
              'font-body-md text-base md:text-body-md text-on-surface placeholder:text-on-surface-variant/50',
              'hover:border-outline hover:bg-surface-container-low',
              'focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none',
              'transition-all duration-200',
              icon && 'pl-12',
              // Chromium gives date fields a large intrinsic minimum width.
              // Keep the native picker but let it shrink inside a mobile sheet.
              props.type === 'date' && 'date-input',
              error && 'border-error focus:border-error focus:ring-error/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="font-label-sm text-label-sm text-error mt-1">{error}</p>
        )}
      </div>
    );
  }
);

CustomInput.displayName = 'CustomInput';
