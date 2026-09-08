/** On-device label OCR with bounded preprocessing and explicit language choice. */

export type OcrProgress = (percent: number | null) => void;
export type LabelOcrLanguage = 'fr' | 'en' | 'ar' | 'multi';

export interface LabelOcrResult {
  text: string;
  confidence: number;
  language: LabelOcrLanguage;
  /** Language models are fetched from the configured tessdata CDN on first use. */
  remoteModelsMayBeDownloaded: true;
}

interface LabelOcrWorker {
  recognize(image: Blob | string): Promise<{ data: { text?: string; confidence?: number } }>;
  terminate(): Promise<unknown>;
}

export type LabelOcrWorkerFactory = (
  languages: string,
  oem: number,
  options: {
    workerPath: string;
    corePath: string;
    workerBlobURL: boolean;
    logger: (message: { status?: string; progress?: number }) => void;
  },
) => Promise<LabelOcrWorker>;

export interface LabelOcrDependencies {
  /** Injectable only to make worker startup/cancellation deterministic in
   * boundary tests; production always uses tesseract.js. */
  createWorker?: LabelOcrWorkerFactory;
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 40_000_000;
const MAX_EDGE = 2_400;

function abortError(): DOMException {
  return new DOMException('Label OCR was cancelled.', 'AbortError');
}

async function preprocess(file: File, signal?: AbortSignal): Promise<Blob> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('image-too-large');
  if (signal?.aborted) throw abortError();
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) throw new Error('image-dimensions-too-large');
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('image-processing-unavailable');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.filter = 'grayscale(1) contrast(1.3)';
    context.drawImage(bitmap, 0, 0, width, height);
    if (signal?.aborted) throw abortError();
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('image-processing-failed')), 'image/jpeg', 0.9);
    });
  } finally {
    bitmap.close();
  }
}

export function ocrModelLanguages(language: LabelOcrLanguage): string {
  if (language === 'ar') return 'ara';
  if (language === 'en') return 'eng';
  if (language === 'fr') return 'fra';
  return 'ara+fra+eng';
}

function abortable<T>(
  operation: Promise<T>,
  signal: AbortSignal | undefined,
  onLateValue?: (value: T) => void,
): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) {
    void operation.then((value) => onLateValue?.(value), () => undefined);
    return Promise.reject(abortError());
  }
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        if (settled) onLateValue?.(value);
        else {
          settled = true;
          resolve(value);
        }
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        if (!settled) {
          settled = true;
          reject(error);
        }
      },
    );
  });
}

export async function recognizeLabelText(
  image: File | string,
  language: LabelOcrLanguage = 'fr',
  onProgress?: OcrProgress,
  signal?: AbortSignal,
  dependencies: LabelOcrDependencies = {},
): Promise<LabelOcrResult> {
  if (signal?.aborted) throw abortError();
  const prepared = typeof image === 'string' ? image : await preprocess(image, signal);
  if (signal?.aborted) throw abortError();

  const createWorker: LabelOcrWorkerFactory = dependencies.createWorker ?? (async (...args) => {
    const tesseract = await import('tesseract.js');
    const factory = tesseract.createWorker as unknown as LabelOcrWorkerFactory;
    return factory(...args);
  });

  let worker: LabelOcrWorker | null = null;
  let terminatedWorker: LabelOcrWorker | null = null;
  let termination: Promise<void> | null = null;
  const terminate = (target: LabelOcrWorker | null = worker): Promise<void> => {
    if (!target) return Promise.resolve();
    if (terminatedWorker === target && termination) return termination;
    terminatedWorker = target;
    termination = target.terminate().then(() => undefined, () => undefined);
    return termination;
  };
  const cancel = () => { void terminate(); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const creating = createWorker(ocrModelLanguages(language), 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/',
      workerBlobURL: false,
      logger: (message: { status?: string; progress?: number }) => {
        if (signal?.aborted) return;
        if (message.status === 'recognizing text' && typeof message.progress === 'number') {
          onProgress?.(Math.round(message.progress * 100));
        } else {
          onProgress?.(null);
        }
      },
    });
    worker = await abortable(creating, signal, (lateWorker) => { void terminate(lateWorker); });
    const recognized = abortable(worker.recognize(prepared), signal);
    const { data } = await recognized;
    return {
      text: (data.text || '').trim(),
      confidence: Number.isFinite(data.confidence) ? Math.max(0, Math.min(100, data.confidence ?? 0)) : 0,
      language,
      remoteModelsMayBeDownloaded: true,
    };
  } finally {
    signal?.removeEventListener('abort', cancel);
    await terminate();
  }
}
