/**
 * ActionRequiredSection - Wrapper for Smart Action Center widget.
 * This re-exports the new SmartActionCenter for backward compatibility.
 */
import React from 'react';
import { SmartActionCenter } from '@/components/dashboard/widgets/SmartActionCenter';

export const ActionRequiredSection = () => {
  return <SmartActionCenter />;
};

