import dynamic from 'next/dynamic';
import { Venue, CrowdSnapshot } from '@/types';

// SSR must be disabled — Leaflet reads window/document at import time
const VenueMap = dynamic(() => import('./VenueMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-[#8d90a0] text-sm tracking-widest">
      <span className="animate-pulse">LOADING MAP…</span>
    </div>
  ),
});

export default VenueMap;
export type { Venue, CrowdSnapshot };
