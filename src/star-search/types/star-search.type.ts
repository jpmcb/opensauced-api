import { z } from "zod";

export enum StarSearchEventTypeEnum {
  final = "final",
  content = "content",
  function_call = "function_call",
}

export enum StarSearchPayloadStatusEnum {
  in_progress = "in_progress",
  done = "done",
}

export const StarSearchContent = z.object({
  type: z.nativeEnum(StarSearchEventTypeEnum),
  parts: z.array(z.string()),
});

export const StarSearchError = z.object({
  type: z.string(),
  message: z.string(),
});

export const StarSearchPayload = z.object({
  id: z.string().optional(),
  author: z.string().optional(),
  iso_time: z.string(),
  content: StarSearchContent,
  status: z.nativeEnum(StarSearchPayloadStatusEnum),
  error: StarSearchError.optional().nullable(),
});

export type StarSearchPayload = z.infer<typeof StarSearchPayload>;
