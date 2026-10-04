// Sample data for the customer home design. The backend has no live-score or
// updates-feed endpoints yet (see FRD/FRD-001), so this is shown only when
// NEXT_PUBLIC_SHOW_SAMPLE_DATA=true. Never enable that in production.

export const SHOW_SAMPLE_DATA = process.env.NEXT_PUBLIC_SHOW_SAMPLE_DATA === "true";

export interface LiveMatch {
  id: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  venue: string;
}

export interface FinishedMatch {
  id: string;
  venue: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}

export interface UpNextMatch {
  id: string;
  time: string;
  home: string;
  away: string;
}

export interface FeedUpdate {
  id: string;
  kind: "alert" | "promo" | "tournament" | "info";
  title: string;
  ago: string;
  body: string;
}

export const sampleLiveMatches: LiveMatch[] = [
  { id: "l1", home: "Red Devils", away: "Blue Eagles", homeScore: 3, awayScore: 2, minute: 28, venue: "Arena Nord" },
  { id: "l2", home: "Storm FC", away: "Galaxy United", homeScore: 1, awayScore: 1, minute: 15, venue: "Pitch Pro" },
];

export const sampleFinished: FinishedMatch = {
  id: "f1",
  venue: "THE BOX",
  home: "Iron Wolves",
  away: "Neon Kings",
  homeScore: 5,
  awayScore: 3,
};

export const sampleUpNext: UpNextMatch = {
  id: "u1",
  time: "20:00",
  home: "Viper FC",
  away: "Titan Squad",
};

export const sampleUpdates: FeedUpdate[] = [
  { id: "s1", kind: "alert", title: "Courts 2 & 3 closed Saturday AM", ago: "2h ago", body: "Maintenance work is scheduled. Bookings in that window will be moved or refunded." },
  { id: "s2", kind: "promo", title: "Weekend Warriors promo is live!", ago: "1d ago", body: "Book any weekend slot and get a discount. See the Promos tab for the code." },
  { id: "s3", kind: "tournament", title: "Ramadan League sign-ups open", ago: "2d ago", body: "Register your team before spots fill up." },
  { id: "s4", kind: "info", title: "New locker rooms now open", ago: "3d ago", body: "Fresh changing rooms and lockers are available for all players." },
];
