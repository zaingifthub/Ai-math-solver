export type PlanId = "FREE" | "PREMIUM" | "EDUCATION";
export type GuestPlan = "GUEST";

export interface PlanLimits {
  solvesPerDay: number;
  aiExplanationsPerDay: number;
  tutorMessagesPerDay: number;
  imageScansPerDay: number;
  historyDays: number;
  practice: boolean;
}

export const LIMITS: Record<PlanId | GuestPlan, PlanLimits> = {
  GUEST: { solvesPerDay: 15, aiExplanationsPerDay: 3, tutorMessagesPerDay: 0, imageScansPerDay: 1, historyDays: 0, practice: true },
  FREE: { solvesPerDay: 50, aiExplanationsPerDay: 10, tutorMessagesPerDay: 15, imageScansPerDay: 5, historyDays: 30, practice: true },
  PREMIUM: { solvesPerDay: 2000, aiExplanationsPerDay: 500, tutorMessagesPerDay: 500, imageScansPerDay: 200, historyDays: 3650, practice: true },
  EDUCATION: { solvesPerDay: 5000, aiExplanationsPerDay: 1000, tutorMessagesPerDay: 1000, imageScansPerDay: 500, historyDays: 3650, practice: true },
};

export interface PlanInfo {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export const PLANS: PlanInfo[] = [
  {
    id: "FREE",
    name: "Free",
    tagline: "Everything you need to get unstuck on homework.",
    monthly: 0,
    yearly: 0,
    features: [
      `${LIMITS.FREE.solvesPerDay} verified solutions per day`,
      `${LIMITS.FREE.aiExplanationsPerDay} AI explanations per day`,
      `${LIMITS.FREE.tutorMessagesPerDay} AI tutor messages per day`,
      `${LIMITS.FREE.imageScansPerDay} photo scans per day`,
      "All calculators, graphing & formulas",
      "Practice quizzes and progress tracking",
      "30-day solution history",
    ],
    cta: "Start free",
  },
  {
    id: "PREMIUM",
    name: "Premium",
    tagline: "Unlimited learning for serious students.",
    monthly: 9.99,
    yearly: 79.99,
    features: [
      "Unlimited verified step-by-step solutions",
      "Unlimited AI explanations & alternative methods",
      "Unlimited AI tutor conversations",
      "Unlimited photo math scans",
      "Full history, bookmarks & learning analytics",
      "Weak-topic recommendations",
      "Priority processing, no ads",
    ],
    cta: "Go Premium",
    highlighted: true,
  },
  {
    id: "EDUCATION",
    name: "Education",
    tagline: "For teachers, tutors and classrooms.",
    monthly: 19.99,
    yearly: 179.99,
    features: [
      "Everything in Premium",
      "Higher usage limits",
      "Printable practice sets & answer keys",
      "Teaching-oriented explanations",
      "Priority support",
      "Volume licensing available",
    ],
    cta: "Get Education",
  },
];
