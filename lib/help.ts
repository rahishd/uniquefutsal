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
      "Choose a day and a start time, then pay the same way as a game booking (Fonepay or at the venue).",
      "Guests pay online in full. Signed-in customers can also pay at the venue.",
    ],
    href: { label: "Book Gamezone", to: "/gamezone" },
  },
  {
    id: "payment",
    icon: "pay",
    title: "Paying with Fonepay or at the venue",
    summary: "Scan the QR and we confirm the payment for you.",
    points: [
      "Fonepay shows a QR for the exact amount. The note on the payment is filled in automatically.",
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
      "You do not need a new sign-up: sign in with the number you already play with, open Membership and choose a plan, your fixed hour and a start date.",
      "The price is shown before you send the request. Pay it at the venue and the staff switch your membership on.",
      "4 PM to 8 PM is kept for regular bookings, so those hours are not offered for memberships.",
      `On 3 and 6 month plans we remind you ${EXPIRY_NOTICE_DAYS} days before the end so you can renew in one tap.`,
      `Buying or renewing earns bonus loyalty points: ${MEMBERSHIP_POINTS.quarterly} for 3 months, ${MEMBERSHIP_POINTS.half} for 6 months.`,
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
    id: "cancel",
    icon: "book",
    title: "Cancel a booking",
    summary: "Cancelling is free until the game starts.",
    points: [
      "Open Profile, find your booking and tap Cancel booking. It costs nothing.",
      "If you already paid online, the venue returns the full amount to you. You get a message in the bell.",
      "Your slot is released for other players straight away. You cannot cancel a game that has already started.",
    ],
    href: { label: "Open profile", to: "/profile" },
  },
  {
    id: "password",
    icon: "profile",
    title: "Forgot your password?",
    summary: "Reset it yourself with your Google account.",
    points: [
      "Once, while signed in: Profile > Settings > Google account for password reset > Link.",
      "If you forget your password: on the sign-in page tap Reset it with Google, enter your mobile number and a new password, then continue with the same Google account.",
      "Never linked a Google account? Call the venue and we will help you.",
    ],
  },
  {
    id: "code",
    icon: "book",
    title: "Your booking code",
    summary: "A short code like UF-7K3QX9 for every booking.",
    points: [
      "You see it on the confirmation screen, in Profile and in your reminders.",
      "Quote it when you call or message the venue.",
    ],
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
      "Want alerts when the app is closed? Turn on Alerts when the app is closed in Profile > Settings and allow notifications. On iPhone, add the app to your Home Screen first.",
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
      "Games played shows your latest game. Open the arrow for earlier games. Goals and assists are recorded by the venue for games you play from now on and shown next to each game.",
      "Payment history shows your two latest payments. Open the arrow for all of them.",
      "If you pay for goods and games together at the venue, you get one bill (CB-...) listing each item and the loyalty points you earned.",
      "Every list has a Download PDF button for the full history.",
      "Settings has switches for alerts when the app is closed, the pop-up reminder, SMS reminders and promotional messages.",
      "Link your Google account in Settings so you can reset a forgotten password yourself.",
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
    id: "complaints",
    icon: "bell",
    title: "Send a complaint",
    summary: "Tell the venue about a problem, with photos if you like.",
    points: [
      "On Home, tap Complaints in the Popular section. You need to be signed in.",
      "Pick what it is about, describe what happened, and add up to 3 photos if they help.",
      "You can add your booking code so we find the game faster.",
      "You get a reference like CP-7K3QX9. The venue's reply shows on the same page and in your notifications.",
      "You can send up to 5 complaints a day. For something urgent, call the venue.",
    ],
    href: { label: "Complaints", to: "/complaints" },
  },
  {
    id: "academy",
    icon: "bell",
    title: "Children's Academy",
    summary: "Book a football class for your child, aged 10 to 14.",
    points: [
      "On Home, tap Children's Academy in the Popular section. The guardian needs to be signed in.",
      "Fill in the guardian's name and number, an emergency contact, your address, then your child's name, age and health.",
      "Pick one of the class times the venue has opened, read the Terms and Conditions and tick to accept.",
      "You get a code like AC-7K3QX9. You can cancel from the same page until the class starts.",
      "If the venue has to cancel a class, you are told in your notifications.",
    ],
    href: { label: "Children's Academy", to: "/academy" },
  },
  {
    id: "refer",
    icon: "bell",
    title: "Refer & Earn",
    summary: "Book a game for another team and you both earn loyalty points.",
    points: [
      "Open Refer & Earn in the Popular section. Pick a date and a time right there, no need to go to the booking page.",
      "Then type the other team's name and contact number (they need an account in the app) and tap Confirm booking.",
      "The slot is booked on your account and paid at the venue.",
      "The venue checks the referral. When it is approved, both of you get the points and a notification.",
      "The number of points is set by the venue and shown on the page. Referral points last 12 months.",
      "You can withdraw a referral while it is still waiting. Each booking can be referred once.",
    ],
    href: { label: "Refer & Earn", to: "/refer" },
  },
  {
    id: "digitalid",
    icon: "profile",
    title: "Digital ID card",
    summary: "Your own QR card. Show it at the venue.",
    points: [
      "Tap the QR button next to Hello on Home, or My Digital ID in Profile. Your card shows our name, your name, your number and a QR.",
      "Download it as a picture or send it on WhatsApp. The venue scans it to open your account, and it also marks your membership attendance.",
      "The QR has none of your details inside. Other apps cannot read it, only the Unique Futsal team can.",
      "Lost it or sent it to the wrong person? Tap Make a new QR. The old card stops working at once.",
    ],
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
