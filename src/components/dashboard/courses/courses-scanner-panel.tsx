'use client';

import { BarcodeScannerPanel } from '@/components/ui/barcode-scanner-panel';
import { useLanguage } from '@/lib/i18n-context';

interface CoursesScannerPanelProps {
  /** Session is active — attach the hardware-wedge listener. */
  enabled: boolean;
  onCode: (rawCode: string) => void;
}

/**
 * Course-scan surface. Delegates to the shared camera panel (the same one the
 * expense barcode scan uses) so both surfaces stay pixel-identical: camera
 * feed with 2× default zoom, scan frame, torch, zoom, beep/flash/haptic
 * feedback and a manual code entry.
 */
export function CoursesScannerPanel({ enabled, onCode }: CoursesScannerPanelProps) {
  const { messages } = useLanguage();
  const c = messages.courses;

  return (
    <BarcodeScannerPanel
      enabled={enabled}
      onCode={onCode}
      labels={{
        title: c.scanTitle,
        cameraStart: c.cameraStart,
        cameraStop: c.cameraStop,
        idleHint: c.scanHint,
        alignHint: c.alignHint,
        scanned: c.scanned,
        zoomIn: c.zoomIn,
        zoomOut: c.zoomOut,
        torchOn: c.torchOn,
        torchOff: c.torchOff,
        cameraUnavailable: c.cameraDenied,
        manualPlaceholder: c.manualCode,
        lookup: c.lookup,
      }}
    />
  );
}
