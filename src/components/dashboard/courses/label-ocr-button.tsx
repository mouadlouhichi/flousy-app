'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import { recognizeLabelText, type LabelOcrLanguage, type LabelOcrResult } from '@/lib/label-ocr';
import { parseInciList } from '@/lib/ingredient-safety/normalize';
import { splitFoodLabel } from '@/lib/food-analysis-client';

interface LabelOcrButtonProps {
  /** Called only after the user reviews and confirms OCR text + parsed rows. */
  onText: (text: string, metadata?: { source: 'ocr'; confidence: number; language: LabelOcrLanguage }) => void;
  disabled?: boolean;
  productKey?: string;
  mode?: 'inci' | 'food';
}

function bracketsBalanced(text: string): boolean {
  const opens = new Map<string, string>([['(', ')'], ['[', ']'], ['{', '}']]);
  const closes = new Map([...opens].map(([open, close]) => [close, open]));
  const stack: string[] = [];
  for (const char of text) {
    if (opens.has(char)) stack.push(char);
    else if (closes.has(char) && stack.pop() !== closes.get(char)) return false;
  }
  return stack.length === 0;
}

export function LabelOcrButton({ onText, disabled, productKey = '', mode = 'inci' }: LabelOcrButtonProps) {
  const { messages, t } = useLanguage();
  const g = messages.labelOcr;
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const [busy, setBusy] = useState<null | 'preparing' | number>(null);
  const [error, setError] = useState<string | null>(null);
  const [labelLanguage, setLabelLanguage] = useState<LabelOcrLanguage>('fr');
  const [result, setResult] = useState<LabelOcrResult | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    setBusy(null);
    setResult(null);
    setDraft('');
    setError(null);
  }, [productKey]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const review = useMemo(() => {
    if (!draft.trim()) return { tokens: [] as string[], valid: false };
    if (mode === 'inci') {
      const parsed = parseInciList(draft);
      return { tokens: parsed.tokens, valid: parsed.valid && parsed.tokens.length > 0 };
    }
    const tokens = splitFoodLabel(draft);
    return { tokens, valid: bracketsBalanced(draft) && tokens.length > 0 };
  }, [draft, mode]);

  const run = async (file: File | undefined) => {
    if (!file || busy !== null) return;
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setResult(null);
    setDraft('');
    setBusy('preparing');
    try {
      const recognized = await recognizeLabelText(
        file,
        labelLanguage,
        (progress) => {
          if (generation === generationRef.current) setBusy(progress === null ? 'preparing' : progress);
        },
        controller.signal,
      );
      if (generation !== generationRef.current || controller.signal.aborted) return;
      if (recognized.text.length < 2) {
        setError(g.empty);
        return;
      }
      // OCR remains a draft. Analysis/persistence starts only from Confirm.
      setResult(recognized);
      setDraft(recognized.text);
    } catch (cause) {
      if (controller.signal.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) return;
      setError(g.failed);
    } finally {
      if (generation === generationRef.current) setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const cancelReview = () => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    setResult(null);
    setDraft('');
    setError(null);
  };

  return (
    <span className="flex w-full flex-col items-start gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => void run(event.target.files?.[0])}
      />
      {!result && (
        <span className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface-variant">
            {g.languageLabel}
            <select
              value={labelLanguage}
              onChange={(event) => setLabelLanguage(event.target.value as LabelOcrLanguage)}
              disabled={busy !== null}
              className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
            >
              <option value="fr">{g.languageFr}</option>
              <option value="en">{g.languageEn}</option>
              <option value="ar">{g.languageAr}</option>
              <option value="multi">{g.languageMulti}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy !== null}
            className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3.5 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container-high disabled:opacity-60"
          >
            {busy !== null ? (
              <>
                <AppIcon name="hourglass_top" className="size-4 animate-spin" />
                {busy === 'preparing' ? g.preparing : t(g.scanning, { percent: busy })}
              </>
            ) : (
              <>
                <AppIcon name="add_a_photo" className="size-4" />
                {g.cta}
              </>
            )}
          </button>
        </span>
      )}
      {!result && <span className="font-label-sm text-label-sm text-on-surface-variant/80">{g.modelDownload}</span>}

      {result && (
        <span className="block w-full rounded-xl border border-primary/30 bg-surface-container-low p-3">
          <strong className="block font-label-md text-label-md text-on-surface">{g.reviewTitle}</strong>
          <span className="mt-1 block font-label-sm text-label-sm text-on-surface-variant">
            {g.reviewHelp} · {t(g.confidence, { percent: Math.round(result.confidence) })}
          </span>
          {result.confidence < 55 && (
            <span className="mt-1 block font-label-sm text-label-sm text-tertiary">{g.lowConfidence}</span>
          )}
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            className="mt-2 w-full resize-y rounded-lg border border-outline-variant bg-surface p-2 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary"
          />
          <span className="mt-2 block font-label-sm text-label-sm font-semibold text-on-surface">
            {t(g.tokens, { count: review.tokens.length })}
          </span>
          <span className="mt-1 flex max-h-24 flex-wrap gap-1 overflow-auto">
            {review.tokens.map((token, index) => (
              <span key={`${token}-${index}`} className="rounded-full bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                {token}
              </span>
            ))}
          </span>
          {!review.valid && (
            <span role="alert" className="mt-2 block font-label-sm text-label-sm text-error">{g.invalidStructure}</span>
          )}
          <span className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!review.valid}
              onClick={() => {
                if (!review.valid) return;
                onText(draft.trim(), { source: 'ocr', confidence: result.confidence, language: result.language });
                setResult(null);
                setDraft('');
              }}
              className="rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-40"
            >
              {g.confirm}
            </button>
            <button type="button" onClick={cancelReview} className="rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md text-on-surface">
              {messages.common.cancel}
            </button>
          </span>
        </span>
      )}
      {error && <p role="alert" className="font-label-sm text-label-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </span>
  );
}
