import { Router } from "express";
import { userController } from "./user.controller";
import adminOnly from "../../middlewares/admin.middleware";

const router = Router();

// All player-management routes are staff only: they expose or change customer records.

// Search players (name/phone autocomplete)
router.get("/search", ...adminOnly, userController.searchPlayers);

// Get all players
router.get("/players", ...adminOnly, userController.getAllPlayers);

// Get player bookings
router.get("/players/:phoneNumber/bookings", ...adminOnly, userController.getPlayerBookings);

// Delete a player
router.delete("/:phoneNumber", ...adminOnly, userController.deletePlayer);

// Claim free match
router.post("/:phoneNumber/claim-free-match", ...adminOnly, userController.claimFreeMatch);

// Award free match
router.post("/:phoneNumber/award-free-match", ...adminOnly, userController.awardFreeMatch);

// Update a player (including phone number)
router.patch("/:phoneNumber", ...adminOnly, userController.updatePlayer);

export default router;
