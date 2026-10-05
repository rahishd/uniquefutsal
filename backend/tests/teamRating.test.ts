import { TeamStats, addGame, emptyStats, rankTeams, settlement, teamRating } from "../src/utils/teamRating";

const stats = (w: number, d: number, l: number, gf: number, ga: number, form: ("W" | "D" | "L")[]): TeamStats => ({ played: w + d + l, wins: w, draws: d, losses: l, gf, ga, form });

describe("team rating", () => {
  it("is unrated under 3 games", () => {
    expect(teamRating(stats(1, 1, 0, 5, 3, ["W", "D"]))).toBeNull();
    expect(teamRating(emptyStats())).toBeNull();
  });
  it("a strong record rates high but a 3-game streak cannot reach 5 stars", () => {
    const strong = teamRating(stats(8, 2, 2, 52, 28, ["W", "W", "D", "W", "W"]))!;
    const lucky = teamRating(stats(3, 0, 0, 12, 2, ["W", "W", "W"]))!;
    expect(strong).toBeGreaterThan(3.9);
    expect(lucky).toBeLessThan(5);
    expect(lucky).toBeLessThan(strong + 0.5);
  });
  it("a losing record rates low and stays within 1 to 5", () => {
    const weak = teamRating(stats(1, 0, 9, 10, 40, ["L", "L", "L", "L", "L"]))!;
    expect(weak).toBeGreaterThanOrEqual(1);
    expect(weak).toBeLessThan(2);
  });
  it("matches the frontend's sample ratings (Team Alpha 4.4, Red Devils 3.9)", () => {
    expect(teamRating(stats(8, 2, 2, 52, 28, ["W", "W", "D", "W", "W"]))).toBe(4.4);
    expect(teamRating(stats(6, 1, 3, 38, 25, ["W", "W", "L", "W", "W"]))).toBe(3.9);
  });
});

describe("ranking", () => {
  it("sorts by rating, then games played, then goal difference; unrated teams get no rank", () => {
    const r = rankTeams([
      { id: "new", stats: stats(1, 0, 0, 3, 1, ["W"]) },
      { id: "b", stats: stats(6, 1, 3, 38, 25, ["W", "W", "L", "W", "W"]) },
      { id: "a", stats: stats(8, 2, 2, 52, 28, ["W", "W", "D", "W", "W"]) },
    ]);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "new"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, null]);
  });
});

describe("loser-pays settlement", () => {
  it.each([
    [1500, 70, 4, 6, 1050, 450], // A lost: pays 70% of Rs. 1,500
    [1500, 60, 6, 4, 600, 900], // B lost: pays 60%
    [1500, 100, 2, 0, 0, 1500], // B lost and pays in full
  ])("court Rs. %i, loser %i%%, score %i-%i -> A %i, B %i", (price, pct, sa, sb, a, b) => {
    const s = settlement(price, pct as 70 | 60 | 100, sa, sb);
    // note: the first score belongs to team A, who pays amountA
    expect(s.amountA + s.amountB).toBe(price);
    if (sa < sb) expect(s.amountA).toBe(Math.round((price * pct) / 100));
    else expect(s.amountB).toBe(Math.round((price * pct) / 100));
    expect([s.amountA, s.amountB].sort((x, y) => x - y)).toEqual([a, b].sort((x, y) => x - y));
  });
  it("a draw is split 50/50 and always adds up", () => {
    const s = settlement(1275, 70, 3, 3);
    expect(s.basis).toBe("draw-split");
    expect(s.amountA + s.amountB).toBe(1275);
  });
});

describe("recording games", () => {
  it("adds a result to a record and keeps the form", () => {
    let s = emptyStats();
    s = addGame(s, 3, 1);
    s = addGame(s, 2, 2);
    s = addGame(s, 0, 4);
    expect(s).toMatchObject({ played: 3, wins: 1, draws: 1, losses: 1, gf: 5, ga: 7, form: ["W", "D", "L"] });
  });
});
