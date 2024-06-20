import { z } from "zod";

export const RenderLottoFactorParams = z.object({
  repoName: z.string({ description: "The name of the GitHub repository to render the lottery factor chart for." }),
});
export type RenderLottoFactorParams = z.infer<typeof RenderLottoFactorParams>;
