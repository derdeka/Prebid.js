export {};
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

  interface SafeFrameGeometry {
    self?: {
      x: number;
      y: number;
      w: number;
      h: number;
    };

    exp?: {
      t: number;
      b: number;
      l: number;
      r: number;
    };

    win?: {
      w: number;
      h: number;
    };

    view?: {
      x: number;
      y: number;
      w: number;
      h: number;
    };
  }
}
