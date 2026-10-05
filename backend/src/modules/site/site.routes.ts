import { Router, Response, Request } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import adminOnly from "../../middlewares/admin.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AuditService } from "../audit";
import { prisma } from "../../config/db";

// Public business details (footer, Help page, WhatsApp button). Stored as one JSON setting, editable by staff.
const KEY = "siteInfo";

const DEFAULTS = {
  name: "Unique Futsal",
  phone: "9811940018",
  whatsapp: "https://wa.me/9779811940018",
  email: "info.uniquefutsal@gmail.com",
  address: "Manigram Tilottama-05, Rupandehi, Nepal",
  facebook: "",
  tiktok: "",
  mapEmbed: "https://www.google.com/maps?q=Unique+Futsal+Tilottama+Rupandehi+Nepal&output=embed",
};

const FIELDS = Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[];

async function load() {
  const row = await prisma.settings.findUnique({ where: { key: KEY } });
  let saved: Partial<typeof DEFAULTS> = {};
  try {
    saved = row ? JSON.parse(row.value) : {};
  } catch {
    saved = {};
  }
  return { ...DEFAULTS, ...saved };
}

const router = Router();

router.get("/", asyncHandler(async (_req: Request, res: Response) => res.json(ApiResponseUtil.success(200, "Site info", await load()))));

router.patch(
  "/",
  ...adminOnly,
  FIELDS.map((f) => body(f).optional({ nullable: true }).isString().trim().isLength({ max: 500 })),
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const next = { ...(await load()) };
    for (const f of FIELDS) if (typeof req.body[f] === "string") next[f] = req.body[f];
    await prisma.settings.upsert({ where: { key: KEY }, update: { value: JSON.stringify(next) }, create: { key: KEY, value: JSON.stringify(next) } });
    await AuditService.log({ action: "SITE_INFO_UPDATE", entity: "Settings", entityId: KEY, changes: Object.keys(req.body).join(", "), userId: req.user!.id });
    res.json(ApiResponseUtil.success(200, "Site info saved", next));
  }),
);

export default router;
