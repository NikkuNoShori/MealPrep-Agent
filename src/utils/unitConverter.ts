/**
 * Unit conversion utility for metric/imperial system
 * Maintains accuracy while converting between measurement systems
 */

export type MeasurementSystem = 'metric' | 'imperial';

// Unit categories
export type WeightUnit = 'g' | 'kg' | 'oz' | 'lb';
export type VolumeUnit = 'ml' | 'l' | 'fl oz' | 'cup' | 'tbsp' | 'tsp';
export type TemperatureUnit = 'C' | 'F';
export type LengthUnit = 'cm' | 'm' | 'in' | 'ft';

export type Unit = WeightUnit | VolumeUnit | TemperatureUnit | LengthUnit | 'piece' | 'whole' | 'slice' | 'clove' | 'head' | 'bunch' | 'can' | 'package';

// Conversion factors
const CONVERSIONS = {
  // Weight
  'g': { toImperial: (val: number) => val * 0.035274, imperialUnit: 'oz' },
  'kg': { toImperial: (val: number) => val * 2.20462, imperialUnit: 'lb' },
  'oz': { toMetric: (val: number) => val * 28.3495, metricUnit: 'g' },
  'lb': { toMetric: (val: number) => val * 0.453592, metricUnit: 'kg' },
  
  // Volume
  'ml': { toImperial: (val: number) => val * 0.033814, imperialUnit: 'fl oz' },
  'l': { toImperial: (val: number) => val * 4.22675, imperialUnit: 'cup' },
  'fl oz': { toMetric: (val: number) => val * 29.5735, metricUnit: 'ml' },
  'cup': { toMetric: (val: number) => val * 236.588, metricUnit: 'ml' },
  'tbsp': { toMetric: (val: number) => val * 14.7868, metricUnit: 'ml' },
  'tsp': { toMetric: (val: number) => val * 4.92892, metricUnit: 'ml' },
  
  // Temperature
  'C': { toImperial: (val: number) => (val * 9/5) + 32, imperialUnit: 'F' },
  'F': { toMetric: (val: number) => (val - 32) * 5/9, metricUnit: 'C' },
  
  // Length
  'cm': { toImperial: (val: number) => val * 0.393701, imperialUnit: 'in' },
  'm': { toImperial: (val: number) => val * 3.28084, imperialUnit: 'ft' },
  'in': { toMetric: (val: number) => val * 2.54, metricUnit: 'cm' },
  'ft': { toMetric: (val: number) => val * 0.3048, metricUnit: 'm' },
} as const;

// Units that don't need conversion (countable items)
const COUNTABLE_UNITS: Unit[] = ['piece', 'whole', 'slice', 'clove', 'head', 'bunch', 'can', 'package'];

/**
 * Check if a unit is metric
 */
export function isMetricUnit(unit: Unit): boolean {
  return ['g', 'kg', 'ml', 'l', 'C', 'cm', 'm'].includes(unit);
}

/**
 * Check if a unit is imperial
 */
export function isImperialUnit(unit: Unit): boolean {
  return ['oz', 'lb', 'fl oz', 'cup', 'tbsp', 'tsp', 'F', 'in', 'ft'].includes(unit);
}

/**
 * Check if a unit is countable (doesn't need conversion)
 */
export function isCountableUnit(unit: Unit): boolean {
  return COUNTABLE_UNITS.includes(unit);
}

/**
 * Convert a value from one unit to another
 */
export function convertValue(
  value: number,
  fromUnit: Unit,
  toSystem: MeasurementSystem
): { value: number; unit: Unit } {
  // Validate input
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return { value: 0, unit: fromUnit };
  }
  
  // If unit is countable, no conversion needed
  if (isCountableUnit(fromUnit)) {
    return { value, unit: fromUnit };
  }

  // If already in target system, no conversion needed
  if (toSystem === 'metric' && isMetricUnit(fromUnit)) {
    return { value, unit: fromUnit };
  }
  if (toSystem === 'imperial' && isImperialUnit(fromUnit)) {
    return { value, unit: fromUnit };
  }

  // Get conversion function
  const conversion = CONVERSIONS[fromUnit as keyof typeof CONVERSIONS];
  if (!conversion) {
    // Unknown unit, return as-is
    return { value, unit: fromUnit };
  }

  // Convert to target system
  if (toSystem === 'imperial' && 'toImperial' in conversion) {
    const convertedValue = conversion.toImperial(value);
    return {
      value: roundToReasonablePrecision(convertedValue),
      unit: conversion.imperialUnit as Unit,
    };
  } else if (toSystem === 'metric' && 'toMetric' in conversion) {
    const convertedValue = conversion.toMetric(value);
    return {
      value: roundToReasonablePrecision(convertedValue),
      unit: conversion.metricUnit as Unit,
    };
  }

  return { value, unit: fromUnit };
}

/**
 * Round to reasonable precision for display
 * - Whole numbers for large values
 * - 1 decimal for medium values
 * - 2 decimals for small values
 */
function roundToReasonablePrecision(value: number): number {
  if (value >= 100) {
    return Math.round(value);
  } else if (value >= 10) {
    return Math.round(value * 10) / 10;
  } else if (value >= 1) {
    return Math.round(value * 10) / 10;
  } else {
    return Math.round(value * 100) / 100;
  }
}

/**
 * Format a converted value for display
 */
export function formatConvertedValue(value: number, unit: Unit): string {
  // Validate input
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return `0 ${unit}`;
  }
  
  const rounded = roundToReasonablePrecision(value);
  
  // Format based on value size
  if (rounded >= 1000) {
    return `${rounded.toLocaleString()} ${unit}`;
  } else if (rounded >= 1) {
    return `${rounded} ${unit}`;
  } else {
    return `${rounded.toFixed(2)} ${unit}`;
  }
}

/**
 * Convert an ingredient amount and unit
 */
export function convertIngredient(
  amount: number,
  unit: Unit,
  targetSystem: MeasurementSystem
): { amount: number; unit: Unit } {
  const result = convertValue(amount, unit, targetSystem);
  return { amount: result.value, unit: result.unit };
}

/**
 * Get the appropriate unit for a converted value
 * Sometimes we need to adjust units (e.g., 16 oz = 1 lb)
 */
export function optimizeUnit(value: number, unit: Unit): { value: number; unit: Unit } {
  // Validate input
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return { value: 0, unit: unit };
  }
  
  // Convert large oz to lb
  if (unit === 'oz' && value >= 16) {
    return { value: value / 16, unit: 'lb' };
  }
  // Convert large fl oz to cups
  if (unit === 'fl oz' && value >= 8) {
    return { value: value / 8, unit: 'cup' };
  }
  // Convert large ml to l
  if (unit === 'ml' && value >= 1000) {
    return { value: value / 1000, unit: 'l' };
  }
  // Convert large g to kg
  if (unit === 'g' && value >= 1000) {
    return { value: value / 1000, unit: 'kg' };
  }
  
  return { value, unit };
}

