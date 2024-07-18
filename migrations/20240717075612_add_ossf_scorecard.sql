-------------------------------------------------------------------------------
-- Adds the OSSF Scorecard scores to the repos table
-------------------------------------------------------------------------------

alter table repos add column ossf_scorecard_total_score float default null;
alter table repos add column ossf_scorecard_dependency_update_score float default null;
alter table repos add column ossf_scorecard_fuzzing_score float default null;
alter table repos add column ossf_scorecard_maintained_score float default null;

alter table repos add column ossf_scorecard_updated_at timestamp without time zone not null default to_timestamp(0);
