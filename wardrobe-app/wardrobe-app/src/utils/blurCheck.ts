// src/utils/blurCheck.ts
//
// HONEST LIMITATION: this is NOT real blur detection (no Laplacian/
// edge-variance analysis — that needs either a native image-processing
// module or running a model, neither of which is in this project and
// both need a rebuild to add). This is a lightweight heuristic: for a
// given resolution, a blurry or low-detail photo JPEG-compresses
// smaller than a sharp one (less high-frequency detail = more
// redundancy for the compressor to exploit). It's a real, non-random
// signal, but it WILL false-positive on legitimately simple photos
// (e.g. a plain white t-shirt on a plain background) and false-negative
// on some blur. Treat its output as a nudge to double-check, never a
// hard gate — this file never blocks an upload, only suggests a retake.
export interface BlurCheckResult {
  looksBlurry: boolean;
  reason: string | null;
}

const MIN_DIMENSION = 500; // below this on the shorter side, flag as low-res regardless of compression
const BYTES_PER_PIXEL_THRESHOLD = 0.12; // below this, flag as possibly blurry/low-detail

export async function checkPhotoBlur(uri: string, width?: number, height?: number): Promise<BlurCheckResult> {
  try {
    if (width && height) {
      const shortSide = Math.min(width, height);
      if (shortSide < MIN_DIMENSION) {
        return { looksBlurry: true, reason: 'This photo is quite low-resolution — it may look blurry once uploaded.' };
      }
    }

    const blob = await (await fetch(uri)).blob();
    if (width && height && blob.size > 0) {
      const bytesPerPixel = blob.size / (width * height);
      if (bytesPerPixel < BYTES_PER_PIXEL_THRESHOLD) {
        return { looksBlurry: true, reason: "This photo looks a little soft — you might want to retake it in better light." };
      }
    }
    return { looksBlurry: false, reason: null };
  } catch {
    // If the check itself fails (e.g. can't fetch the blob), fail open
    // — never block the upload over the blur check breaking.
    return { looksBlurry: false, reason: null };
  }
}
