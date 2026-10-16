// Udgam 2026 events, from event_details.md (event-management sheet).
// `fee` values are PLACEHOLDERS (INR) until the committee confirms real pricing.

export type EventTier = "major" | "regular";
export type EventCategoryId = "games" | "sports" | "performance" | "creative" | "food" | "esports";

export interface EventCategory {
  id: EventCategoryId;
  label: string;
  /** OKLCH hue used to tint the category's cards */
  hue: number;
}

export interface EventGame {
  name: string;
  taglines: string[];
}

export interface FestEvent {
  id: string;
  name: string;
  tier: EventTier;
  category: EventCategoryId;
  /** entry fee in INR (placeholder) */
  fee: number;
  taglines: string[];
  description?: string;
  rounds?: string[];
  games?: EventGame[];
  docUrl?: string;
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
    fee: 120,
    taglines: [],
    docUrl: DOC("1B7N4-QUDR-qa8jM9BscvCeTci3eNen6rC4VW0rTIWqo", "edit?usp=sharing"),
  },
  {
    id: "treasure-hunt",
    name: "Treasure Hunt",
    tier: "major",
    category: "games",
    fee: 150,
    taglines: [
      "Follow the clues. Find the glory.",
      "X marks the spot. Who finds it first?",
      "Crack the clues, claim the prize!",
    ],
  },
  {
    id: "ipl-auction",
    name: "IPL Auction",
    tier: "major",
    category: "games",
    fee: 200,
    description: "Auction for IPL teams.",
    taglines: [
      "Every bid counts. Every player matters.",
      "Don't just watch the game, build it!",
      "Paddle up, pick your champions!",
    ],
  },
  {
    id: "ramp-walk",
    name: "Ramp Walk",
    tier: "major",
    category: "performance",
    fee: 150,
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
    fee: 50,
    taglines: [
      "Mark, match, shout — it's Housie time!",
      "One ticket, endless thrill!",
      "Let the numbers decide your luck!",
    ],
    docUrl: DOC("1xbvT6Qjjuh_73N48zYsrWKStTacIp8n3Biw-MkaIiPQ", "edit?usp=drivesdk"),
  },
  {
    id: "dance-competition",
    name: "Dance Competition",
    tier: "major",
    category: "performance",
    fee: 200,
    description: "The winner of the dance competition gets to perform on the Udgam stage.",
    taglines: [
      "Steal the floor, own the stage!",
      "Beat the rhythm, book your stage!",
      "Dance like the stage is already yours!",
    ],
  },
  {
    id: "food-fiesta",
    name: "Food Fiesta",
    tier: "major",
    category: "food",
    fee: 300,
    description: "Cook-off for food makers. The winner gets to run a stall during Udgam.",
    taglines: ["One fest. Endless flavors.", "Come hungry. Leave happy."],
  },
  {
    id: "singing-competition",
    name: "Singing Competition",
    tier: "major",
    category: "performance",
    fee: 100,
    taglines: ["Sing your heart out. Touch the soul.", "Amplify your voice. Electrify the crowd."],
    docUrl: DOC("1e5-mq9BAFEiCco7V1LSZt8cZ7-1HGBvsz1WJbWh3xtk", "edit?usp=drivesdk"),
  },
  {
    id: "wall-painting",
    name: "Wall Painting",
    tier: "major",
    category: "creative",
    fee: 150,
    taglines: ["Walls that speak, art that screams.", "Give your thoughts a splash of freedom."],
    docUrl: DOC("137-WU42Cb8S25cM8u-Iw7xFDLUh1RPUYhkLTkE2LrbQ", "edit?usp=drivesdk"),
  },

  // -------------------------------------------------------------- Regular
  {
    id: "dumb-charades",
    name: "Dumb Charades",
    tier: "regular",
    category: "games",
    fee: 50,
    description:
      "Guess the movie name — one player acts while the other guesses. Includes a guess-the-personality round.",
    taglines: [
      "Your expression. Their imagination. Let the madness begin.",
      "चेहरे पर भाव, ज़ुबाँ पर ताला।",
      "Where silence becomes cinema.",
    ],
  },
  {
    id: "antakshari",
    name: "Antakshari",
    tier: "regular",
    category: "performance",
    fee: 50,
    taglines: [
      "कुछ सुर, कुछ नग़मे, और एक महफ़िल यादगार।",
      "From timeless melodies to unforgettable moments.",
      "One letter can start a whole night of music.",
    ],
    docUrl: DOC("1jbyCjlLXby4l8ZayfrWYU8N3cfCmmEODQEPeePyFwX4", "edit?usp=sharing"),
  },
  {
    id: "balloon-burst",
    name: "Balloon Burst",
    tier: "regular",
    category: "games",
    fee: 30,
    taglines: [
      "A little pressure, a lot of chaos.",
      "Fast hands, sharp moves, one loud finish.",
      "Ready, set, pop!",
    ],
    docUrl: DOC("1JFok7TaEbYT8Ouwep5PeFjBnpUQacXLrZYkJ9t1CBpI", "edit?usp=drivesdk"),
  },
  {
    id: "squid-games",
    name: "Squid Games",
    tier: "regular",
    category: "games",
    fee: 80,
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
  },
  {
    id: "e-games",
    name: "E-Games",
    tier: "regular",
    category: "esports",
    fee: 100,
    description: "Compete in four titles: MLBB, Free Fire, BGMI and eFootball.",
    games: [
      {
        name: "Free Fire",
        taglines: [
          "Drop, loot, survive — Booyah or bust!",
          "One zone, one winner — are you ready?",
        ],
      },
      {
        name: "BGMI",
        taglines: ["Chicken dinner isn't served — it's earned!", "Not just a game — it's war!"],
      },
      {
        name: "MLBB",
        taglines: [
          "Legends aren't born — they're made in the arena!",
          "Five heroes, one goal — total annihilation!",
        ],
      },
      {
        name: "eFootball",
        taglines: [
          "One ball, one dream — kick your way to glory!",
          "If you can dream the goal, come score it.",
        ],
      },
    ],
    taglines: [],
  },
  {
    id: "guess-the-juice",
    name: "Guess the Juice",
    tier: "regular",
    category: "food",
    fee: 30,
    taglines: [
      "Bet you can't guess this in one sip.",
      "Taste buds vs. blindfold — who wins?",
      "Taste it. Trust it. Guess it.",
    ],
    docUrl: DOC("1W3b8AdF4SLNxlcbhjoxf3WaS9DgyOyXRUi0VFVq0QWI", "edit?tab=t.0"),
  },
  {
    id: "three-leg-tie",
    name: "Three-Leg Tie",
    tier: "regular",
    category: "sports",
    fee: 40,
    taglines: [
      "Three feet, one goal.",
      "Step together, win together.",
      "Tied together, race together.",
    ],
    docUrl: DOC("1kq-1mGJSQ4bCddgdR1_8Nq5mBhhrNwHXEIQ-_uBrykY", "edit?usp=sharing"),
  },
  {
    id: "musical-chair",
    name: "Musical Chair",
    tier: "regular",
    category: "games",
    fee: 30,
    description: "Grab a chair when the music stops.",
    taglines: ["Music on, game on.", "Listen, move, grab, win.", "Move fast, sit fast."],
  },
  {
    id: "rangoli",
    name: "Rangoli",
    tier: "regular",
    category: "creative",
    fee: 80,
    description: "Team up and make a rangoli.",
    taglines: ["Create together, shine together.", "Let your colour shine."],
  },
  {
    id: "tug-of-war",
    name: "Tug of War",
    tier: "regular",
    category: "sports",
    fee: 100,
    description: "Pull the rope and cross the winning line.",
    taglines: ["It's not personal… until you lose.", "Aaj rassi nahi, izzat kheechni hai."],
  },
  {
    id: "photography",
    name: "Photography",
    tier: "regular",
    category: "creative",
    fee: 50,
    description: "Submit raw pictures taken on your phone, with no post-processing.",
    taglines: ["Freeze the vibe, frame the moment.", "Paal ko thaamo, yaadon mein sajaao."],
  },
  {
    id: "food-eating-challenge",
    name: "Food Eating Challenge",
    tier: "regular",
    category: "food",
    fee: 60,
    description: "Whoever eats the most within the time limit wins.",
    taglines: ["Are you hungry enough to make history?", "Khao aise, ki plate sharma jaye."],
  },
  {
    id: "cup-pong",
    name: "Cup Pong",
    tier: "regular",
    category: "games",
    fee: 40,
    taglines: ["Aim. Bounce. Conquer.", "Aim sharp. Score big."],
    docUrl: DOC("12jCYqkQuibo-SxHFXvPzk_xMqHLQXVcoiurq3-Rd0Zw", "edit?usp=drivesdk"),
  },
  {
    id: "short-movie",
    name: "Short Movie Competition",
    tier: "regular",
    category: "creative",
    fee: 150,
    taglines: ["Small screen. Big stories.", "Your vision, our screen."],
    docUrl: DOC("1RIhcZUI_ft315IRD_aH607UVxkKPNDeOGRuYlBUMGHQ", "edit?usp=drivesdk"),
  },
  {
    id: "string-maze",
    name: "String Maze",
    tier: "regular",
    category: "sports",
    fee: 40,
    description:
      "Step into a maze of tangled strings and make your way to the other side without touching them. Duck, crawl, twist and squeeze through the gaps while finding the fastest route. One wrong move can cost you valuable seconds — reach the finish line in the shortest time to win.",
    taglines: [
      "Untangle the strings, conquer the maze.",
      "Navigate the knots, reach the goal.",
      "One maze. Endless twists.",
    ],
  },
  {
    id: "balloon-pair-race",
    name: "Balloon Between Two Race",
    tier: "regular",
    category: "sports",
    fee: 40,
    taglines: ["Two to hold one.", "Press in pair to move.", "Stick together, move as one!"],
  },
  {
    id: "fill-and-burst",
    name: "Fill & Burst the Balloon",
    tier: "regular",
    category: "games",
    fee: 40,
    taglines: [
      "Catch n' splash n' win.",
      "Fill, aim, throw, repeat.",
      "Can I pop this on you?",
      "Let the splash begin!",
    ],
    docUrl: DOC("10ks3HiBXkjX-6R5NMs7qaBhgKSIEGs-A28bJmBrDI5w", "edit?usp=drivesdk"),
  },
];

/** Taglines to rotate on a card; E-Games pulls one line from each title. */
export const cardTaglines = (event: FestEvent): string[] =>
  event.games ? event.games.map((g) => `${g.name}: ${g.taglines[0]}`) : event.taglines;
