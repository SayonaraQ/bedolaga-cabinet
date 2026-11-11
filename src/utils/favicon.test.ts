import { afterEach, describe, expect, it, vi } from 'vitest';
import { alphaBoundingBox, containRect, edgeColorOfPixels, roundedFaviconDataUri } from './favicon';

type Rgba = [number, number, number, number];

const RED: Rgba = [0xe5, 0x39, 0x35, 255];
const BLUE: Rgba = [0x1e, 0x88, 0xe5, 255];
const CLEAR: Rgba = [0, 0, 0, 0];

/** RGBA-буфер как у ImageData: цвет пикселя задаёт `paint(x, y)`. */
function pixels(size: number, paint: (x: number, y: number) => Rgba): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) data.set(paint(x, y), (y * size + x) * 4);
  }
  return data;
}

describe('alphaBoundingBox', () => {
  it('finds the visible logo inside transparent margins', () => {
    const data = pixels(20, (x, y) => (x >= 3 && x < 17 && y >= 2 && y < 18 ? RED : CLEAR));
    expect(alphaBoundingBox(data, 20, 20)).toEqual({ x: 3, y: 2, w: 14, h: 16 });
  });

  it('returns the full box for an opaque image', () => {
    expect(
      alphaBoundingBox(
        pixels(20, () => RED),
        20,
        20,
      ),
    ).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });

  it('returns null for a fully transparent image', () => {
    expect(
      alphaBoundingBox(
        pixels(20, () => CLEAR),
        20,
        20,
      ),
    ).toBeNull();
  });

  it('requires alpha strictly above the threshold and respects rectangular images', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 8, 0, 0, 0, 9, 0, 0, 0, 0]);
    expect(alphaBoundingBox(data, 3, 1)).toEqual({ x: 1, y: 0, w: 1, h: 1 });
    expect(alphaBoundingBox(data, 3, 1, 9)).toBeNull();
  });
});

describe('containRect', () => {
  it('centres a tall logo without cropping or padding along its height', () => {
    expect(containRect(40, 80, 16)).toEqual({ dx: 4, dy: 0, dw: 8, dh: 16 });
  });

  it('centres a wide logo without cropping or padding along its width', () => {
    expect(containRect(80, 40, 16)).toEqual({ dx: 0, dy: 4, dw: 16, dh: 8 });
  });
});

describe('roundedFaviconDataUri', () => {
  afterEach(() => vi.unstubAllGlobals());

  function mockImage(data: Uint8ClampedArray, width = 100, height = 100) {
    const targetContext = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
    };
    const sampleContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data })),
    };
    const target = {
      width: 0,
      height: 0,
      getContext: () => targetContext,
      toDataURL: () => 'data:image/png;base64,icon',
    };
    const sample = { width: 0, height: 0, getContext: () => sampleContext };
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValueOnce(target).mockReturnValueOnce(sample),
    });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal(
      'Image',
      class {
        width = width;
        height = height;
        onload: (() => void) | null = null;
        set src(_value: string) {
          this.onload?.();
        }
      },
    );
    return { targetContext, sampleContext, sample };
  }

  it('samples at 512px, maps the crop back to the original and contains it in the tile', async () => {
    const data = new Uint8ClampedArray(512 * 256 * 4);
    for (let y = 32; y < 224; y++) {
      for (let x = 128; x < 384; x++) data[(y * 512 + x) * 4 + 3] = 255;
    }
    const { targetContext, sampleContext, sample } = mockImage(data, 1024, 512);
    expect(await roundedFaviconDataUri('/logo.png')).toBe('data:image/png;base64,icon');
    expect([sample.width, sample.height]).toEqual([512, 256]);
    expect(sampleContext.getImageData).toHaveBeenCalledWith(0, 0, 512, 256);
    expect(targetContext.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      256,
      64,
      512,
      384,
      0,
      8,
      64,
      48,
    );
    expect(targetContext.clip).toHaveBeenCalledOnce();
  });

  it('keeps the existing cover behaviour for an opaque rectangular image', async () => {
    const { targetContext } = mockImage(new Uint8ClampedArray(100 * 50 * 4).fill(255), 100, 50);
    await roundedFaviconDataUri('/logo.png');
    expect(targetContext.drawImage).toHaveBeenCalledWith(expect.anything(), -32, 0, 128, 64);
  });

  it('keeps cover when transparent margins take exactly 2% of the width', async () => {
    const { targetContext } = mockImage(pixels(100, (x) => (x >= 1 && x < 99 ? RED : CLEAR)));
    await roundedFaviconDataUri('/logo.png');
    expect(targetContext.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 64, 64);
  });

  it.each(['empty', 'tainted'] as const)('falls back to cover for an %s sample', async (kind) => {
    const { targetContext, sampleContext } = mockImage(new Uint8ClampedArray(100 * 100 * 4));
    if (kind === 'tainted')
      sampleContext.getImageData.mockImplementation(() => {
        throw new Error('SecurityError');
      });
    expect(await roundedFaviconDataUri('/logo.png')).toBe('data:image/png;base64,icon');
    expect(targetContext.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 64, 64);
  });
});

describe('edgeColorOfPixels', () => {
  // Логотип-плитка на фоне тёмной темы: maskable ужимает содержимое до 80 %, и у
  // иконки на рабочем столе Android появлялись чёрные полоски по краям.
  it('returns the color a full-bleed logo is filled with', () => {
    const data = pixels(20, (x, y) => (x > 5 && x < 14 && y > 5 && y < 14 ? BLUE : RED));
    expect(edgeColorOfPixels(data, 20, 20)).toBe('rgb(229, 57, 53)');
  });

  it('ignores the transparent corners of a baked-in rounding', () => {
    const data = pixels(20, (x, y) => {
      const corner = (x < 3 || x > 16) && (y < 3 || y > 16);
      return corner ? CLEAR : RED;
    });
    expect(edgeColorOfPixels(data, 20, 20)).toBe('rgb(229, 57, 53)');
  });

  it('keeps the theme background for a glyph on a transparent canvas', () => {
    const data = pixels(20, (x, y) => (x > 2 && x < 17 && y > 2 && y < 17 ? RED : CLEAR));
    expect(edgeColorOfPixels(data, 20, 20)).toBeNull();
  });

  it('does not guess when the edge has no single color', () => {
    const data = pixels(20, (x) => (x < 10 ? RED : BLUE));
    expect(edgeColorOfPixels(data, 20, 20)).toBeNull();
  });

  it('tolerates antialiasing noise of a few levels per channel', () => {
    const data = pixels(20, (x, y) => [0xe5 + ((x + y) % 5), 0x39, 0x35 - ((x * y) % 4), 255]);
    expect(edgeColorOfPixels(data, 20, 20)).not.toBeNull();
  });
});
