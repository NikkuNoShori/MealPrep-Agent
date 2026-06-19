/**
 * Extract evenly-spaced keyframes from a user-uploaded video file (browser only).
 * Frames are returned as JPEG data URLs for pipeline OCR.
 */

const DEFAULT_FRAME_COUNT = 8;
const MAX_FRAME_COUNT = 12;
/** Keep frames small — they are sent as base64 in the extract-only request body. */
const MAX_FRAME_DIMENSION = 960;
const FRAME_JPEG_QUALITY = 0.72;

export interface ExtractFramesOptions {
  frameCount?: number;
  jpegQuality?: number;
}

export async function extractVideoFrames(
  file: File,
  options: ExtractFramesOptions = {}
): Promise<string[]> {
  if (!file.type.startsWith("video/")) {
    throw new Error("File is not a video");
  }

  const frameCount = Math.min(
    Math.max(options.frameCount ?? DEFAULT_FRAME_COUNT, 1),
    MAX_FRAME_COUNT
  );
  const jpegQuality = options.jpegQuality ?? FRAME_JPEG_QUALITY;

  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = objectUrl;

    await waitForEvent(video, "loadedmetadata");

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Could not read video duration");
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");

    const frames: string[] = [];

    for (let i = 0; i < frameCount; i++) {
      const t = (duration * (i + 0.5)) / frameCount;
      video.currentTime = t;
      await waitForEvent(video, "seeked");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      let drawWidth = video.videoWidth;
      let drawHeight = video.videoHeight;
      if (drawWidth > MAX_FRAME_DIMENSION || drawHeight > MAX_FRAME_DIMENSION) {
        const ratio = Math.min(
          MAX_FRAME_DIMENSION / drawWidth,
          MAX_FRAME_DIMENSION / drawHeight
        );
        drawWidth = Math.round(drawWidth * ratio);
        drawHeight = Math.round(drawHeight * ratio);
        canvas.width = drawWidth;
        canvas.height = drawHeight;
      }
      ctx.drawImage(video, 0, 0, drawWidth, drawHeight);
      frames.push(canvas.toDataURL("image/jpeg", jpegQuality));
    }

    return frames;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function waitForEvent(
  target: HTMLVideoElement,
  event: "loadedmetadata" | "seeked"
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error(`Video ${event} failed`));
    };
    const cleanup = () => {
      target.removeEventListener(event, onOk);
      target.removeEventListener("error", onErr);
    };
    target.addEventListener(event, onOk, { once: true });
    target.addEventListener("error", onErr, { once: true });
  });
}

/** Max upload size aligned with edge transcription guard. */
export const MAX_INTAKE_VIDEO_BYTES = 24 * 1024 * 1024;

export function validateIntakeVideoFile(file: File): void {
  if (!file.type.startsWith("video/")) {
    throw new Error("Please select a video file (MP4, WebM, or MOV).");
  }
  if (file.size > MAX_INTAKE_VIDEO_BYTES) {
    throw new Error(
      `Video is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_INTAKE_VIDEO_BYTES / 1024 / 1024}MB.`
    );
  }
}
