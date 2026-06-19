/**
 * Pick the best recipe preview image from video keyframes (text-heavy / sharp frames).
 */

function grayscaleAt(data: Uint8ClampedArray, width: number, x: number, y: number): number {
  const i = (y * width + x) * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/** Score a frame: higher = more contrast/edges (likely on-screen recipe text). */
export async function scoreFrameDataUrl(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 320;
      const w = Math.min(img.width, maxW);
      const h = Math.max(1, Math.round(img.height * (w / img.width)));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(0);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);

      let sum = 0;
      let sumSq = 0;
      let edge = 0;
      let n = 0;

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const g = grayscaleAt(data, w, x, y);
          const gLeft = grayscaleAt(data, w, x - 1, y);
          const gUp = grayscaleAt(data, w, x, y - 1);
          sum += g;
          sumSq += g * g;
          edge += Math.abs(g - gLeft) + Math.abs(g - gUp);
          n++;
        }
      }

      const mean = sum / n;
      const variance = sumSq / n - mean * mean;
      const edgeScore = edge / n;

      // Skip near-blank frames
      if (variance < 80) {
        resolve(0);
        return;
      }

      resolve(variance * 0.25 + edgeScore * 1.5);
    };
    img.onerror = () => resolve(0);
    img.src = dataUrl;
  });
}

/** Pick the keyframe most likely to show readable recipe content. */
export async function pickBestFrameDataUrl(
  frames: string[]
): Promise<string | undefined> {
  if (!frames.length) return undefined;
  if (frames.length === 1) return frames[0];

  let best = frames[0];
  let bestScore = -1;

  for (const frame of frames) {
    const score = await scoreFrameDataUrl(frame);
    if (score > bestScore) {
      bestScore = score;
      best = frame;
    }
  }

  return bestScore > 0 ? best : frames[Math.floor(frames.length / 2)];
}

/** Fetch a remote thumbnail for upload (may fail on CORS-restricted hosts). */
export async function fetchImageAsFile(
  url: string,
  filename: string
): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const blob = await response.blob();
  const mime = blob.type || "image/jpeg";
  const ext = mime.includes("png") ? "png" : "jpg";
  return new File([blob], `${filename}.${ext}`, { type: mime });
}
