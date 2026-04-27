export type PlanCadence = 'monthly' | 'annual';

export interface Plan {
  id: string;
  cadence: PlanCadence;
  priceCents: number;
  currency: string;
  displayName: string;
}

export interface SubscriptionState {
  isActive: boolean;
  plan: Plan | null;
  expiresAt: number | null;
}
