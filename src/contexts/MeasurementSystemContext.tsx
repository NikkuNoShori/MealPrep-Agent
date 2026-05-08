import React, { useState, useEffect, ReactNode } from 'react';
import { usePreferences, useUpdatePreferences } from '@/services/api';
import { MeasurementSystem } from '@/utils/unitConverter';
import { MeasurementSystemContext } from '@/hooks/useMeasurementSystem';

export const MeasurementSystemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: preferences, isLoading } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const [system, setSystemState] = useState<MeasurementSystem>('metric');

  // Load preference from database — only when we actually get data back
  useEffect(() => {
    const prefs = preferences as any;
    if (prefs?.measurement_system) {
      setSystemState(prefs.measurement_system);
    }
    // Don't reset to metric when prefs is null/undefined — that would
    // overwrite an in-memory selection the user just made
  }, [preferences]);

  const setSystem = async (newSystem: MeasurementSystem) => {
    setSystemState(newSystem);
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
