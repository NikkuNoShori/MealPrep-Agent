-- Migration 030: Dietary flags and allergy tagging schema additions
-- MOP-0024 + MOP-0025
-- NOTE: family_members.dietary_restrictions and family_members.allergies already exist
--       (added in 001_core_schema.sql). Only new columns are added here.

ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS dietary_flags TEXT[] DEFAULT '{}',
  -- Structured dietary lifestyle flags: 'vegan','vegetarian','gluten-free','dairy-free','halal','kosher','keto','paleo'
  ADD COLUMN IF NOT EXISTS dislikes TEXT[] DEFAULT '{}';
  -- Soft ingredient/cuisine dislikes (non-allergy, used for meal randomizer exclusions)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergies TEXT[] DEFAULT '{}';
