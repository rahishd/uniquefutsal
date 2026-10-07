import { api, adminToken, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";
import { todayKey } from "../src/utils/dates";
import { describeChange } from "../src/modules/tournament/matchFollow";

const A = "9800009501";
const B = "9800009502";
let tid = "";
const put = (rounds: unknown) => api().put(`/api/tournaments/${tid}/tiesheet`).set(bearer(adminToken())).send({ rounds });
const sheet = async () => (await api().get("/api/tournaments/current")).body.data.rounds as { matches: { id: string; status: string }[] }[];
const inbox = (u: string) => prisma.notification.findMany({ where: { userId: u, type: "tournament" }, orderBy: { createdAt: "asc" } });

async function wipe() {
  await prisma.notification.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.tournament.deleteMany({ where: { name: "Follow Cup" } }); // rounds, matches and follows cascade
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B] } } });
}
beforeAll(async () => {
  await wipe();
  await makeUser(A, "Follower A");
  await makeUser(B, "Follower B");
  tid = (await prisma.tournament.create({ data: { name: "Follow Cup", prizePool: 1000, minTeams: 2, maxTeams: 4, startDate: todayKey(), endDate: futureDate(3) } })).id;
});
afterAll(wipe);

describe("following a tie-sheet match", () => {
  it("says what changed and nothing else", () => {
    const m = { id: "m1", home: "Red", away: "Blue", status: "upcoming", homeScore: null, awayScore: null, note: null };
    expect(describeChange(m, { ...m, status: "live", homeScore: 0, awayScore: 0 })?.title).toMatch(/Kick-off/);
    const live = { ...m, status: "live", homeScore: 0, awayScore: 0 };
    expect(describeChange(live, { ...live, homeScore: 1 })).toMatchObject({ title: "Goal!", message: "Red 1-0 Blue" });
    expect(describeChange(live, live)).toBeNull();
    expect(describeChange(live, { ...live, status: "finished", homeScore: 2, awayScore: 1, note: "pens" })).toMatchObject({ title: "Full time", message: "Red 2-1 Blue (pens)" });
    expect(describeChange(m, { ...m, home: "Green" })).toBeNull();
  });

  it("follow, unfollow, notify followers only, and keep following after a score update", async () => {
    expect((await put([{ name: "Semi-finals", matches: [{ home: "Red", away: "Blue", status: "upcoming" }, { home: "Gold", away: "Green", status: "upcoming" }] }])).status).toBe(200);
    const [s1, s2] = (await sheet())[0].matches;
    const ta = bearer(tokenFor(A));
    const tb = bearer(tokenFor(B));

    expect((await api().put(`/api/tournaments/matches/${s1.id}/follow`)).status).toBe(401);
    expect((await api().put("/api/tournaments/matches/nope/follow").set(ta)).status).toBe(404);
    expect((await api().put(`/api/tournaments/matches/${s1.id}/follow`).set(ta)).status).toBe(200);
    expect((await api().put(`/api/tournaments/matches/${s1.id}/follow`).set(ta)).status).toBe(200); // twice is fine
    expect((await api().put(`/api/tournaments/matches/${s2.id}/follow`).set(tb)).status).toBe(200);
    expect((await api().get("/api/tournaments/following").set(ta)).body.data).toEqual([s1.id]);
    expect((await api().get("/api/tournaments/following")).status).toBe(401);

    // staff send the ids back with a kick-off and then a goal in match 1
    const ids = (await sheet())[0].matches.map((m) => m.id);
    const mk = (status: string, h: number | null, a: number | null) => [{ name: "Semi-finals", matches: [{ id: ids[0], home: "Red", away: "Blue", status, homeScore: h, awayScore: a }, { id: ids[1], home: "Gold", away: "Green", status: "upcoming" }] }];
    await put(mk("live", 0, 0));
    await put(mk("live", 0, 0)); // saving the same thing again tells nobody twice
    await put(mk("live", 1, 0));
    expect((await sheet())[0].matches.map((m) => m.id)).toEqual(ids); // same rows: follows survive
    const got = await inbox(A);
    expect(got.map((n) => n.title)).toEqual(["Kick-off: it is live", "Goal!"]);
    expect(got[1].message).toBe("Red 1-0 Blue");
    expect(got[1].href).toBe("/tournaments");
    expect(await inbox(B)).toHaveLength(0); // B follows the other match

    // without ids, matches are paired by order: ids stay, a finished match drops out of "following"
    await put([{ name: "Semi-finals", matches: [{ home: "Red", away: "Blue", status: "finished", homeScore: 2, awayScore: 1 }, { home: "Gold", away: "Green", status: "upcoming" }] }]);
    expect((await sheet())[0].matches.map((m) => m.id)).toEqual(ids);
    expect((await inbox(A)).map((n) => n.title)).toEqual(["Kick-off: it is live", "Goal!", "Full time"]);
    expect((await api().get("/api/tournaments/following").set(ta)).body.data).toEqual([]);
    expect((await api().put(`/api/tournaments/matches/${ids[0]}/follow`).set(ta)).status).toBe(409);

    // unfollow, and a removed match takes its follows with it
    expect((await api().delete(`/api/tournaments/matches/${ids[1]}/follow`).set(tb)).status).toBe(200);
    expect((await api().get("/api/tournaments/following").set(tb)).body.data).toEqual([]);
    await api().put(`/api/tournaments/matches/${ids[1]}/follow`).set(tb);
    await put([{ name: "Semi-finals", matches: [{ id: ids[0], home: "Red", away: "Blue", status: "finished", homeScore: 2, awayScore: 1 }] }]);
    expect(await prisma.matchFollow.count({ where: { matchId: ids[1] } })).toBe(0);
  });

  it("the public tie-sheet lists each match's goals in minute order, and drops them with the match", async () => {
    expect((await put([{ name: "Final", matches: [{ home: "Red", away: "Blue", status: "live", homeScore: 2, awayScore: 1 }] }])).status).toBe(200);
    const [m] = (await sheet())[0].matches;
    await prisma.matchGoal.createMany({ data: [
      { matchId: m.id, side: "away", minute: 40, scorer: "Sita" },
      { matchId: m.id, side: "home", minute: 12, scorer: "Ram" },
      { matchId: m.id, side: "home", minute: null, scorer: null },
    ] });
    const goals = (await api().get("/api/tournaments/current")).body.data.rounds[0].matches[0].goals;
    expect(goals).toEqual([{ side: "home", minute: 12, scorer: "Ram" }, { side: "away", minute: 40, scorer: "Sita" }, { side: "home", minute: null, scorer: null }]);
    expect(JSON.stringify(goals)).not.toContain("createdBy");
    await put([{ name: "Final", matches: [] }]); // match removed: its goals go too
    expect(await prisma.matchGoal.count({ where: { matchId: m.id } })).toBe(0);
  });
});
