import { StationDisplayClient } from '@/components/kds/StationDisplayClient';

export default function BarDisplayPage() {
  return (
    <StationDisplayClient 
      title="Bar Display" 
      stationType="bar"
      loadingText="Loading bar display..."
      itemTypeFilter="beverage"
    />
  );
}
