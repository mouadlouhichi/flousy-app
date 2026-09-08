import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ocrModelLanguages,
  recognizeLabelText,
  type LabelOcrWorkerFactory,
} from '../src/lib/label-ocr';

function abortName(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

describe('label OCR language and cancellation lifecycle', () => {
  it('maps explicit UI language choices to deterministic Tesseract model sets', () => {
    assert.equal(ocrModelLanguages('fr'), 'fra');
    assert.equal(ocrModelLanguages('en'), 'eng');
    assert.equal(ocrModelLanguages('ar'), 'ara');
    assert.equal(ocrModelLanguages('multi'), 'ara+fra+eng');
  });

  it('uses the selected model, local worker assets, bounded progress, and normalized output', async () => {
    const progress: Array<number | null> = [];
    let terminated = 0;
    const factory: LabelOcrWorkerFactory = async (languages, oem, options) => {
      assert.equal(languages, 'ara+fra+eng');
      assert.equal(oem, 1);
      assert.equal(options.workerPath, '/tesseract/worker.min.js');
      assert.equal(options.corePath, '/tesseract/');
      assert.equal(options.workerBlobURL, false);
      return {
        recognize: async (image) => {
          assert.equal(image, 'data:image/jpeg;base64,test');
          options.logger({ status: 'loading language traineddata', progress: 0.3 });
          options.logger({ status: 'recognizing text', progress: 0.426 });
          return { data: { text: '  Aqua, Glycerin \n', confidence: 130 } };
        },
        terminate: async () => { terminated += 1; },
      };
    };

    const result = await recognizeLabelText(
      'data:image/jpeg;base64,test',
      'multi',
      (value) => progress.push(value),
      undefined,
      { createWorker: factory },
    );
    assert.deepEqual(result, {
      text: 'Aqua, Glycerin',
      confidence: 100,
      language: 'multi',
      remoteModelsMayBeDownloaded: true,
    });
    assert.deepEqual(progress, [null, 43]);
    assert.equal(terminated, 1);
  });

  it('rejects oversized recognition instead of silently dropping the label suffix', async () => {
    let terminated = 0;
    const factory: LabelOcrWorkerFactory = async () => ({
      recognize: async () => ({ data: { text: 'A'.repeat(12_001), confidence: 90 } }),
      terminate: async () => { terminated += 1; },
    });
    await assert.rejects(
      recognizeLabelText('image', 'fr', undefined, undefined, { createWorker: factory }),
      /ocr-text-too-large/,
    );
    assert.equal(terminated, 1);
  });

  it('rejects a pre-aborted operation before loading or creating a worker', async () => {
    const controller = new AbortController();
    controller.abort();
    let factories = 0;
    const factory: LabelOcrWorkerFactory = async () => {
      factories += 1;
      throw new Error('must not create');
    };
    await assert.rejects(
      recognizeLabelText('image', 'fr', undefined, controller.signal, { createWorker: factory }),
      abortName,
    );
    assert.equal(factories, 0);
  });

  it('returns promptly when cancelled during worker startup and terminates a worker that arrives late', async () => {
    let resolveWorker!: (worker: Awaited<ReturnType<LabelOcrWorkerFactory>>) => void;
    const creating = new Promise<Awaited<ReturnType<LabelOcrWorkerFactory>>>((resolve) => {
      resolveWorker = resolve;
    });
    let recognizes = 0;
    let terminated = 0;
    const worker = {
      recognize: async () => {
        recognizes += 1;
        return { data: { text: 'late', confidence: 90 } };
      },
      terminate: async () => { terminated += 1; },
    };
    const factory: LabelOcrWorkerFactory = async () => creating;
    const controller = new AbortController();
    const pending = recognizeLabelText('image', 'ar', undefined, controller.signal, { createWorker: factory });
    await Promise.resolve();
    controller.abort();
    await assert.rejects(pending, abortName);
    resolveWorker(worker);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(recognizes, 0);
    assert.equal(terminated, 1);
  });

  it('cancels an in-progress recognition and terminates the worker exactly once', async () => {
    let resolveRecognition!: (value: { data: { text: string; confidence: number } }) => void;
    const recognizing = new Promise<{ data: { text: string; confidence: number } }>((resolve) => {
      resolveRecognition = resolve;
    });
    let started = false;
    let terminated = 0;
    const factory: LabelOcrWorkerFactory = async () => ({
      recognize: async () => {
        started = true;
        return recognizing;
      },
      terminate: async () => { terminated += 1; },
    });
    const controller = new AbortController();
    const pending = recognizeLabelText('image', 'en', undefined, controller.signal, { createWorker: factory });
    while (!started) await Promise.resolve();
    controller.abort();
    await assert.rejects(pending, abortName);
    assert.equal(terminated, 1);
    resolveRecognition({ data: { text: 'must not surface', confidence: 99 } });
    await Promise.resolve();
    assert.equal(terminated, 1);
  });
});
