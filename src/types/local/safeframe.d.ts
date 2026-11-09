import type { SafeFrameGeometry } from '../../utils.ts';

declare global {
  interface Window {
    $sf?: SafeFrameAPI;
  }

  interface SafeFrameAPI {
    ext: SafeFrameExternalAPI;
  }

  interface SafeFrameExternalAPI {
    register(
      width: number,
      height: number,
      notify?: (event: string, data?: unknown) => void
    ): void;

    expand(dimensions?: {
      t?: number;
      b?: number;
      l?: number;
      r?: number;
      push?: boolean;
    }): void;

    collapse(): void;

    geom(): SafeFrameGeometry;

    inViewPercentage(): number;

    status(): string;

    supports(feature: string): boolean;
  }
}
