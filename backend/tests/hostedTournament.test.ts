import { api, futureDate, prisma } from "./helpers";
import { todayKey } from "../src/utils/dates";

let tid = "";
let hidden: string[] = [];
async function wipe() {
  await prisma.tournament.deleteMany({ where: { name: "Hosted Cup" } }); // its days cascade
}
beforeAll(async () => {
  await wipe();
  // the app shows the one that is running, so hide any other active tournament for this test
  hidden = (await prisma.tournament.findMany({ where: { isActive: true }, select: { id: true } })).map((t) => t.id);
  await prisma.tournament.updateMany({ where: { id: { in: hidden } }, data: { isActive: false } });
  tid = (await prisma.tournament.create({
    data: { name: "Hosted Cup", prizePool: 0, minTeams: 2, maxTeams: 16, startDate: todayKey(), endDate: futureDate(1), hostedEvent: true, hostName: "Anil Gurung", hostPhone: "9841000000", minRate: 2000 },
  })).id;
  await prisma.tournamentDay.createMany({ data: [{ tournamentId: tid, date: todayKey(), startHour: 5, endHour: 8 }, { tournamentId: tid, date: futureDate(1), startHour: 10, endHour: 15 }] });
});
afterAll(async () => {
  await wipe();
  await prisma.tournament.updateMany({ where: { id: { in: hidden } }, data: { isActive: true } }); // put back exactly the ones that were active
});

describe("a tournament the venue hosts", () => {
  it("shows the host and the hours of each day to customers, and keeps the phone number and the money private", async () => {
    const r = await api().get("/api/tournaments/current");
    const t = r.body.data;
    expect(t.name).toBe("Hosted Cup");
    expect(t.hosted.hostName).toBe("Anil Gurung");
    expect(t.hosted.days).toEqual([
      { date: todayKey(), startHour: 5, endHour: 8 },
      { date: futureDate(1), startHour: 10, endHour: 15 },
    ]);
    const text = JSON.stringify(r.body);
    expect(text).not.toContain("9841000000");
    expect(text).not.toContain("minRate");
    expect(text).not.toContain("2000");
  });

  it("does not show a cancelled hosted tournament", async () => {
    await prisma.tournament.update({ where: { id: tid }, data: { status: "cancelled", isActive: false } });
    const r = await api().get("/api/tournaments/current");
    expect(r.body.data).toBeNull();
    await prisma.tournament.update({ where: { id: tid }, data: { status: "active", isActive: true } });
  });
});
