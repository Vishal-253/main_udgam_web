// Authoritative registration rules for every event: fee and allowed team size.
// The server charges and validates ONLY from this file — never from anything the browser sends.
//
// The website shows the same values from frontend/src/features/events/data/eventDetails.ts.
// test/events-sync.test.ts fails if the two ever disagree, so change both together.

export interface EventRule {
  id: string;
  name: string;
  tier: "major" | "regular";
  /** entry fee in INR (0 = free, null = not announced yet -> registration refused) */
  fee: number | null;
  /** fee is charged per team or per person; null for free events */
  feeUnit: "team" | "person" | null;
  /** allowed participants per registration, INCLUDING the team leader */
  teamSize: { min: number; max: number };
}

export const EVENTS: readonly EventRule[] = [
  { id: "spoil-the-tshirt", name: "Spoil the T-shirt", tier: "major", fee: 150, feeUnit: "team", teamSize: { min: 3, max: 3 } },
  { id: "treasure-hunt", name: "Treasure Hunt", tier: "major", fee: 250, feeUnit: "team", teamSize: { min: 3, max: 3 } },
  { id: "ipl-auction", name: "IPL Auction", tier: "major", fee: 50, feeUnit: "team", teamSize: { min: 4, max: 6 } },
  { id: "ramp-walk", name: "Ramp Walk", tier: "major", fee: 0, feeUnit: null, teamSize: { min: 1, max: 1 } },
  { id: "housie", name: "Housie (Bingo)", tier: "major", fee: 0, feeUnit: null, teamSize: { min: 1, max: 1 } },
  { id: "dance-competition", name: "Dance Competition", tier: "major", fee: 0, feeUnit: null, teamSize: { min: 1, max: 7 } },
  { id: "food-fiesta", name: "Food Fiesta", tier: "major", fee: 0, feeUnit: null, teamSize: { min: 3, max: 5 } },
  { id: "singing-competition", name: "Singing Competition", tier: "major", fee: 0, feeUnit: null, teamSize: { min: 1, max: 1 } },
  { id: "wall-painting", name: "Wall Painting", tier: "major", fee: 200, feeUnit: "team", teamSize: { min: 1, max: 5 } },
  { id: "dumb-charades", name: "Dumb Charades", tier: "regular", fee: 0, feeUnit: null, teamSize: { min: 4, max: 4 } },
  { id: "antakshari", name: "Antakshari", tier: "regular", fee: 0, feeUnit: null, teamSize: { min: 5, max: 5 } },
  { id: "balloon-burst", name: "Balloon Burst", tier: "regular", fee: 30, feeUnit: "team", teamSize: { min: 2, max: 2 } },
  { id: "squid-games", name: "Squid Games", tier: "regular", fee: 30, feeUnit: "person", teamSize: { min: 1, max: 1 } },
  { id: "free-fire", name: "Free Fire", tier: "regular", fee: 200, feeUnit: "team", teamSize: { min: 4, max: 4 } },
  { id: "bgmi", name: "BGMI", tier: "regular", fee: 200, feeUnit: "team", teamSize: { min: 4, max: 5 } },
  { id: "mlbb", name: "MLBB", tier: "regular", fee: 200, feeUnit: "team", teamSize: { min: 5, max: 6 } },
  { id: "efootball", name: "eFootball", tier: "regular", fee: 50, feeUnit: "person", teamSize: { min: 1, max: 1 } },
  { id: "guess-the-juice", name: "Guess the Juice", tier: "regular", fee: 50, feeUnit: "team", teamSize: { min: 1, max: 1 } },
  { id: "three-leg-tie", name: "Three-Leg Tie", tier: "regular", fee: 30, feeUnit: "team", teamSize: { min: 2, max: 2 } },
  { id: "musical-chair", name: "Musical Chair", tier: "regular", fee: 0, feeUnit: null, teamSize: { min: 1, max: 1 } },
  { id: "rangoli", name: "Rangoli", tier: "regular", fee: 80, feeUnit: "team", teamSize: { min: 4, max: 4 } },
  { id: "tug-of-war", name: "Tug of War", tier: "regular", fee: 0, feeUnit: null, teamSize: { min: 5, max: 5 } },
  { id: "photography", name: "Photography", tier: "regular", fee: 0, feeUnit: null, teamSize: { min: 1, max: 1 } },
  { id: "food-eating-challenge", name: "Food Eating Challenge", tier: "regular", fee: 50, feeUnit: "person", teamSize: { min: 1, max: 1 } },
  { id: "cup-pong", name: "Cup Pong", tier: "regular", fee: 0, feeUnit: null, teamSize: { min: 1, max: 1 } },
  { id: "short-movie", name: "Short Movie Competition", tier: "regular", fee: 0, feeUnit: null, teamSize: { min: 1, max: 3 } },
  { id: "string-maze", name: "String Maze", tier: "regular", fee: 30, feeUnit: "person", teamSize: { min: 1, max: 1 } },
  { id: "balloon-pair-race", name: "Balloon Between Two Race", tier: "regular", fee: 0, feeUnit: null, teamSize: { min: 2, max: 2 } },
  { id: "fill-and-burst", name: "Fill & Burst the Balloon", tier: "regular", fee: 60, feeUnit: "team", teamSize: { min: 4, max: 5 } },
];

export const eventById = (id: string) => EVENTS.find((e) => e.id === id);
