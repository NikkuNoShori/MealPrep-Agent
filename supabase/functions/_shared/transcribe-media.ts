/**
 * Speech-to-text for user-uploaded media (video/audio files).
 * Uses OpenRouter-compatible transcription — never downloads from TikTok CDN.
 */

const MAX_MEDIA_BYTES = 24 * 1024 * 1024; // ~24MB edge payload guard

export async function transcribeMediaBytes(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string,
  filename = "media.mp4"
): Promise<string> {
  if (bytes.length === 0) {
    throw new Error("Empty media file");
  }
  if (bytes.length > MAX_MEDIA_BYTES) {
    throw new Error(
      `Media file too large (${(bytes.length / 1024 / 1024).toFixed(1)}MB). Max ${MAX_MEDIA_BYTES / 1024 / 1024}MB.`
    );
  }

  // Primary: OpenAI-compatible audio transcriptions via OpenRouter.
  try {
    return await whisperTranscribe(apiKey, bytes, mimeType, filename);
  } catch (primaryError) {
    console.warn("Whisper transcription failed, trying multimodal fallback:", primaryError);
    return await geminiAudioTranscribe(apiKey, bytes, mimeType);
  }
}

/** Download user-uploaded media from a public/signed URL and transcribe. */
export async function transcribeMediaFromUrl(
  apiKey: string,
  mediaUrl: string
): Promise<string> {
  const response = await fetch(mediaUrl, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const mimeType = response.headers.get("content-type") || "video/mp4";
  const filename = mediaUrl.split("/").pop()?.split("?")[0] || "media.mp4";
  return transcribeMediaBytes(apiKey, bytes, mimeType, filename);
}

async function whisperTranscribe(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string,
  filename: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", new Blob([bytes], { type: mimeType }), filename);
  formData.append("model", "openai/whisper-large-v3");

  const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": Deno.env.get("FRONTEND_URL") || "",
      "X-Title": "MealPrep Agent",
    },
    body: formData,
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Transcription API failed: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = (data.text as string | undefined)?.trim();
  if (!text) throw new Error("Transcription returned empty text");
  return text;
}

/** Fallback when dedicated transcription endpoint is unavailable. */
async function geminiAudioTranscribe(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string
): Promise<string> {
  const base64 = uint8ToBase64(bytes);
  const format = mimeType.includes("webm")
    ? "webm"
    : mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("mpeg") || mimeType.includes("mp3")
    ? "mp3"
    : "mp4";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": Deno.env.get("FRONTEND_URL") || "",
      "X-Title": "MealPrep Agent",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Transcribe all spoken words in this audio verbatim. Output only the transcription text with no commentary.",
            },
            {
              type: "input_audio",
              input_audio: { data: base64, format },
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini audio fallback failed: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Gemini audio fallback returned empty text");
  return text;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
