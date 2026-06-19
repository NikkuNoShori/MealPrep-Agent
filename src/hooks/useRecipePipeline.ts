import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api";
import {
  mapPipelineToChatResponse,
  processUploadedVideo,
  processVideoIntake,
  processVideoUrl,
} from "@/services/videoIntake";

export type RecipePipelineSourceType = "url" | "text" | "video";

export interface IngestRecipeParams {
  sourceType: RecipePipelineSourceType;
  data: Record<string, unknown>;
  autoSave?: boolean;
}

export interface VideoIntakeParams {
  message?: string;
  videoFile?: File;
  pinnedCommentText?: string;
  supplementaryText?: string;
  autoSave?: boolean;
}

function routeIngest({ sourceType, data, autoSave = true }: IngestRecipeParams) {
  switch (sourceType) {
    case "url":
      return apiClient.ingestRecipeFromUrl(
        String(data.url ?? ""),
        autoSave,
        data as Parameters<typeof apiClient.ingestRecipeFromUrl>[2]
      );
    case "text":
      return apiClient.ingestRecipeFromText(
        String(data.text ?? ""),
        data.images as string[] | undefined,
        autoSave
      );
    case "video":
      return apiClient.ingestRecipeFromVideo(
        data as Parameters<typeof apiClient.ingestRecipeFromVideo>[0],
        autoSave
      );
    default:
      throw new Error(`Unknown sourceType: ${sourceType}`);
  }
}

/** Full pipeline ingest (optional auto-save). */
export function useIngestRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: IngestRecipeParams) => routeIngest(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

/** Extract + validate without saving (preview). */
export function useExtractRecipePreview() {
  return useMutation({
    mutationFn: ({
      sourceType,
      data,
    }: {
      sourceType: RecipePipelineSourceType;
      data: Record<string, unknown>;
    }) => apiClient.extractRecipeOnly(sourceType, data),
  });
}

/** ToS-compliant short-form video URL (oEmbed + link mining). */
export function useProcessVideoUrl() {
  return useMutation({
    mutationFn: ({
      url,
      ...options
    }: { url: string } & Parameters<typeof processVideoUrl>[1]) =>
      processVideoUrl(url, options),
  });
}

/** User-uploaded saved video (frames + STT + OCR). */
export function useProcessUploadedVideo() {
  return useMutation({
    mutationFn: ({
      file,
      ...options
    }: { file: File } & Parameters<typeof processUploadedVideo>[1]) =>
      processUploadedVideo(file, options),
  });
}

/** Smart URL-or-file intake with optional chat response mapping. */
export function useVideoRecipeIntake() {
  return useMutation({
    mutationFn: async (params: VideoIntakeParams) => {
      const outcome = await processVideoIntake(params);
      return {
        pipeline: outcome.pipeline,
        chat: mapPipelineToChatResponse(outcome),
      };
    },
  });
}
