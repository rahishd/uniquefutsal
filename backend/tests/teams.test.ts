import { api, adminToken, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";

const P = "98000005"; // test phone prefix: 98000005xx
const phone = (n: number) => `${P}${String(n).padStart(2, "0")}`;
const CAP_A = phone(1);
const CAP_B = phone(2);
const LONER = phone(3); // registered, never captain
const A_PLAYERS = Array.from({ length: 11 }, (_, i) => phone(10 + i)); // 10..20  -> team A becomes 12
const B_PLAYERS = Array.from({ length: 4 }, (_, i) => phone(30 + i)); // 30..33  -> team B becomes 5
const EXTRA = phone(40);

async function wipe() {
  const users = (await prisma.user.findMany({ where: { phoneNumber: { startsWith: P } }, select: { phoneNumber: true } })).map((u) => u.phoneNumber);
  const teams = (await prisma.team.findMany({ where: { captainId: { in: users } }, select: { id: true } })).map((t) => t.id);
  const ch = (await prisma.challenge.findMany({ where: { OR: [{ challengerTeamId: { in: teams } }, { challengedTeamId: { in: teams } }] }, select: { id: true, bookingId: true } }));
  const bookingIds = ch.map((c) => c.bookingId).filter(Boolean) as string[];
  await prisma.challengePrompt.deleteMany({ where: { challengeId: { in: ch.map((c) => c.id) } } });
  await prisma.challenge.deleteMany({ where: { id: { in: ch.map((c) => c.id) } } });
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.booking.deleteMany({ where: { OR: [{ id: { in: bookingIds } }, { userId: { in: users } }] } });
  await prisma.team.deleteMany({ where: { id: { in: teams } } });
  await prisma.teamMember.deleteMany({ where: { userId: { in: users } } });
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: users } } });
  await prisma.notification.deleteMany({ where: { userId: { in: users } } });
  await prisma.userPrefs.deleteMany({ where: { userId: { in: users } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: users } } });
}

const as = (p: string) => bearer(tokenFor(p));
const json = (m: "get" | "post" | "put" | "delete", url: string, p?: string, body?: object) => {
  const r = (api() as any)[m](url);
  return (p ? r.set(as(p)) : r).send(body ?? {});
};
const captainMode = (p: string) => json("put", "/api/me/mode", p, { mode: "captain" });

let teamA = "";
let teamB = "";

beforeAll(async () => {
  await wipe();
  for (const [p, n] of [[CAP_A, "Captain A"], [CAP_B, "Captain B"], [LONER, "Loner"], [EXTRA, "Extra Player"]] as const) await makeUser(p, n);
  for (const p of [...A_PLAYERS, ...B_PLAYERS]) await makeUser(p, `Player ${p.slice(-2)}`);
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("captain mode and creating a team", () => {
  it("needs Captain mode and a signed-in player", async () => {
    expect((await json("post", "/api/teams", undefined, { name: "No Login FC" })).status).toBe(401);
    expect((await json("post", "/api/teams", CAP_A, { name: "Too Early FC" })).status).toBe(403);
    expect((await captainMode(CAP_A)).status).toBe(200);
    expect((await captainMode(CAP_B)).status).toBe(200);
    expect((await json("put", "/api/me/mode", CAP_A, { mode: "king" })).status).toBe(400);
  });
  it("creates teams: name 2 to 30 characters, unique, one team per player", async () => {
    expect((await json("post", "/api/teams", CAP_A, { name: "A" })).status).toBe(400);
    const a = await json("post", "/api/teams", CAP_A, { name: "Team Alpha Test" });
    expect(a.status).toBe(201);
    teamA = a.body.data.id;
    expect((await json("post", "/api/teams", CAP_A, { name: "Another One" })).status).toBe(409); // already in a team
    expect((await json("post", "/api/teams", CAP_B, { name: "Team Alpha Test" })).status).toBe(409); // name taken
    const b = await json("post", "/api/teams", CAP_B, { name: "Team Bravo Test" });
    teamB = b.body.data.id;
    const mine = await json("get", "/api/teams/me", CAP_A);
    expect(mine.body.data.isCaptain).toBe(true);
    expect(mine.body.data.members).toHaveLength(1);
  });
});

describe("roster", () => {
  it("validates the number and the player", async () => {
    expect((await json("post", "/api/teams/me/members", CAP_A, { phone: "12345" })).status).toBe(400);
    expect((await json("post", "/api/teams/me/members", CAP_A, { phone: "9899999999" })).status).toBe(404); // not registered
    expect((await json("post", "/api/teams/me/members", LONER, { phone: CAP_B })).status).toBe(403); // a non-captain cannot add
  });
  it("holds up to 12 players including the captain", async () => {
    for (const p of A_PLAYERS) expect((await json("post", "/api/teams/me/members", CAP_A, { phone: p })).status).toBe(201);
    const full = await json("post", "/api/teams/me/members", CAP_A, { phone: EXTRA });
    expect(full.status).toBe(409);
    expect(full.body.message).toMatch(/full/);
    expect((await json("get", "/api/teams/me", CAP_A)).body.data.members).toHaveLength(12);
  });
  it("a player can be in only one team, and the captain cannot be removed", async () => {
    expect((await json("post", "/api/teams/me/members", CAP_B, { phone: A_PLAYERS[0] })).status).toBe(409);
    expect((await json("delete", `/api/teams/me/members/${CAP_A}`, CAP_A)).status).toBe(400);
    expect((await json("delete", `/api/teams/me/members/${A_PLAYERS[10]}`, CAP_A)).status).toBe(200);
    expect((await json("post", "/api/teams/me/members", CAP_A, { phone: EXTRA })).status).toBe(201); // room again
    for (const p of B_PLAYERS) expect((await json("post", "/api/teams/me/members", CAP_B, { phone: p })).status).toBe(201);
  });
  it("only captains can see the leaderboard and other teams' stats (team stats only)", async () => {
    expect((await json("get", "/api/teams/ranking", LONER)).status).toBe(403);
    const r = await json("get", "/api/teams/ranking", CAP_A);
    expect(r.status).toBe(200);
    expect(r.body.data.every((t: any) => t.rating === null)).toBe(true); // nobody has 3 approved games
    const d = await json("get", `/api/teams/${teamB}`, CAP_A);
    expect(Object.keys(d.body.data)).not.toContain("members");
  });
});

describe("challenges", () => {
  const base = () => ({ teamId: teamB, type: "match", date: futureDate(2), hour: 18, loserPct: 70 });
  it("rules: choose who pays (70/60/100, no default), date window, not yourself, no duplicates", async () => {
    expect((await json("post", "/api/challenges", CAP_A, { ...base(), loserPct: undefined })).status).toBe(400);
    expect((await json("post", "/api/challenges", CAP_A, { ...base(), loserPct: 50 })).status).toBe(400);
    expect((await json("post", "/api/challenges", CAP_A, { ...base(), date: futureDate(11) })).status).toBe(400);
    expect((await json("post", "/api/challenges", CAP_A, { ...base(), teamId: teamA })).status).toBe(400);
    expect((await json("post", "/api/challenges", LONER, base())).status).toBe(403);
  });
  it("needs at least 5 players to challenge", async () => {
    await makeUser(phone(50), "Solo Captain");
    await captainMode(phone(50));
    await json("post", "/api/teams", phone(50), { name: "Tiny FC Test" });
    expect((await json("post", "/api/challenges", phone(50), base())).status).toBe(400);
  });
  it("the challenged captain is notified, sees the split, and duplicates are refused", async () => {
    const c = await json("post", "/api/challenges", CAP_A, base());
    expect(c.status).toBe(201);
    expect(c.body.data.courtPrice).toBeGreaterThan(0);
    expect((await json("post", "/api/challenges", CAP_A, base())).status).toBe(409);
    const n = await prisma.notification.findMany({ where: { userId: CAP_B, type: "challenge" } });
    expect(n.length).toBeGreaterThan(0);
    const pending = await json("get", "/api/challenges/pending", CAP_B);
    expect(pending.body.data.challengesToAnswer).toBe(1);
    const list = await json("get", "/api/challenges", CAP_B);
    expect(list.body.data[0]).toMatchObject({ direction: "in", loserPct: 70, status: "pending" });
    await json("post", `/api/challenges/${c.body.data.id}/decline`, CAP_B);
  });
});

describe("a full game: accept, upload, approve, points, rating", () => {
  let id = "";
  let courtPrice = 0;
  it("accepting books the court; only the challenged captain can answer", async () => {
    const c = await json("post", "/api/challenges", CAP_A, { teamId: teamB, type: "competition", date: futureDate(3), hour: 19, loserPct: 60 });
    expect(c.status).toBe(201);
    id = c.body.data.id;
    courtPrice = c.body.data.courtPrice;
    expect((await json("post", `/api/challenges/${id}/accept`, CAP_A)).status).toBe(403);
    const acc = await json("post", `/api/challenges/${id}/accept`, CAP_B);
    expect(acc.status).toBe(200);
    expect(acc.body.data.status).toBe("accepted");
    const booking = await prisma.booking.findUnique({ where: { id: acc.body.data.bookingId } });
    expect(booking?.source).toBe("challenge");
    expect(booking?.paymentMethod).toBe("venue");
    expect(await prisma.bookingSlot.count({ where: { bookingId: booking!.id } })).toBe(1);
    expect((await json("post", `/api/challenges/${id}/accept`, CAP_B)).status).toBe(409);
  });

  it("the score cannot be reported before the game starts", async () => {
    expect((await json("post", `/api/challenges/${id}/result`, CAP_A, { myScore: 6, theirScore: 4 })).status).toBe(409);
    // the game is played: move it to the past
    await prisma.challenge.update({ where: { id }, data: { date: futureDate(-1) } });
  });

  it("only the WINNING captain uploads the overall score, once", async () => {
    expect((await json("post", `/api/challenges/${id}/result`, CAP_B, { myScore: 4, theirScore: 6 })).status).toBe(403); // the loser
    expect((await json("post", `/api/challenges/${id}/result`, CAP_A, { myScore: 60, theirScore: 4 })).status).toBe(400);
    expect((await json("post", `/api/challenges/${id}/result`, LONER, { myScore: 6, theirScore: 4 })).status).toBe(403);
    const up = await json("post", `/api/challenges/${id}/result`, CAP_A, { myScore: 6, theirScore: 4 });
    expect(up.status).toBe(201);
    expect((await json("post", `/api/challenges/${id}/result`, CAP_A, { myScore: 6, theirScore: 4 })).status).toBe(409);
    const pend = await json("get", "/api/challenges/pending", CAP_B);
    expect(pend.body.data.resultsToApprove).toBe(1);
  });

  it("only the OTHER captain approves; approval updates records and awards 5 points to the winning captain only", async () => {
    const result = (await prisma.challengeResult.findFirst({ where: { challengeId: id } }))!;
    expect((await json("post", `/api/results/${result.id}/approve`, CAP_A)).status).toBe(403); // the submitter
    expect((await json("post", `/api/results/${result.id}/approve`, LONER)).status).toBe(403);
    const ok = await json("post", `/api/results/${result.id}/approve`, CAP_B);
    expect(ok.status).toBe(200);
    expect((await json("post", `/api/results/${result.id}/approve`, CAP_B)).status).toBe(409); // replay changes nothing

    const winner = await prisma.loyaltyEntry.findMany({ where: { userId: CAP_A, kind: "captain_win" } });
    const loser = await prisma.loyaltyEntry.findMany({ where: { userId: CAP_B } });
    expect(winner).toHaveLength(1);
    expect(Number(winner[0].points)).toBe(5);
    expect(loser).toHaveLength(0);

    const a = await json("get", `/api/teams/${teamA}`, CAP_B);
    expect(a.body.data.record).toMatchObject({ played: 1, wins: 1, losses: 0 });
    const b = await json("get", `/api/teams/${teamB}`, CAP_A);
    expect(b.body.data.record).toMatchObject({ played: 1, wins: 0, losses: 1 });
    expect(a.body.data.rating).toBeNull(); // still under 3 games
  });

  it("staff see who owes what at the venue; the amounts add up to the court price", async () => {
    const res = await json("get", `/api/teams/admin/settlements?date=${futureDate(-1)}`, undefined);
    expect(res.status).toBe(401);
    const staff = await api().get(`/api/teams/admin/settlements?date=${futureDate(-1)}`).set(bearer(adminToken()));
    const row = staff.body.data.find((r: any) => r.id === id);
    expect(row.result).toBe("6-4");
    const owed = Object.values(row.owes as Record<string, number>);
    expect(owed.reduce((a, b) => a + b, 0)).toBe(courtPrice);
    expect(Math.max(...owed)).toBe(Math.round((courtPrice * 60) / 100)); // the loser pays 60%, the winner the remainder
    expect(Math.min(...owed)).toBe(courtPrice - Math.round((courtPrice * 60) / 100));
  });
});

describe("a draw earns nobody points, and a dispute goes to staff", () => {
  it("draw: either captain may upload; approving gives no points", async () => {
    const c = await json("post", "/api/challenges", CAP_B, { teamId: teamA, type: "match", date: futureDate(4), hour: 17, loserPct: 70 });
    const id = c.body.data.id;
    await json("post", `/api/challenges/${id}/accept`, CAP_A);
    await prisma.challenge.update({ where: { id }, data: { date: futureDate(-2) } });
    expect((await json("post", `/api/challenges/${id}/result`, CAP_B, { myScore: 3, theirScore: 3 })).status).toBe(201);
    const r = (await prisma.challengeResult.findFirst({ where: { challengeId: id } }))!;
    expect((await json("post", `/api/results/${r.id}/approve`, CAP_A)).status).toBe(200);
    expect(await prisma.loyaltyEntry.count({ where: { userId: { in: [CAP_A, CAP_B] }, kind: "captain_win" } })).toBe(1); // only the earlier win
  });

  it("dispute: nothing changes until staff resolve it, then points are awarded once", async () => {
    const c = await json("post", "/api/challenges", CAP_A, { teamId: teamB, type: "match", date: futureDate(5), hour: 16, loserPct: 100 });
    const id = c.body.data.id;
    await json("post", `/api/challenges/${id}/accept`, CAP_B);
    await prisma.challenge.update({ where: { id }, data: { date: futureDate(-3) } });
    await json("post", `/api/challenges/${id}/result`, CAP_A, { myScore: 2, theirScore: 1 });
    const r = (await prisma.challengeResult.findFirst({ where: { challengeId: id } }))!;
    expect((await json("post", `/api/results/${r.id}/dispute`, CAP_A)).status).toBe(403);
    expect((await json("post", `/api/results/${r.id}/dispute`, CAP_B)).status).toBe(200);
    const before = await json("get", `/api/teams/${teamA}`, CAP_A);
    expect(before.body.data.record.played).toBe(2); // the disputed game does not count

    expect((await json("post", `/api/teams/admin/results/${r.id}/resolve`, CAP_A, { action: "approve" })).status).toBe(403);
    const fix = await api().post(`/api/teams/admin/results/${r.id}/resolve`).set(bearer(adminToken())).send({ action: "approve", scoreSubmitter: 3, scoreOther: 1, note: "checked with both captains" });
    expect(fix.status).toBe(200);
    const after = await json("get", `/api/teams/${teamA}`, CAP_A);
    expect(after.body.data.record.played).toBe(3);
    expect(after.body.data.rating).not.toBeNull(); // 3 approved games: now rated
    expect(await prisma.loyaltyEntry.count({ where: { userId: CAP_A, kind: "captain_win" } })).toBe(2);
    expect((await api().post(`/api/teams/admin/results/${r.id}/resolve`).set(bearer(adminToken())).send({ action: "approve" })).status).toBe(409);
  });
});

describe("venue payment and the 'Did you win?' prompt", () => {
  it("staff confirm payment: both captains are prompted until a score exists", async () => {
    const c = await json("post", "/api/challenges", CAP_A, { teamId: teamB, type: "match", date: futureDate(6), hour: 15, loserPct: 70 });
    const id = c.body.data.id;
    await json("post", `/api/challenges/${id}/accept`, CAP_B);
    expect((await json("post", `/api/teams/admin/challenges/${id}/venue-paid`, CAP_A)).status).toBe(403);
    const paid = await api().post(`/api/teams/admin/challenges/${id}/venue-paid`).set(bearer(adminToken())).send({});
    expect(paid.status).toBe(200);
    expect((await api().post(`/api/teams/admin/challenges/${id}/venue-paid`).set(bearer(adminToken())).send({})).body.data.alreadyPaid).toBe(true);

    for (const p of [CAP_A, CAP_B]) {
      const prompts = await json("get", "/api/challenges/prompts/did-you-win", p);
      expect(prompts.body.data.map((x: any) => x.challengeId)).toContain(id);
      const n = await prisma.notification.findFirst({ where: { userId: p, href: `/opponent?report=${id}` } });
      expect(n).not.toBeNull();
    }
    await json("post", `/api/challenges/${id}/prompt-shown`, CAP_A);
    expect((await json("get", "/api/challenges/prompts/did-you-win", CAP_A)).body.data.map((x: any) => x.challengeId)).not.toContain(id);
    expect((await json("get", "/api/challenges/prompts/did-you-win", CAP_B)).body.data.map((x: any) => x.challengeId)).toContain(id);

    const booking = await prisma.booking.findFirst({ where: { challengeId: id } });
    expect(booking?.paymentStatus).toBe("completed");
  });
});

describe("cancelling an accepted challenge frees the court", () => {
  it("the challenger cancels before the game", async () => {
    const c = await json("post", "/api/challenges", CAP_A, { teamId: teamB, type: "match", date: futureDate(7), hour: 14, loserPct: 70 });
    const id = c.body.data.id;
    const acc = await json("post", `/api/challenges/${id}/accept`, CAP_B);
    const bookingId = acc.body.data.bookingId;
    expect((await json("post", `/api/challenges/${id}/cancel`, CAP_B)).status).toBe(403);
    expect((await json("post", `/api/challenges/${id}/cancel`, CAP_A)).status).toBe(200);
    expect(await prisma.bookingSlot.count({ where: { bookingId } })).toBe(0);
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))?.status).toBe("cancelled");
  });
});
