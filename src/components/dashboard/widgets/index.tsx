// Lazy-loaded dashboard widget exports
import dynamic from 'next/dynamic';
import React from 'react';
import { WidgetSkeleton } from '../shared/WidgetSkeleton';

// Loading component for Smart Action Center
const SmartActionCenterLoader = () => (
    <div className="space-y-3">
        <WidgetSkeleton variant="action-center" />
        <WidgetSkeleton variant="action-center" />
    </div>
);

// Smart Action Center - P0 Priority
export const SmartActionCenter = dynamic(
    () => import('./SmartActionCenter/SmartActionCenter'),
    {
        loading: SmartActionCenterLoader,
        ssr: false,
    }
);

// Future widgets - P2 Priority (to be implemented)
// export const LiveAgentGrid = dynamic(() => import('./LiveAgentGrid/LiveAgentGrid'), { ... });
// export const PeakHourHeatmap = dynamic(() => import('./PeakHourHeatmap/PeakHourHeatmap'), { ... });
// export const TopicsCloud = dynamic(() => import('./TopicsCloud/TopicsCloud'), { ... });
