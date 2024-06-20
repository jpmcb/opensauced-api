-------------------------------------------------------------------------------
-- Add trigram matching
-------------------------------------------------------------------------------

-- The pg_trgm extension provides text similarity measurement
-- and index searching based on trigrams which allows for searches with wildcards
-- on BOTH sides of a "ILIKE" fuzzy search (example: ILIKE("%kuberne%"))

create extension pg_trgm;

create index idx_repos_full_name_trgm on repos using gin (full_name gin_trgm_ops);
