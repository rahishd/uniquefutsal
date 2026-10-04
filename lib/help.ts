// Help topics shown on /help. To add or change a topic, edit this list only.
// Keep each one short and in plain words: a one-line summary and a few steps or tips.
// Update it whenever a feature changes (and check the numbers against lib/booking.ts, lib/points.ts,
// lib/membership.ts and lib/teams.ts; the numbers below are read from those files).

import { EXPIRY_NOTICE_DAYS } from "@/lib/membership";
import { MAX_ADVANCE_DAYS } from "@/lib/booking";
import { GAME_POINTS_MONTHS, GAMES_PER_FREE, MEMBERSHIP_POINTS, POINTS_CAPTAIN_WIN, RS_PER_POINT } from "@/lib/points";

export type HelpIcon = "book" | "pay" | "rebook" | "member" | "points" | "promo" | "bell" | "captain" | "profile" | "trophy" | "install" | "guest";

export interface HelpTopic {
  id: string;
  icon: HelpIcon;
  title: string;
  summary: string; // one line, always visible
  points: string[]; // short steps or tips, shown when opened
  href?: { label: string; to: string };
}

export const helpTopics: HelpTopic[] = [
  {
    id: "booking",
    icon: "book",
    title: "Book a game",
    summary: "Pick a day and an hour, check the price, pay.",
    points: [
      `Tap Book Now. You can book from today up to ${MAX_ADVANCE_DAYS} days ahead.`,
      "Only free slots are listed. If a time is missing, it is already taken or has passed.",
      "Choose a court, add a promo code if you have one, then pay.",
      "Your booking ID appears at the end. Find it later in Profile > My bookings.",
    ],
    href: { label: "Book now", to: "/book" },
  },
  {
    id: "gamezone",
    icon: "book",
    title: "Gamezone (PS5)",
    summary: "Book a PS5 console by the hour.",
    points: [
      "Open Gamezone in Popular. Choose how many are playing: Solo Rs. 300 an hour, 2 players Rs. 200 each, 4 players Rs. 150 each.",
      "Pick how many hours (up to 4). The price grows with the hours: rate × players × hours.",
      "Choose PS5 Station 1 or 2. Each console has its own free times, so the start times change when you switch.",
      "Choose your game: GTA 5, Forza Horizon, Red Dead Redemption or FIFA 26.",
      "Choose a day and a start time, then pay the same way as a game booking (eSewa, Fonepay or at the venue).",
      "Guests pay online in full. Signed-in customers can also pay at the venue.",
    ],
    href: { label: "Book Gamezone", to: "/gamezone" },
  },
  {
    id: "payment",
    icon: "pay",
    title: "Paying with eSewa, Fonepay or at the venue",
    summary: "Scan the QR and we confirm the payment for you.",
    points: [
      "eSewa and Fonepay show a QR for the exact amount. The note on the payment is filled in automatically.",
      "Scan and pay. The screen detects the payment by itself, so there is no \"I've paid\" button. Keep the screen open.",
      "The QR is held for 10 minutes. If it runs out, go back and start again.",
      "Pay at venue is for signed-in customers only. Guests pay in full online.",
    ],
  },
  {
    id: "guest",
    icon: "guest",
    title: "Signed in or guest?",
    summary: "Signed-in customers skip typing their details.",
    points: [
      "Signed in: we already know your name and number. Every payment option is open, including Pay at venue.",
      "Guest: type your name and mobile number and pay the full amount online.",
      "Quick Rebook, membership, points and your history need an account.",
    ],
  },
  {
    id: "rebook",
    icon: "rebook",
    title: "Quick Rebook",
    summary: "One tap to book your usual time again.",
    points: [
      "We notice the day and hour you play most often and show it on Home.",
      "It appears only when that slot is still free. Tap it and the booking page opens with the time filled in.",
    ],
  },
  {
    id: "membership",
    icon: "member",
    title: "Membership",
    summary: "Member pricing and extra rewards, paid monthly, 3 or 6 months.",
    points: [
      "Open Membership, choose a plan and a period. Longer periods cost less per month.",
      `On 3 and 6 month plans we remind you ${EXPIRY_NOTICE_DAYS} days before the end so you can renew in one tap.`,
      `Buying or renewing earns bonus loyalty points: ${MEMBERSHIP_POINTS.quarterly} for 3 months, ${MEMBERSHIP_POINTS.half} for 6 months.`,
      "If you pay at the venue, the plan switches on once the venue confirms your payment.",
    ],
    href: { label: "See plans", to: "/member" },
  },
  {
    id: "points",
    icon: "points",
    title: "Loyalty points and free games",
    summary: "Play, earn points, turn them into a free game.",
    points: [
      `Each game earns its price ÷ ${RS_PER_POINT} points. ${GAMES_PER_FREE} games' worth of points buys a free game in that shift.`,
      `Extra goods earn 1 point for every Rs. ${RS_PER_POINT} you spend.`,
      `Winning captains earn ${POINTS_CAPTAIN_WIN} points for a challenge game.`,
      `Game points last ${GAME_POINTS_MONTHS} months, goods points 1 year, membership points never expire. We warn you before points expire.`,
      "To use them: open Points, pick a shift and tap Claim. Then book that shift and tap \"Use a free game voucher\".",
      "Free games work for regular bookings only, not for hosting a challenge.",
    ],
    href: { label: "My points", to: "/points" },
  },
  {
    id: "promos",
    icon: "promo",
    title: "Promo codes",
    summary: "Copy a code, paste it when you pay.",
    points: [
      "Promos shows what is active now, what is coming and what has ended.",
      "Tap Copy, then paste the code in the promo box on the booking or membership page.",
      "Some codes have rules (weekends only, mornings only, renewals only). The card says which.",
      "One code per booking.",
    ],
    href: { label: "See promos", to: "/promos" },
  },
  {
    id: "alerts",
    icon: "bell",
    title: "Notifications and the \"I'm coming\" reminder",
    summary: "We tell you about bookings, payments and challenges.",
    points: [
      "The bell on Home collects your messages. A red number on a Popular tile means something new is waiting there.",
      "One hour before your game a full-screen reminder asks \"Are you on your way?\". Slide to say you are coming and the venue is told.",
      "Prefer no full-screen pop-up? Turn off Pop-up reminder in Profile > Settings. You still get the bell message.",
      "Alerts only show while the app is open for now.",
    ],
  },
  {
    id: "captain",
    icon: "captain",
    title: "Captain mode and challenges",
    summary: "Build a team and challenge other teams.",
    points: [
      "In Profile, switch from Player to Captain, then name your team. You can have up to 12 players, yourself included.",
      "Only a captain can challenge another team, and needs at least 5 players. Teams are ranked with 1 to 5 stars from approved results.",
      "When you challenge, choose who pays: the loser pays 70%, 60% or all of it. Challenge games are paid at the venue after the game.",
      "After the game the winning captain enters the final score. The other captain approves it, and then the ratings update.",
      "When the venue confirms payment you get a \"Did you win?\" reminder to enter the score.",
    ],
    href: { label: "Opponents", to: "/opponent" },
  },
  {
    id: "profile",
    icon: "profile",
    title: "Your profile",
    summary: "Your bookings, stats, payments and settings.",
    points: [
      "My bookings shows your next game and your last game. Tap the arrow for the rest.",
      "Gameplay stats shows your latest game. Open the arrow for season totals.",
      "Payment history shows your two latest payments. Open the arrow for all of them.",
      "Every list has a Download PDF button for the full history.",
      "Settings has switches for the pop-up reminder, SMS reminders and promotional messages.",
    ],
    href: { label: "Open profile", to: "/profile" },
  },
  {
    id: "tournaments",
    icon: "trophy",
    title: "Tournaments",
    summary: "See live scores and the full tie-sheet.",
    points: [
      "Home shows the current tournament with its details.",
      "Open it to see every round, the scores and who plays next.",
    ],
    href: { label: "Tournaments", to: "/tournaments" },
  },
  {
    id: "urgent",
    icon: "bell",
    title: "Need urgent help?",
    summary: "Chat with the venue on WhatsApp from Home.",
    points: [
      "On Home, tap the green WhatsApp button at the bottom right.",
      "Pick what you need help with and WhatsApp opens with your message ready. Just press send.",
      "You can also call the venue from the same screen.",
    ],
  },
  {
    id: "install",
    icon: "install",
    title: "Put the app on your phone",
    summary: "Open it from your home screen like any app.",
    points: [
      "iPhone (Safari): tap Share, then Add to Home Screen.",
      "Android (Chrome): tap the Install prompt, or the menu then Install app.",
      "The page then opens full screen with the Unique Futsal icon.",
    ],
  },
];
