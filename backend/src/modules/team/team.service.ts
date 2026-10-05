import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import BookingService from "../booking/booking.service";
import SettingsService from "../settings/settings.service";
import notificationService from "../notification/notification.service";
import loyaltyService from "../loyalty/loyalty.service";
import { addDaysKey, startsAtMs, todayKey } from "../../utils/dates";
import {
  LOSER_SHARES, LoserShare, MAX_TEAM_SIZE, MIN_TEAM_TO_CHALLENGE, TeamStats, addGame, emptyStats, rankTeams, settlement,
} from "../../utils/teamRating";

const PHONE = /^9\d{9}$/;
export const MAX_ADVANCE_DAYS = 10;
const POSITIONS = ["GK", "DEF", "MID", "FWD"];
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

type Tx = Prisma.TransactionClient;

export class TeamService {
  /* ---------- who is allowed ---------- */

  async myTeam(userId: string) {
    const m = await prisma.teamMember.findUnique({ where: { userId }, include: { team: true } });
    return m?.team ?? null;
  }

  // Captain mode on AND a team the user captains. Only captains challenge, answer, report and approve.
  async captainTeam(userId: string) {
    const prefs = await prisma.userPrefs.findUnique({ where: { userId } });
    if (prefs?.mode !== "captain") throw new AppError(403, "Switch to Captain mode first");
    const team = await prisma.team.findUnique({ where: { captainId: userId } });
    if (!team) throw new AppError(403, "Create your team first");
    return team;
  }

  /* ---------- stats from APPROVED results only ---------- */

  async statsByTeam(): Promise<Map<string, TeamStats>> {
    const results = await prisma.challengeResult.findMany({ where: { status: "approved" }, include: { challenge: true } });
    results.sort((a, b) => (a.challenge.date + hh(a.challenge.startHour)).localeCompare(b.challenge.date + hh(b.challenge.startHour)) || a.createdAt.getTime() - b.createdAt.getTime());
    const map = new Map<string, TeamStats>();
    const get = (id: string) => map.get(id) ?? emptyStats();
    for (const r of results) {
      const s = r.submittedByTeamId;
      const o = r.challenge.challengerTeamId === s ? r.challenge.challengedTeamId : r.challenge.challengerTeamId;
      map.set(s, addGame(get(s), r.scoreSubmitter, r.scoreOther));
      map.set(o, addGame(get(o), r.scoreOther, r.scoreSubmitter));
    }
    return map;
  }

  private async names(userIds: string[]) {
    const users = await prisma.user.findMany({ where: { phoneNumber: { in: userIds } }, select: { phoneNumber: true, name: true } });
    return new Map(users.map((u) => [u.phoneNumber, u.name ?? "Player"]));
  }

  async ranking() {
    const [teams, stats] = await Promise.all([prisma.team.findMany({ include: { members: { select: { id: true } } } }), this.statsByTeam()]);
    const ranked = rankTeams(teams.map((t) => ({ id: t.id, name: t.name, area: t.area, players: t.members.length, stats: stats.get(t.id) ?? emptyStats() })));
    return ranked.map((r) => ({ id: r.id, name: r.name, area: r.area, players: r.players, record: { played: r.stats.played, wins: r.stats.wins, draws: r.stats.draws, losses: r.stats.losses }, rating: r.rating, rank: r.rank }));
  }

  // Team stats only. There are no individual player stats anywhere in the app.
  async teamDetail(teamId: string) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: { select: { id: true } } } });
    if (!team) throw new AppError(404, "Team not found");
    const ranked = await this.ranking();
    const r = ranked.find((x) => x.id === teamId)!;
    const s = (await this.statsByTeam()).get(teamId) ?? emptyStats();
    return { id: team.id, name: team.name, area: team.area, players: team.members.length, rating: r.rating, rank: r.rank, record: r.record, goalsFor: s.gf, goalsAgainst: s.ga, form: s.form.slice(-5) };
  }

  async myTeamView(userId: string) {
    const team = await this.myTeam(userId);
    if (!team) return null;
    const members = await prisma.teamMember.findMany({ where: { teamId: team.id }, orderBy: { joinedAt: "asc" } });
    const names = await this.names(members.map((m) => m.userId));
    const detail = await this.teamDetail(team.id);
    return {
      ...detail,
      isCaptain: team.captainId === userId,
      captainId: team.captainId,
      maxPlayers: MAX_TEAM_SIZE,
      members: members.map((m) => ({ userId: m.userId, name: names.get(m.userId) ?? "Player", phone: m.userId, position: m.position, isCaptain: m.userId === team.captainId })),
    };
  }

  /* ---------- team and roster ---------- */

  async createTeam(userId: string, nameRaw: string) {
    const name = nameRaw.trim();
    if (name.length < 2 || name.length > 30) throw new AppError(400, "Team name must be 2 to 30 characters");
    const prefs = await prisma.userPrefs.findUnique({ where: { userId } });
    if (prefs?.mode !== "captain") throw new AppError(403, "Switch to Captain mode first");
    if (await this.myTeam(userId)) throw new AppError(409, "You are already in a team");
    try {
      const team = await prisma.team.create({
        data: { name, captainId: userId, members: { create: { userId, position: prefs.position ?? "MID" } } },
      });
      return team;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError(409, "A team with this name already exists");
      throw e;
    }
  }

  async addMember(captainId: string, phoneRaw: string) {
    const team = await this.captainTeam(captainId);
    const phone = phoneRaw.replace(/\D/g, "");
    if (!PHONE.test(phone)) throw new AppError(400, "Enter a 10-digit mobile number starting with 9.");
    const count = await prisma.teamMember.count({ where: { teamId: team.id } });
    if (count >= MAX_TEAM_SIZE) throw new AppError(409, `Your team is full (${MAX_TEAM_SIZE} members).`);
    if (await prisma.teamMember.findFirst({ where: { teamId: team.id, userId: phone } })) throw new AppError(409, "This player is already in your team.");
    const user = await prisma.user.findUnique({ where: { phoneNumber: phone }, select: { phoneNumber: true, name: true, isActive: true } });
    if (!user || !user.isActive) throw new AppError(404, "No registered player has this number. Ask them to sign up first.");
    const other = await prisma.teamMember.findUnique({ where: { userId: phone }, include: { team: true } });
    if (other) throw new AppError(409, `${user.name ?? "This player"} is already in ${other.team.name}.`);
    const prefs = await prisma.userPrefs.findUnique({ where: { userId: phone } });
    try {
      const m = await prisma.teamMember.create({ data: { teamId: team.id, userId: phone, position: prefs?.position ?? "MID" } });
      await notificationService.notify({ userId: phone, type: "challenge", title: "You joined a team", message: `${team.name} added you as a player.`, href: "/team", dedupeKey: `team-join-${team.id}-${phone}` });
      return { userId: m.userId, name: user.name ?? "Player", position: m.position };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError(409, "This player is already in a team.");
      throw e;
    }
  }

  async removeMember(captainId: string, userId: string) {
    const team = await this.captainTeam(captainId);
    if (userId === team.captainId) throw new AppError(400, "The captain cannot be removed");
    const r = await prisma.teamMember.deleteMany({ where: { teamId: team.id, userId } });
    if (r.count === 0) throw new AppError(404, "Player is not in your team");
  }

  /* ---------- challenges ---------- */

  async createChallenge(userId: string, input: { teamId: string; type: string; date: string; hour: number; loserPct: number; message?: string }) {
    const team = await this.captainTeam(userId);
    if (input.teamId === team.id) throw new AppError(400, "You cannot challenge your own team.");
    const size = await prisma.teamMember.count({ where: { teamId: team.id } });
    if (size < MIN_TEAM_TO_CHALLENGE) throw new AppError(400, `Add at least ${MIN_TEAM_TO_CHALLENGE} players to your team before challenging.`);
    const other = await prisma.team.findUnique({ where: { id: input.teamId } });
    if (!other) throw new AppError(404, "Team not found");
    if (!["match", "competition"].includes(input.type)) throw new AppError(400, "Challenge type must be match or competition");
    if (!(LOSER_SHARES as readonly number[]).includes(input.loserPct)) throw new AppError(400, "Choose who pays: the losing team pays 70%, 60% or all of it.");
    const today = todayKey();
    if (input.date < today || input.date > addDaysKey(today, MAX_ADVANCE_DAYS)) throw new AppError(400, `Pick a date within the next ${MAX_ADVANCE_DAYS} days.`);
    const slots = await SettingsService.getTimeSlots();
    if (!Number.isInteger(input.hour) || !slots.includes(hh(input.hour))) throw new AppError(400, "That hour is not open for bookings");
    const dup = await prisma.challenge.findFirst({ where: { challengerTeamId: team.id, challengedTeamId: other.id, status: "pending" } });
    if (dup) throw new AppError(409, "You already have a pending challenge to this team.");

    const courtPrice = (await BookingService.quote(input.date, hh(input.hour), 1)).basePrice;
    const c = await prisma.challenge.create({
      data: {
        challengerTeamId: team.id, challengedTeamId: other.id, type: input.type, date: input.date, startHour: input.hour,
        courtPrice, loserPct: input.loserPct, message: input.message?.trim().slice(0, 140) || null,
      },
    });
    await notificationService.notify({
      userId: other.captainId, type: "challenge", title: "New challenge",
      message: `${team.name} challenged your team to a ${input.type === "match" ? "friendly match" : "competition match"}. Loser pays ${input.loserPct === 100 ? "in full" : input.loserPct + "%"}, paid at the venue.`,
      href: "/opponent", dedupeKey: `challenge-new-${c.id}`,
    });
    return c;
  }

  private async resultsFor(challengeIds: string[]) {
    return prisma.challengeResult.findMany({ where: { challengeId: { in: challengeIds } }, orderBy: { createdAt: "desc" } });
  }

  private async view(c: Prisma.ChallengeGetPayload<object>, myTeamId: string, teamNames: Map<string, string>, results: Prisma.ChallengeResultGetPayload<object>[]) {
    const mine = c.challengerTeamId === myTeamId;
    const otherId = mine ? c.challengedTeamId : c.challengerTeamId;
    const active = results.filter((r) => r.challengeId === c.id).find((r) => r.status !== "disputed") ?? results.find((r) => r.challengeId === c.id);
    let result = null;
    if (active) {
      const iSubmitted = active.submittedByTeamId === myTeamId;
      const myScore = iSubmitted ? active.scoreSubmitter : active.scoreOther;
      const theirScore = iSubmitted ? active.scoreOther : active.scoreSubmitter;
      const st = settlement(c.courtPrice, c.loserPct as LoserShare, myScore, theirScore);
      result = { id: active.id, status: active.status, submittedBy: iSubmitted ? "me" : "them", myScore, theirScore, myAmount: st.amountA, theirAmount: st.amountB, basis: st.basis };
    }
    return {
      id: c.id, direction: mine ? "out" : "in", team: { id: otherId, name: teamNames.get(otherId) ?? "Team" }, type: c.type, date: c.date, hour: c.startHour,
      courtPrice: c.courtPrice, loserPct: c.loserPct, message: c.message, status: c.status, bookingId: c.bookingId, venuePaidAt: c.venuePaidAt, result,
    };
  }

  async myChallenges(userId: string) {
    const team = await this.captainTeam(userId);
    const list = await prisma.challenge.findMany({ where: { OR: [{ challengerTeamId: team.id }, { challengedTeamId: team.id }] }, orderBy: { createdAt: "desc" }, take: 200 });
    const teams = await prisma.team.findMany({ where: { id: { in: [...new Set(list.flatMap((c) => [c.challengerTeamId, c.challengedTeamId]))] } }, select: { id: true, name: true } });
    const names = new Map(teams.map((t) => [t.id, t.name]));
    const results = await this.resultsFor(list.map((c) => c.id));
    return Promise.all(list.map((c) => this.view(c, team.id, names, results)));
  }

  private async load(id: string) {
    const c = await prisma.challenge.findUnique({ where: { id } });
    if (!c) throw new AppError(404, "Challenge not found");
    return c;
  }

  async answer(userId: string, id: string, accept: boolean) {
    const team = await this.captainTeam(userId);
    const c = await this.load(id);
    if (c.challengedTeamId !== team.id) throw new AppError(403, "Only the challenged captain can answer");
    if (c.status !== "pending") throw new AppError(409, `This challenge is already ${c.status}`);
    const challenger = await prisma.team.findUnique({ where: { id: c.challengerTeamId } });
    if (!challenger) throw new AppError(404, "Team not found");

    if (!accept) {
      await prisma.challenge.update({ where: { id }, data: { status: "declined" } });
      await notificationService.notify({ userId: challenger.captainId, type: "challenge", title: "Challenge declined", message: `${team.name} declined your challenge.`, href: "/opponent", dedupeKey: `challenge-declined-${id}` });
      return { id, status: "declined" };
    }

    if (c.date < todayKey()) throw new AppError(409, "This challenge date has passed");
    // Accepting creates the court booking. BookingService re-checks the slot and its unique hour guard decides
    // a race, so two games can never take the same hour.
    let booking;
    try {
      booking = await BookingService.createBooking(
        { date: c.date, startTime: hh(c.startHour), duration: 1, paymentMethod: "venue", notes: `CHALLENGE:${c.id}` },
        challenger.captainId,
      );
    } catch (e) {
      if (e instanceof AppError && (e.statusCode === 400 || e.statusCode === 409)) throw new AppError(409, "That court time is no longer free. Decline the challenge or ask for another time.");
      throw e;
    }
    await prisma.booking.update({ where: { id: booking.id }, data: { source: "challenge", challengeId: c.id, status: "confirmed", loyaltyEnabled: false } });
    await prisma.challenge.update({ where: { id }, data: { status: "accepted", bookingId: booking.id } });
    await notificationService.notify({ userId: challenger.captainId, type: "challenge", title: "Challenge accepted", message: `${team.name} accepted. Game on ${c.date} at ${hh(c.startHour)}. Paid at the venue after the game.`, href: "/opponent", dedupeKey: `challenge-accepted-${id}` });
    return { id, status: "accepted", bookingId: booking.id };
  }

  async cancel(userId: string, id: string) {
    const team = await this.captainTeam(userId);
    const c = await this.load(id);
    if (c.challengerTeamId !== team.id) throw new AppError(403, "Only the challenging captain can cancel");
    if (c.status === "pending") {
      await prisma.challenge.update({ where: { id }, data: { status: "cancelled" } });
      return { id, status: "cancelled" };
    }
    if (c.status === "accepted" && startsAtMs(c.date, c.startHour) > Date.now() && c.bookingId) {
      await prisma.challenge.update({ where: { id }, data: { status: "cancelled" } });
      await prisma.booking.update({ where: { id: c.bookingId }, data: { status: "cancelled", cancelledAt: new Date(), notes: `CHALLENGE:${c.id} | CANCELLED` } });
      await BookingService.freeSlots(c.bookingId);
      const other = await prisma.team.findUnique({ where: { id: c.challengedTeamId } });
      if (other) await notificationService.notify({ userId: other.captainId, type: "challenge", title: "Challenge cancelled", message: `${team.name} cancelled the game on ${c.date}.`, href: "/opponent", dedupeKey: `challenge-cancelled-${id}` });
      return { id, status: "cancelled" };
    }
    throw new AppError(409, "This challenge can no longer be cancelled");
  }

  /* ---------- results ---------- */

  // Only the WINNING captain (either side after a draw) uploads the overall score; the other captain approves.
  async submitResult(userId: string, challengeId: string, myScore: number, theirScore: number) {
    const team = await this.captainTeam(userId);
    const c = await this.load(challengeId);
    if (c.challengerTeamId !== team.id && c.challengedTeamId !== team.id) throw new AppError(403, "This is not your game");
    if (c.status !== "accepted") throw new AppError(409, "This game can't be reported.");
    if (startsAtMs(c.date, c.startHour) > Date.now()) throw new AppError(409, "You can report the score after the game starts");
    if (![myScore, theirScore].every((n) => Number.isInteger(n) && n >= 0 && n <= 50)) throw new AppError(400, "Enter whole-number scores.");
    if (myScore < theirScore) throw new AppError(403, "Only the winning captain uploads the score. Ask the other captain to upload it.");
    const open = await prisma.challengeResult.findFirst({ where: { challengeId, status: { not: "disputed" } } });
    if (open) throw new AppError(409, "A result has already been uploaded for this game.");
    const r = await prisma.challengeResult.create({ data: { challengeId, submittedByTeamId: team.id, scoreSubmitter: myScore, scoreOther: theirScore } });
    const otherId = c.challengerTeamId === team.id ? c.challengedTeamId : c.challengerTeamId;
    const other = await prisma.team.findUnique({ where: { id: otherId } });
    if (other) await notificationService.notify({ userId: other.captainId, type: "match", title: "Result awaiting your approval", message: `${team.name} reported ${myScore}-${theirScore}. Approve or dispute it.`, href: "/opponent", dedupeKey: `result-new-${r.id}` });
    return { id: r.id, status: r.status };
  }

  private async loadResult(id: string) {
    const r = await prisma.challengeResult.findUnique({ where: { id }, include: { challenge: true } });
    if (!r) throw new AppError(404, "Result not found");
    return r;
  }

  private otherTeamOf(r: { submittedByTeamId: string; challenge: { challengerTeamId: string; challengedTeamId: string } }) {
    return r.challenge.challengerTeamId === r.submittedByTeamId ? r.challenge.challengedTeamId : r.challenge.challengerTeamId;
  }

  async approve(userId: string, id: string) {
    const team = await this.captainTeam(userId);
    const r = await this.loadResult(id);
    if (this.otherTeamOf(r) !== team.id) throw new AppError(403, "Only the other captain can approve this result");
    return this.finalize(r, "approved", userId);
  }

  async dispute(userId: string, id: string) {
    const team = await this.captainTeam(userId);
    const r = await this.loadResult(id);
    if (this.otherTeamOf(r) !== team.id) throw new AppError(403, "Only the other captain can dispute this result");
    if (r.status !== "awaiting_approval") throw new AppError(409, `This result is already ${r.status}`);
    await prisma.challengeResult.update({ where: { id }, data: { status: "disputed" } });
    const sub = await prisma.team.findUnique({ where: { id: r.submittedByTeamId } });
    if (sub) await notificationService.notify({ userId: sub.captainId, type: "match", title: "Result disputed", message: `${team.name} disputed your result. Nothing was changed; the venue will review it.`, href: "/opponent", dedupeKey: `result-disputed-${id}` });
    return { id, status: "disputed" };
  }

  // approved -> counts for records and ratings, and the winning captain earns 5 points (never for a draw or a loss)
  private async finalize(r: Prisma.ChallengeResultGetPayload<{ include: { challenge: true } }>, to: "approved", by: string) {
    if (r.status !== "awaiting_approval" && r.status !== "disputed") throw new AppError(409, `This result is already ${r.status}`);
    const upd = await prisma.challengeResult.updateMany({ where: { id: r.id, status: r.status }, data: { status: to, approvedBy: by } });
    if (upd.count === 0) throw new AppError(409, "This result was just updated by someone else");
    if (r.scoreSubmitter !== r.scoreOther) {
      const winner = await prisma.team.findUnique({ where: { id: r.submittedByTeamId } }); // the submitter is the winner by rule
      if (winner) await loyaltyService.awardCaptainWin(winner.captainId, r.challengeId);
    }
    for (const teamId of [r.challenge.challengerTeamId, r.challenge.challengedTeamId]) {
      const t = await prisma.team.findUnique({ where: { id: teamId } });
      if (t) await notificationService.notify({ userId: t.captainId, type: "match", title: "Result approved", message: "The result is confirmed. Team records and ratings are updated.", href: "/opponent", dedupeKey: `result-approved-${r.id}-${t.captainId}` });
    }
    return { id: r.id, status: to };
  }

  // Staff resolve a disputed result: approve it as uploaded (or corrected), or void it.
  async resolveDispute(staffId: string, id: string, action: "approve" | "void", scores?: { scoreSubmitter: number; scoreOther: number }, note?: string) {
    const r = await this.loadResult(id);
    if (r.status !== "disputed") throw new AppError(409, "Only disputed results need staff review");
    if (action === "void") {
      await prisma.challengeResult.delete({ where: { id } });
      return { id, status: "voided" };
    }
    if (scores) {
      if (![scores.scoreSubmitter, scores.scoreOther].every((n) => Number.isInteger(n) && n >= 0 && n <= 50)) throw new AppError(400, "Enter whole-number scores.");
      // keep the rule: the submitter is the winning side (or a draw)
      if (scores.scoreSubmitter < scores.scoreOther) throw new AppError(400, "The submitting team must be the winner or a draw. Void and ask the winner to upload.");
      await prisma.challengeResult.update({ where: { id }, data: { scoreSubmitter: scores.scoreSubmitter, scoreOther: scores.scoreOther } });
      r.scoreSubmitter = scores.scoreSubmitter;
      r.scoreOther = scores.scoreOther;
    }
    await prisma.challengeResult.update({ where: { id }, data: { resolutionNote: note ?? null } });
    return this.finalize(r, "approved", `staff:${staffId}`);
  }

  /* ---------- venue payment and the "Did you win?" prompt ---------- */

  // Staff collected the court money for a challenge game: both captains are asked to update the score.
  async venuePaid(staffId: string, id: string) {
    const c = await this.load(id);
    if (c.status !== "accepted") throw new AppError(409, "Only accepted challenge games are paid at the venue");
    if (c.venuePaidAt) return { id, alreadyPaid: true };
    await prisma.challenge.update({ where: { id }, data: { venuePaidAt: new Date(), venuePaidBy: staffId } });
    if (c.bookingId) {
      const b = await prisma.booking.findUnique({ where: { id: c.bookingId } });
      if (b) await prisma.booking.update({ where: { id: b.id }, data: { paymentStatus: "completed", amountPaidNow: b.totalPrice, remainingAmount: 0, cashAmount: b.totalPrice } });
    }
    const teams = await prisma.team.findMany({ where: { id: { in: [c.challengerTeamId, c.challengedTeamId] } } });
    for (const t of teams) {
      await notificationService.notify({
        userId: t.captainId, type: "match", title: "Payment confirmed. Did you win?",
        message: "The venue confirmed your payment. Update your score in your dashboard to boost your public visibility.",
        href: `/opponent?report=${id}`, dedupeKey: `venue-paid-${id}-${t.captainId}`,
      });
    }
    return { id, alreadyPaid: false };
  }

  // Challenges the captain should be asked about: paid at the venue, no result yet, not prompted before.
  async didYouWin(userId: string) {
    const team = await this.captainTeam(userId);
    const candidates = await prisma.challenge.findMany({
      where: { status: "accepted", venuePaidAt: { not: null }, OR: [{ challengerTeamId: team.id }, { challengedTeamId: team.id }] },
      orderBy: { venuePaidAt: "desc" },
    });
    const out = [];
    for (const c of candidates) {
      const hasResult = await prisma.challengeResult.findFirst({ where: { challengeId: c.id, status: { not: "disputed" } } });
      const seen = await prisma.challengePrompt.findUnique({ where: { challengeId_userId: { challengeId: c.id, userId } } });
      if (!hasResult && !seen) out.push({ challengeId: c.id, date: c.date, hour: c.startHour });
    }
    return out;
  }

  async markPromptShown(userId: string, challengeId: string) {
    await prisma.challengePrompt.upsert({ where: { challengeId_userId: { challengeId, userId } }, update: {}, create: { challengeId, userId } });
  }

  // The badge on the Opponent tile: challenges waiting for my answer + results waiting for my approval.
  async pending(userId: string) {
    const team = await this.captainTeam(userId);
    const challengesToAnswer = await prisma.challenge.count({ where: { challengedTeamId: team.id, status: "pending" } });
    const mineAsOther = await prisma.challengeResult.findMany({ where: { status: "awaiting_approval" }, include: { challenge: true } });
    const resultsToApprove = mineAsOther.filter((r) => this.otherTeamOf(r) === team.id).length;
    return { challengesToAnswer, resultsToApprove, total: challengesToAnswer + resultsToApprove };
  }

  /* ---------- staff views ---------- */

  // Who owes what at the venue for each accepted challenge game.
  async settlements(date?: string) {
    const list = await prisma.challenge.findMany({ where: { status: "accepted", ...(date ? { date } : {}) }, orderBy: [{ date: "desc" }, { startHour: "asc" }], take: 300 });
    const teams = await prisma.team.findMany({ where: { id: { in: [...new Set(list.flatMap((c) => [c.challengerTeamId, c.challengedTeamId]))] } } });
    const name = new Map(teams.map((t) => [t.id, t.name]));
    const results = await this.resultsFor(list.map((c) => c.id));
    return list.map((c) => {
      const active = results.filter((r) => r.challengeId === c.id).find((r) => r.status === "approved") ?? null;
      let owes = null;
      if (active) {
        const subIsChallenger = active.submittedByTeamId === c.challengerTeamId;
        const s = settlement(c.courtPrice, c.loserPct as LoserShare, active.scoreSubmitter, active.scoreOther); // A = submitter
        owes = subIsChallenger
          ? { [name.get(c.challengerTeamId) ?? "challenger"]: s.amountA, [name.get(c.challengedTeamId) ?? "challenged"]: s.amountB }
          : { [name.get(c.challengedTeamId) ?? "challenged"]: s.amountA, [name.get(c.challengerTeamId) ?? "challenger"]: s.amountB };
      }
      return { id: c.id, date: c.date, hour: c.startHour, courtPrice: c.courtPrice, loserPct: c.loserPct, teams: [name.get(c.challengerTeamId), name.get(c.challengedTeamId)], venuePaidAt: c.venuePaidAt, result: active ? `${active.scoreSubmitter}-${active.scoreOther}` : null, owes };
    });
  }
}

export const teamService = new TeamService();
export default teamService;
export { POSITIONS, Tx };
