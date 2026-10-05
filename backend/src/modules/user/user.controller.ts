import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { userService } from "./user.service";
import { AuditService } from "../audit";
import { prisma } from "../../config/db";

export const userController = {
  async searchPlayers(req: Request, res: Response) {
    try {
      const q = String(req.query.q || "");
      const results = await userService.searchPlayers(q, 10);
      res.status(200).json({
        success: true,
        message: "Players fetched successfully",
        data: results,
      });
    } catch (error) {
      console.error("Error searching players:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async getAllPlayers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 7;
      const search = req.query.search as string | undefined;

      const { players, total, stats } = await userService.getAllPlayers(page, limit, search);
      res.status(200).json({
        success: true,
        message: "Players fetched successfully",
        data: players,
        stats: stats,
        pagination: {
           page,
           limit,
           total,
           totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async getPlayerBookings(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.params;
      const bookings = await userService.getPlayerBookings(phoneNumber);
      res.status(200).json({
        success: true,
        message: "Bookings fetched successfully",
        data: bookings,
      });
    } catch (error) {
      console.error("Error fetching player bookings:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async deletePlayer(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber } = req.params;
      const result = await userService.deleteUser(phoneNumber);
      
      const parts = [
        `Player with phone ${phoneNumber}${result.userName ? ` (${result.userName})` : ""} was deleted.`,
        `Cleared personal details from ${result.bookingsCount} booking records (Revenue preserved: Rs. ${result.bookingsTotalRevenue.toLocaleString()}).`
      ];

      if (result.ordersCount > 0) {
        parts.push(`Re-associated ${result.ordersCount} shop orders (Revenue preserved: Rs. ${result.ordersTotalRevenue.toLocaleString()}).`);
      }

      await AuditService.log({
        action: "DELETE_PLAYER",
        entity: "Player",
        entityId: phoneNumber,
        changes: parts.join(" "),
        userId: req.user?.id,
      });

      res.status(200).json({
        success: true,
        message: "Player deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting player:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async claimFreeMatch(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber } = req.params;
      const player = await prisma.user.findUnique({ where: { phoneNumber } });
      const playerName = player?.name || "Unknown Player";

      await userService.claimFreeMatch(phoneNumber);
      
      await AuditService.log({
        action: "CLAIM_FREE_MATCH",
        entity: "Player",
        entityId: phoneNumber,
        changes: `Claimed 1 free match for player "${playerName}" (${phoneNumber})`,
        userId: req.user?.id,
      });

      res.status(200).json({
        success: true,
        message: "Free match claimed successfully",
      });
    } catch (error: any) {
      console.error("Error claiming free match:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  },

  async awardFreeMatch(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber } = req.params;
      const player = await prisma.user.findUnique({ where: { phoneNumber } });
      const playerName = player?.name || "Unknown Player";

      await userService.awardFreeMatch(phoneNumber);
      
      await AuditService.log({
        action: "AWARD_FREE_MATCH",
        entity: "Player",
        entityId: phoneNumber,
        changes: `Awarded 1 free match to player "${playerName}" (${phoneNumber})`,
        userId: req.user?.id,
      });

      res.status(200).json({
        success: true,
        message: "Free match awarded successfully",
      });
    } catch (error: any) {
      console.error("Error awarding free match:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  },

  async updatePlayer(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber } = req.params;
      const player = await prisma.user.findUnique({ where: { phoneNumber } });
      const playerName = player?.name || "Unknown Player";

      const data = req.body;
      const result = await userService.updatePlayer(phoneNumber, data);
      
      await AuditService.log({
        action: "UPDATE_PLAYER",
        entity: "Player",
        entityId: phoneNumber,
        changes: `Updated player "${playerName}" (${phoneNumber}) details`,
        userId: req.user?.id,
      });

      res.status(200).json({
        success: true,
        message: "Player updated successfully",
        data: result,
      });
    } catch (error: any) {
      console.error("Error updating player:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
};
