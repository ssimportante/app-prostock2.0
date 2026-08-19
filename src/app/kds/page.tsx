import { StationDisplayClient } from '@/components/kds/StationDisplayClient';

export default function KDSPage() {
  return (
    <StationDisplayClient 
      title="Kitchen Display" 
      stationType="kitchen"
      loadingText="Loading kitchen display..."
      itemTypeFilter="food"
    />
  );
}
