import { Router } from "express";
import tournamentController from "./tournament.controller";
import adminOnly from "../../middlewares/admin.middleware";
import { optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import tieSheet from "./tournament.tiesheet";

const router = Router();

// Tournament routes
// Customer app: the current tournament with its tie-sheet (/current, /:id/tiesheet)
router.use(tieSheet);

// Public lists return a safe summary; staff (with a token) get everything
router.get("/", optionalAuthMiddleware, tournamentController.getAllTournaments);
router.get("/registrations", ...adminOnly, tournamentController.getRegistrations);
router.post("/registrations", tournamentController.submitRegistration);
router.get("/affected-items", ...adminOnly, tournamentController.getAffectedItems);
router.post("/apply-actions", ...adminOnly, tournamentController.applyActions);
router.get("/:id", optionalAuthMiddleware, tournamentController.getTournamentById);
router.post("/:id/invoice", ...adminOnly, tournamentController.uploadInvoice);
router.post("/", ...adminOnly, tournamentController.createTournament);
router.patch("/:id/complete", ...adminOnly, tournamentController.completeTournament);
router.patch("/:id", ...adminOnly, tournamentController.updateTournament);
router.delete("/:id", ...adminOnly, tournamentController.deleteTournament);

export default router;
