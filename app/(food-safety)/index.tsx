import { FoodSafetyAckScreen } from '@/components/auth/FoodSafetyAckScreen';

/**
 * Food-safety acknowledgement gate. The route guard sends users here
 * when they're authenticated + verified but haven't acknowledged the
 * current `FOOD_SAFETY_ACK_VERSION`. Tapping "I understand" persists
 * the version and lets the route guard route them onward (chat or
 * onboarding depending on whether the model is on disk).
 */
export default function FoodSafetyRoute() {
  return <FoodSafetyAckScreen />;
}
