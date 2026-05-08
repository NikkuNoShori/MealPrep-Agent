import { createContext, useContext } from 'react';
import { MeasurementSystem } from '@/utils/unitConverter';

export interface MeasurementSystemContextType {
  system: MeasurementSystem;
  setSystem: (system: MeasurementSystem) => void;
  isLoading: boolean;
}

export const MeasurementSystemContext = createContext<MeasurementSystemContextType | undefined>(undefined);

export const useMeasurementSystem = () => {
  const context = useContext(MeasurementSystemContext);
  if (context === undefined) {
    throw new Error('useMeasurementSystem must be used within a MeasurementSystemProvider');
  }
  return context;
};
