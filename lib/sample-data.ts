// Placeholder content for the home screen design. Replace with real API data
// (live scores and the updates feed need backend endpoints; see AGENTS.md).

export const sampleLive = [
  { id: "l1", home: "Red Devils", away: "Blue Eagles", homeScore: 3, awayScore: 2, minute: 28, venue: "Arena Nord" },
  { id: "l2", home: "Storm FC", away: "Galaxy United", homeScore: 1, awayScore: 1, minute: 15, venue: "Pitch Pro" },
];

export const sampleFinished = { venue: "THE BOX", home: "Iron Wolves", away: "Neon Kings", homeScore: 5, awayScore: 3 };

export const sampleUpNext = { time: "20:00", home: "Viper FC", away: "Titan Squad" };

export type UpdateKind = "alert" | "promo" | "tournament" | "info";

export const sampleUpdates: { id: string; kind: UpdateKind; title: string; ago: string; body: string }[] = [
  { id: "u1", kind: "alert", title: "Courts 2 & 3 closed Saturday AM", ago: "2h ago", body: "Maintenance work is scheduled for that window." },
  { id: "u2", kind: "promo", title: "Weekend Warriors promo is live!", ago: "1d ago", body: "Book any weekend slot and get a discount. See the Promos tab." },
  { id: "u3", kind: "tournament", title: "Ramadan League sign-ups open", ago: "2d ago", body: "Register your team before spots fill up." },
  { id: "u4", kind: "info", title: "New locker rooms now open", ago: "3d ago", body: "Fresh changing rooms and lockers are available for all players." },
];
