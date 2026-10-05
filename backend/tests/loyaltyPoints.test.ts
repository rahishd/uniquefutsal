import {
  LedgerRow, expiryFor, freeGameCost, pointsForGame, pointsForGoods, summarize,
} from "../src/utils/loyaltyPoints";
import { addMonthsKey, daysBetweenKeys, startsAtMs } from "../src/utils/dates";

describe("point rules", () => {
  it("game points are price/100 cut to one decimal", () => {
    expect(pointsForGame(1250)).toBe(12.5);
    expect(pointsForGame(1150)).toBe(11.5);
    expect(pointsForGame(1350)).toBe(13.5);
    expect(pointsForGame(1275)).toBe(12.7);
    expect(pointsForGame(0)).toBe(0);
    expect(pointsForGame(-5)).toBe(0);
  });
  it("a free game costs 10 games' worth (price/10)", () => {
    expect(freeGameCost(1250)).toBe(125);
    expect(freeGameCost(1150)).toBe(115);
    expect(freeGameCost(1350)).toBe(135);
  });
  it("goods earn 1 point per full Rs. 100", () => {
    expect(pointsForGoods(10000)).toBe(100);
    expect(pointsForGoods(250)).toBe(2);
    expect(pointsForGoods(99)).toBe(0);
  });
  it("expiry: games 3 months, goods 1 year, membership never, spending none", () => {
    expect(expiryFor("game", "2026-10-03")).toBe("2027-01-03");
    expect(expiryFor("captain_win", "2026-11-30")).toBe("2027-02-28");
    expect(expiryFor("goods", "2026-10-03")).toBe("2027-10-03");
    expect(expiryFor("membership", "2026-10-03")).toBeNull();
    expect(expiryFor("free_game", "2026-10-03")).toBeUndefined();
  });
});

describe("balance with expiry (the owner's example: 10 day games + Rs. 10,000 goods = 215 points)", () => {
  const rows = (): LedgerRow[] => [
    { id: "g", kind: "game", points: 115, earnedOn: "2026-10-01", expiresOn: "2026-12-31", detail: "10 Day games" },
    { id: "s", kind: "goods", points: 100, earnedOn: "2026-10-02", expiresOn: "2027-10-02", detail: "Rs. 10,000 goods" },
  ];
  it("adds up to 215 and covers an evening free game (135)", () => {
    const s = summarize(rows(), "2026-10-05");
    expect(s.remaining).toBe(215);
    expect(s.remaining).toBeGreaterThanOrEqual(freeGameCost(1350));
  });
  it("game points vanish after 3 months, goods points stay", () => {
    const s = summarize(rows(), "2027-01-15");
    expect(s.remaining).toBe(100);
    expect(s.expired).toBe(115);
  });
  it("a claim spends the soonest-expiring points first", () => {
    const withClaim: LedgerRow[] = [...rows(), { id: "c", kind: "free_game", points: -135, earnedOn: "2026-10-10", expiresOn: null, detail: "Evening" }];
    const s = summarize(withClaim, "2027-01-15");
    // the 135 came from the 115 game points first, then 20 goods points; game points would have expired anyway
    expect(s.remaining).toBe(80);
    const s2 = summarize(withClaim, "2026-10-11");
    expect(s2.byType.games.points).toBe(0);
    expect(s2.byType.goods.points).toBe(80);
  });
  it("membership points never expire and are spent last", () => {
    const l: LedgerRow[] = [
      { id: "m", kind: "membership", points: 30, earnedOn: "2026-01-01", expiresOn: null, detail: "3-month plan" },
      { id: "g", kind: "game", points: 100, earnedOn: "2026-09-01", expiresOn: "2026-12-01", detail: "games" },
      { id: "c", kind: "free_game", points: -100, earnedOn: "2026-09-10", expiresOn: null, detail: "claim" },
    ];
    const s = summarize(l, "2027-06-01");
    expect(s.remaining).toBe(30);
  });
  it("warns about points expiring within 30 days", () => {
    const s = summarize(rows(), "2026-12-10");
    expect(s.expiringSoon).toEqual({ date: "2026-12-31", points: 115 });
  });
});

describe("date helpers (Nepal time)", () => {
  it("month arithmetic keeps end of month valid", () => {
    expect(addMonthsKey("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsKey("2026-10-03", 3)).toBe("2027-01-03");
  });
  it("days between and start time", () => {
    expect(daysBetweenKeys("2026-10-05", "2026-10-20")).toBe(15);
    // 19:00 in Kathmandu (UTC+5:45) is 13:15 UTC
    expect(new Date(startsAtMs("2026-10-05", 19)).toISOString()).toBe("2026-10-05T13:15:00.000Z");
  });
});
