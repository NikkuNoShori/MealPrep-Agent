import { useMemo } from 'react';
import { useMeasurementSystem } from '@/contexts/MeasurementSystemContext';
import { Unit } from '@/utils/unitConverter';

export const useMeasurementUnits = () => {
  const { system } = useMeasurementSystem();

  const units = useMemo(() => {
    const countable: Unit[] = ['piece', 'whole', 'slice', 'clove', 'head', 'bunch', 'can', 'package'];
    
    if (system === 'metric') {
      return {
        weight: ['g', 'kg'] as Unit[],
        volume: ['ml', 'l'] as Unit[],
        countable,
        all: ['g', 'kg', 'ml', 'l', ...countable] as Unit[],
      };
    } else {
      return {
        weight: ['oz', 'lb'] as Unit[],
        volume: ['tsp', 'tbsp', 'fl oz', 'cup'] as Unit[],
        countable,
        all: ['tsp', 'tbsp', 'fl oz', 'cup', 'oz', 'lb', ...countable] as Unit[],
      };
    }
  }, [system]);

  return units;
};

