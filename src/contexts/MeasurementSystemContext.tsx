import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePreferences, useUpdatePreferences } from '@/services/api';
import { MeasurementSystem } from '@/utils/unitConverter';

interface MeasurementSystemContextType {
  system: MeasurementSystem;
  setSystem: (system: MeasurementSystem) => void;
  isLoading: boolean;
}

const MeasurementSystemContext = createContext<MeasurementSystemContextType | undefined>(undefined);

export const MeasurementSystemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: preferences, isLoading } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const [system, setSystemState] = useState<MeasurementSystem>('metric');
  const [hasUserOverride, setHasUserOverride] = useState(false);

  // Load preference from database — only when we actually get data back
  useEffect(() => {
    const prefs = preferences as any;
    if (prefs?.measurement_system) {
      setSystemState(prefs.measurement_system);
    }
    // Don't reset to metric when prefs is null/undefined — that would
    // overwrite an in-memory selection the user just made
  }, [preferences]);

  // Update system and save to database
  const setSystem = async (newSystem: MeasurementSystem) => {
    setSystemState(newSystem);
    setHasUserOverride(true);
    try {
      await updatePreferences.mutateAsync({
        measurement_system: newSystem,
      });
    } catch (error: any) {
      console.warn('Failed to update measurement system (migration may not be run):', error?.message);
    }
  };

  return (
    <MeasurementSystemContext.Provider value={{ system, setSystem, isLoading }}>
      {children}
    </MeasurementSystemContext.Provider>
  );
};

export const useMeasurementSystem = () => {
  const context = useContext(MeasurementSystemContext);
  if (context === undefined) {
    throw new Error('useMeasurementSystem must be used within a MeasurementSystemProvider');
  }
  return context;
};

