// Udgam 2026 events, from event_details.md (event-management sheet).
// Entry fees from event_names_entry_fees.md (event-management sheet).
// Team sizes from the rulebooks; the backend enforces fees + sizes from backend/src/data/events.ts
// (backend/test/events-sync.test.ts fails if the two lists disagree).

export type EventTier = "major" | "regular";
export type EventCategoryId = "games" | "sports" | "performance" | "creative" | "food" | "esports";

export interface EventCategory {
  id: EventCategoryId;
  label: string;
  /** OKLCH hue used to tint the category's cards */
  hue: number;
}

export interface FestEvent {
  id: string;
  name: string;
  tier: EventTier;
  category: EventCategoryId;
  /** entry fee in INR; 0 = free entry, null = not announced yet */
  fee: number | null;
  /** what the fee covers; omitted for free / unannounced fees and flat fees */
  feeUnit?: "team" | "person";
  /** allowed number of participants per registration, INCLUDING the team leader */
  teamSize: { min: number; max: number };
  taglines: string[];
  description?: string;
  rounds?: string[];
  docUrl?: string;
  /** path to local PDF rulebook served from /public/rulebooks/ */
  rulebookPdf?: string;
}

export const EVENT_CATEGORIES: EventCategory[] = [
  { id: "games", label: "Games", hue: 355 },
  { id: "sports", label: "Sports", hue: 25 },
  { id: "performance", label: "Performance", hue: 320 },
  { id: "creative", label: "Creative", hue: 285 },
  { id: "food", label: "Food", hue: 60 },
  { id: "esports", label: "E-Sports", hue: 250 },
];

const DOC = (id: string, suffix = "edit") => `https://docs.google.com/document/d/${id}/${suffix}`;

export const EVENTS: FestEvent[] = [
  // ---------------------------------------------------------------- Major
  {
    id: "spoil-the-tshirt",
    name: "Spoil the T-shirt",
    tier: "major",
    category: "games",
    fee: 150,
    feeUnit: "team",
    teamSize: { min: 3, max: 3 },
    taglines: [],
    docUrl: DOC("1B7N4-QUDR-qa8jM9BscvCeTci3eNen6rC4VW0rTIWqo", "edit?usp=sharing"),
    rulebookPdf: "/rulebooks/spoil-the-tshirt.pdf",
  },
  {
    id: "treasure-hunt",
    name: "Treasure Hunt",
    tier: "major",
    category: "games",
    fee: 250,
    feeUnit: "team",
    teamSize: { min: 3, max: 3 },
    taglines: [
      "Follow the clues. Find the glory.",
      "X marks the spot. Who finds it first?",
      "Crack the clues, claim the prize!",
    ],
    rulebookPdf: "/rulebooks/treasure-hunt.pdf",
  },
  {
    id: "ipl-auction",
    name: "IPL Auction",
    tier: "major",
    category: "games",
    fee: 50,
    feeUnit: "team",
    teamSize: { min: 4, max: 6 },
    description: "Auction for IPL teams.",
    taglines: [
      "Every bid counts. Every player matters.",
      "Don't just watch the game, build it!",
      "Paddle up, pick your champions!",
    ],
    rulebookPdf: "/rulebooks/ipl-auction.pdf",
  },
  {
    id: "ramp-walk",
    name: "Ramp Walk",
    tier: "major",
    category: "performance",
    fee: 0,
    teamSize: { min: 1, max: 1 },
    description: "Ramp walk with different traditions.",
    taglines: [
      "Threads of tradition, steps of grace!",
      "Dress the legacy, own the stage!",
      "From tradition to trend — one walk away!",
    ],
  },
  {
    id: "housie",
    name: "Housie (Bingo)",
    tier: "major",
    category: "games",
    fee: 0,
    teamSize: { min: 1, max: 1 },
    taglines: [
      "Mark, match, shout — it's Housie time!",
      "One ticket, endless thrill!",
      "Let the numbers decide your luck!",
    ],
    docUrl: DOC("1xbvT6Qjjuh_73N48zYsrWKStTacIp8n3Biw-MkaIiPQ", "edit?usp=drivesdk"),
    rulebookPdf: "/rulebooks/housie.pdf",
  },
  {
    id: "dance-competition",
    name: "Dance Competition",
    tier: "major",
    category: "performance",
    fee: 0,
    teamSize: { min: 1, max: 7 },
    description: "The winner of the dance competition gets to perform on the Udgam stage.",
    taglines: [
      "Steal the floor, own the stage!",
      "Beat the rhythm, book your stage!",
      "Dance like the stage is already yours!",
    ],
    rulebookPdf: "/rulebooks/dance-competition.pdf",
  },
  {
    id: "food-fiesta",
    name: "Food Fiesta",
    tier: "major",
    category: "food",
    fee: 0,
    teamSize: { min: 3, max: 5 },
    description: "Cook-off for food makers. The winner gets to run a stall during Udgam.",
    taglines: ["One fest. Endless flavors.", "Come hungry. Leave happy."],
    rulebookPdf: "/rulebooks/food-fiesta.pdf",
  },
  {
    id: "singing-competition",
    name: "Singing Competition",
    tier: "major",
    category: "performance",
    fee: 0,
    teamSize: { min: 1, max: 1 },
    taglines: ["Sing your heart out. Touch the soul.", "Amplify your voice. Electrify the crowd."],
    docUrl: DOC("1e5-mq9BAFEiCco7V1LSZt8cZ7-1HGBvsz1WJbWh3xtk", "edit?usp=drivesdk"),
    rulebookPdf: "/rulebooks/singing-competition.pdf",
  },
  {
    id: "wall-painting",
    name: "Wall Painting",
    tier: "major",
    category: "creative",
    fee: 200,
    feeUnit: "team",
    teamSize: { min: 1, max: 5 },
    taglines: ["Walls that speak, art that screams.", "Give your thoughts a splash of freedom."],
    docUrl: DOC("137-WU42Cb8S25cM8u-Iw7xFDLUh1RPUYhkLTkE2LrbQ", "edit?usp=drivesdk"),
    rulebookPdf: "/rulebooks/wall-painting.pdf",
  },

  // -------------------------------------------------------------- Regular
  {
    id: "dumb-charades",
    name: "Dumb Charades",
    tier: "regular",
    category: "games",
    fee: 0,
    teamSize: { min: 4, max: 4 },
    description:
      "Guess the movie name — one player acts while the other guesses. Includes a guess-the-personality round.",
    taglines: [
      "Your expression. Their imagination. Let the madness begin.",
      "चेहरे पर भाव, ज़ुबाँ पर ताला।",
      "Where silence becomes cinema.",
    ],
    rulebookPdf: "/rulebooks/dumb-charades.pdf",
  },
  {
    id: "antakshari",
    name: "Antakshari",
    tier: "regular",
    category: "performance",
    fee: 0,
    teamSize: { min: 5, max: 5 },
    taglines: [
      "कुछ सुर, कुछ नग़मे, और एक महफ़िल यादगार।",
      "From timeless melodies to unforgettable moments.",
      "One letter can start a whole night of music.",
    ],
    docUrl: DOC("1jbyCjlLXby4l8ZayfrWYU8N3cfCmmEODQEPeePyFwX4", "edit?usp=sharing"),
    rulebookPdf: "/rulebooks/antakshari.pdf",
  },
  {
    id: "balloon-burst",
    name: "Balloon Burst",
    tier: "regular",
    category: "games",
    fee: 30,
    feeUnit: "team",
    teamSize: { min: 2, max: 2 },
    taglines: [
      "A little pressure, a lot of chaos.",
      "Fast hands, sharp moves, one loud finish.",
      "Ready, set, pop!",
    ],
    docUrl: DOC("1JFok7TaEbYT8Ouwep5PeFjBnpUQacXLrZYkJ9t1CBpI", "edit?usp=drivesdk"),
    rulebookPdf: "/rulebooks/balloon-burst.pdf",
  },
  {
    id: "squid-games",
    name: "Squid Games",
    tier: "regular",
    category: "games",
    fee: 30,
    feeUnit: "person",
    teamSize: { min: 1, max: 1 },
    description: "Four rounds of survival games.",
    rounds: [
      "Red Light, Green Light",
      "Odd or Even",
      "Ddakji",
      "Team of 3: Flip the Bottle & Ball in the Bucket",
    ],
    taglines: [
      "Step in. Play smart. Walk out a winner.",
      "Survive the games, claim the glory!",
      "Outplay. Outlast. Outsurvive.",
    ],
    rulebookPdf: "/rulebooks/squid-games.pdf",
  },
  {
    id: "free-fire",
    name: "Free Fire",
    tier: "regular",
    category: "esports",
    fee: 200,
    feeUnit: "team",
    teamSize: { min: 4, max: 4 },
    taglines: ["Drop, loot, survive — Booyah or bust!", "One zone, one winner — are you ready?"],
    rulebookPdf: "/rulebooks/free-fire.pdf",
  },
  {
    id: "bgmi",
    name: "BGMI",
    tier: "regular",
    category: "esports",
    fee: 200,
    feeUnit: "team",
    teamSize: { min: 4, max: 5 },
    taglines: ["Chicken dinner isn't served — it's earned!", "Not just a game — it's war!"],
    rulebookPdf: "/rulebooks/bgmi.pdf",
  },
  {
    id: "mlbb",
    name: "MLBB",
    tier: "regular",
    category: "esports",
    fee: 200,
    feeUnit: "team",
    teamSize: { min: 5, max: 6 },
    taglines: [
      "Legends aren't born — they're made in the arena!",
      "Five heroes, one goal — total annihilation!",
    ],
    rulebookPdf: "/rulebooks/mlbb.pdf",
  },
  {
    id: "efootball",
    name: "eFootball",
    tier: "regular",
    category: "esports",
    fee: 50,
    feeUnit: "person",
    teamSize: { min: 1, max: 1 },
    taglines: [
      "One ball, one dream — kick your way to glory!",
      "If you can dream the goal, come score it.",
    ],
  },
  {
    id: "guess-the-juice",
    name: "Guess the Juice",
    tier: "regular",
    category: "food",
    fee: 50,
    feeUnit: "team",
    teamSize: { min: 1, max: 1 },
    taglines: [
      "Bet you can't guess this in one sip.",
      "Taste buds vs. blindfold — who wins?",
      "Taste it. Trust it. Guess it.",
    ],
  },
  {
    id: "three-leg-tie",
    name: "Three-Leg Tie",
    tier: "regular",
    category: "sports",
    fee: 30,
    feeUnit: "team",
    teamSize: { min: 2, max: 2 },
    taglines: [
      "Three feet, one goal.",
      "Step together, win together.",
      "Tied together, race together.",
    ],
    docUrl: DOC("1kq-1mGJSQ4bCddgdR1_8Nq5mBhhrNwHXEIQ-_uBrykY", "edit?usp=sharing"),
    rulebookPdf: "/rulebooks/three-leg-tie.pdf",
  },
  {
    id: "musical-chair",
    name: "Musical Chair",
    tier: "regular",
    category: "games",
    fee: 0,
    teamSize: { min: 1, max: 1 },
    description: "Grab a chair when the music stops.",
    taglines: ["Music on, game on.", "Listen, move, grab, win.", "Move fast, sit fast."],
  },
  {
    id: "rangoli",
    name: "Rangoli",
    tier: "regular",
    category: "creative",
    fee: 80,
    feeUnit: "team",
    teamSize: { min: 4, max: 4 },
    description: "Team up and make a rangoli.",
    taglines: ["Create together, shine together.", "Let your colour shine."],
    rulebookPdf: "/rulebooks/rangoli.pdf",
  },
  {
    id: "tug-of-war",
    name: "Tug of War",
    tier: "regular",
    category: "sports",
    fee: 0,
    teamSize: { min: 5, max: 5 },
    description: "Pull the rope and cross the winning line.",
    taglines: ["It's not personal… until you lose.", "Aaj rassi nahi, izzat kheechni hai."],
  },
  {
    id: "photography",
    name: "Photography",
    tier: "regular",
    category: "creative",
    fee: 0,
    teamSize: { min: 1, max: 1 },
    description: "Submit raw pictures taken on your phone, with no post-processing.",
    taglines: ["Freeze the vibe, frame the moment.", "Paal ko thaamo, yaadon mein sajaao."],
    rulebookPdf: "/rulebooks/photography.pdf",
  },
  {
    id: "food-eating-challenge",
    name: "Food Eating Challenge",
    tier: "regular",
    category: "food",
    fee: 50,
    feeUnit: "person",
    teamSize: { min: 1, max: 1 },
    description: "Whoever eats the most within the time limit wins.",
    taglines: ["Are you hungry enough to make history?", "Khao aise, ki plate sharma jaye."],
    rulebookPdf: "/rulebooks/food-eating-challenge.pdf",
  },
  {
    id: "cup-pong",
    name: "Cup Pong",
    tier: "regular",
    category: "games",
    fee: 0,
    teamSize: { min: 1, max: 1 },
    taglines: ["Aim. Bounce. Conquer.", "Aim sharp. Score big."],
    docUrl: DOC("12jCYqkQuibo-SxHFXvPzk_xMqHLQXVcoiurq3-Rd0Zw", "edit?usp=drivesdk"),
    rulebookPdf: "/rulebooks/cup-pong.pdf",
  },
  {
    id: "short-movie",
    name: "Short Movie Competition",
    tier: "regular",
    category: "creative",
    fee: 0,
    teamSize: { min: 1, max: 3 },
    taglines: ["Small screen. Big stories.", "Your vision, our screen."],
    docUrl: DOC("1RIhcZUI_ft315IRD_aH607UVxkKPNDeOGRuYlBUMGHQ", "edit?usp=drivesdk"),
    rulebookPdf: "/rulebooks/short-movie.pdf",
  },
  {
    id: "string-maze",
    name: "String Maze",
    tier: "regular",
    category: "sports",
    fee: 30,
    feeUnit: "person",
    teamSize: { min: 1, max: 1 },
    description:
      "Step into a maze of tangled strings and make your way to the other side without touching them. Duck, crawl, twist and squeeze through the gaps while finding the fastest route. One wrong move can cost you valuable seconds — reach the finish line in the shortest time to win.",
    taglines: [
      "Untangle the strings, conquer the maze.",
      "Navigate the knots, reach the goal.",
      "One maze. Endless twists.",
    ],
    rulebookPdf: "/rulebooks/string-maze.pdf",
  },
  {
    id: "balloon-pair-race",
    name: "Balloon Between Two Race",
    tier: "regular",
    category: "sports",
    fee: 0,
    teamSize: { min: 2, max: 2 },
    taglines: ["Two to hold one.", "Press in pair to move.", "Stick together, move as one!"],
    rulebookPdf: "/rulebooks/balloon-pair-race.pdf",
  },
  {
    id: "fill-and-burst",
    name: "Fill & Burst the Balloon",
    tier: "regular",
    category: "games",
    fee: 60,
    feeUnit: "team",
    teamSize: { min: 4, max: 5 },
    taglines: [
      "Catch n' splash n' win.",
      "Fill, aim, throw, repeat.",
      "Can I pop this on you?",
      "Let the splash begin!",
    ],
    docUrl: DOC("10ks3HiBXkjX-6R5NMs7qaBhgKSIEGs-A28bJmBrDI5w", "edit?usp=drivesdk"),
    rulebookPdf: "/rulebooks/fill-and-burst.pdf",
  },
];
