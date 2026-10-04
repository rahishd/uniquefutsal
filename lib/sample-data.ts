// Placeholder content. Replace with real API data once the backend endpoints exist
// (promo codes, tournaments and tie-sheets; see AGENTS.md).


export type MatchStatus = "finished" | "live" | "upcoming";

export interface TieMatch {
  id: string;
  status: MatchStatus;
  home: string | null; // null = to be decided
  away: string | null;
  homeScore?: number;
  awayScore?: number;
  note?: string; // e.g. penalties, minute
  time?: string;
  venue?: string;
}

export interface TieRound {
  name: string;
  matches: TieMatch[];
}

export interface Tournament {
  id: string;
  name: string;
  status: "live" | "upcoming" | "completed";
  startDate: string;
  endDate: string;
  venue: string;
  teams: number;
  prizePool: string;
  prizes: { first: string; second: string; third: string };
  format: string;
  rounds: TieRound[];
}

// Set to null when no tournament is being hosted; the home section then hides.
export const sampleTournament: Tournament | null = {
  id: "t1",
  name: "Unique Futsal Cup 2083",
  status: "live",
  startDate: "1 Oct 2026",
  endDate: "10 Oct 2026",
  venue: "Unique Futsal, Manigram, Tilottama",
  teams: 8,
  prizePool: "Rs. 50,000",
  prizes: { first: "Rs. 25,000", second: "Rs. 15,000", third: "Rs. 10,000" },
  format: "8 teams, knockout",
  rounds: [
    {
      name: "Quarter-finals",
      matches: [
        { id: "q1", status: "finished", home: "Red Devils", away: "Iron Wolves", homeScore: 4, awayScore: 2 },
        { id: "q2", status: "finished", home: "Blue Eagles", away: "Neon Kings", homeScore: 3, awayScore: 1 },
        { id: "q3", status: "finished", home: "Storm FC", away: "Viper FC", homeScore: 2, awayScore: 2, note: "4-3 on penalties" },
        { id: "q4", status: "finished", home: "Galaxy United", away: "Titan Squad", homeScore: 5, awayScore: 3 },
      ],
    },
    {
      name: "Semi-finals",
      matches: [
        { id: "s1", status: "live", home: "Red Devils", away: "Blue Eagles", homeScore: 3, awayScore: 2, note: "28'", venue: "Arena Nord" },
        { id: "s2", status: "live", home: "Storm FC", away: "Galaxy United", homeScore: 1, awayScore: 1, note: "15'", venue: "Pitch Pro" },
      ],
    },
    {
      name: "Final",
      matches: [{ id: "f1", status: "upcoming", home: null, away: null, time: "10 Oct, 6:00 PM" }],
    },
  ],
};
