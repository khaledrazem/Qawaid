-- Map each definition to CAMeL Tools morphology feature values for auto-detect.
-- Feature names and values follow: https://camel-tools.readthedocs.io/en/latest/reference/camel_morphology_features.html
-- (pos, prc0, prc1, prc2, prc3, enc0, asp, cas, form_gen, form_num, gen, mod, num, per, rat, stt, vox, etc.)
ALTER TABLE definitions
  ADD COLUMN IF NOT EXISTS camel_feature_map jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN definitions.camel_feature_map IS 'Array of { "feature": "<camel_feature_name>", "value": "<camel_value>" } mapping this definition to CAMeL morphology (e.g. pos=noun, prc0=Al_det). Used by auto-detect and backend mapping.';
