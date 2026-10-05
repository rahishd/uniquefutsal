import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import tournamentService from "./tournament.service";
import { AuditService } from "../audit";
import { publicTournament } from "./tournament.tiesheet";

const isStaff = (req: Request) => {
  const role = (req as AuthRequest).user?.role;
  return role === "admin" || role === "superadmin";
};

class TournamentController {
  async getAllTournaments(req: Request, res: Response, next: NextFunction) {
    try {
      const tournaments = await tournamentService.getAllTournaments();
      // Team registrations hold phone numbers and emails: only staff see them.
      const data = isStaff(req) ? tournaments : await Promise.all(tournaments.map((t) => publicTournament(t)));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getTournamentById(req: Request, res: Response, next: NextFunction) {
    try {
      const tournament = await tournamentService.getTournamentById(req.params.id);
      if (!tournament) {
        return res.status(404).json({ success: false, message: "Tournament not found" });
      }
      res.status(200).json({ success: true, data: isStaff(req) ? tournament : await publicTournament(tournament) });
    } catch (error) {
      next(error);
    }
  }

  async createTournament(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tournament = await tournamentService.createTournament(req.body);
      
      await AuditService.log({
        action: "CREATE_TOURNAMENT",
        entity: "Tournament",
        entityId: tournament.id,
        changes: `Created tournament "${tournament.name}" starting on ${tournament.startDate}`,
        userId: req.user?.id,
      });

      res.status(201).json({ success: true, data: tournament });
    } catch (error) {
      next(error);
    }
  }

  async updateTournament(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tournament = await tournamentService.updateTournament(req.params.id, req.body);
      
      await AuditService.log({
        action: "UPDATE_TOURNAMENT",
        entity: "Tournament",
        entityId: tournament.id,
        changes: `Updated tournament "${tournament.name}" details`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, data: tournament });
    } catch (error) {
      next(error);
    }
  }

  async deleteTournament(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await tournamentService.deleteTournament(req.params.id);
      
      await AuditService.log({
        action: "DELETE_TOURNAMENT",
        entity: "Tournament",
        entityId: req.params.id,
        changes: `Deleted tournament ID: ${req.params.id}`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, message: "Tournament deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  // Registrations
  async getRegistrations(req: Request, res: Response, next: NextFunction) {
    try {
      const tournamentId = req.query.tournamentId as string | undefined;
      const registrations = await tournamentService.getRegistrations(tournamentId);
      
      // Parse players JSON
      const formatted = registrations.map((r: any) => ({
        ...r,
        players: r.players ? JSON.parse(r.players) : []
      }));

      res.status(200).json({ success: true, data: formatted });
    } catch (error) {
      next(error);
    }
  }

  async submitRegistration(req: Request, res: Response, next: NextFunction) {
    try {
      const registration = await tournamentService.createRegistration(req.body);
      res.status(201).json({ 
        success: true, 
        data: {
          ...registration,
          players: JSON.parse(registration.players)
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { pdfBase64 } = req.body;

      if (!pdfBase64) {
        return res.status(400).json({ success: false, message: "PDF content is required" });
      }

      const result = await tournamentService.uploadInvoice(id, pdfBase64);

      res.status(200).json({ 
        success: true, 
        message: "Tournament invoice uploaded successfully", 
        data: result 
      });
    } catch (error) {
      next(error);
    }
  }

  async getAffectedItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, tournamentId } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: "startDate and endDate are required" });
      }
      const data = await tournamentService.getAffectedItems(
        startDate as string, 
        endDate as string, 
        tournamentId as string
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async applyActions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { actions } = req.body;
      if (!actions || !Array.isArray(actions)) {
        return res.status(400).json({ success: false, message: "actions array is required" });
      }
      const result = await tournamentService.applyTournamentActions(actions);
      
      await AuditService.log({
        action: "APPLY_TOURNAMENT_ACTIONS",
        entity: "Tournament",
        entityId: "bulk",
        changes: `Applied tournament conflict resolution actions for ${actions.length} items`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async completeTournament(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tournament = await tournamentService.completeTournament(id);
      
      await AuditService.log({
        action: "COMPLETE_TOURNAMENT",
        entity: "Tournament",
        entityId: id,
        changes: `Completed tournament "${tournament.name}"`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, data: tournament });
    } catch (error) {
      next(error);
    }
  }
}

export default new TournamentController();
