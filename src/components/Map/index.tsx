import dynamic from 'next/dynamic';
import { Venue, CrowdSnapshot } from '@/types';

// Google Maps loads the Maps JS SDK at runtime — SSR must be disabled
const VenueMap = dynamic(() => import('./VenueMapGoogle'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-[#8d90a0] text-sm tracking-widest" style={{ background: '#0e1322', borderRadius: 12 }}>
      <span className="animate-pulse">LOADING MAP…</span>
    </div>
  ),
});

export default VenueMap;
export type { Venue, CrowdSnapshot };
