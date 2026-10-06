import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import contentService from "./content.service";

/* ---------- /api/content (public: no sign-in needed to see gallery and ads) ---------- */
export const contentRouter = Router();

contentRouter.get("/active", asyncHandler(async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  res.json(ApiResponseUtil.success(200, "Site content", await contentService.active()));
}));

// A picture is never edited in place (a replacement gets a new id), so it can be cached for a year.
contentRouter.get("/media/:id", asyncHandler(async (req: Request, res: Response) => {
  const m = await contentService.media(req.params.id);
  res.set({ "Content-Type": m.mime, "Cache-Control": "public, max-age=31536000, immutable", "Cross-Origin-Resource-Policy": "cross-origin" });
  res.send(Buffer.from(m.data));
}));

contentRouter.post("/ads/:id/view", asyncHandler(async (req: Request, res: Response) => {
  await contentService.count(req.params.id, "impressions");
  res.status(204).end();
}));

contentRouter.post("/ads/:id/click", asyncHandler(async (req: Request, res: Response) => {
  await contentService.count(req.params.id, "clicks");
  res.status(204).end();
}));
