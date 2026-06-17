import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/kitchen/PlaceholderScreen';

export default function KitchenPlaceholderRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <PlaceholderScreen slug={typeof slug === 'string' ? slug : undefined} />;
}
