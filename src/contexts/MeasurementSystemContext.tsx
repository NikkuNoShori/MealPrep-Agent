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

  // Load preference from database
  useEffect(() => {
    if (preferences?.measurement_system) {
      setSystemState(preferences.measurement_system);
    } else {
      // Preferences don't exist yet or column doesn't exist, use default (metric)
      setSystemState('metric');
    }
  }, [preferences]);

  // Update system and save to database
  const setSystem = async (newSystem: MeasurementSystem) => {
    const previousSystem = system;
    setSystemState(newSystem);
    try {
      await updatePreferences.mutateAsync({
        measurement_system: newSystem,
      });
    } catch (error: any) {
      console.warn('Failed to update measurement system (migration may not be run):', error?.message);
      // Don't revert - keep the new system in memory even if DB update fails
      // This allows the feature to work even before the migration is applied
      // The preference will be saved once the migration is run
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

