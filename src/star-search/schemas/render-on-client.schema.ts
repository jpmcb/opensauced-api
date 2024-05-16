import { z } from "zod";

export const RenderLottoFactorParams = z.object({
  repoName: z.string(),
});
export type RenderLottoFactorParams = z.infer<typeof RenderLottoFactorParams>;
