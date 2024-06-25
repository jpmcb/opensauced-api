-------------------------------------------------------------------------------
-- Add OSCR, the "Open Source Contributor Rating" to the users table
-------------------------------------------------------------------------------

alter table users add column oscr float default 0;
alter table users add column devstats_updated_at timestamp without time zone not null default to_timestamp(0);
