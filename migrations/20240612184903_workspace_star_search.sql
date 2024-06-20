-------------------------------------------------------------------------------
-- StarSearch for workspaces
-------------------------------------------------------------------------------

-- =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=

-- This is a many to one "glue" table that allows for a workspace
-- to have many individual threads with StarSearch.

create table starsearch_workspace_threads (
  id uuid primary key default uuid_generate_v4() not null,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  deleted_at timestamp without time zone default null,

  -- glue together the starsearch thread and the workspace.
  starsearch_thread_id uuid not null references public.starsearch_threads (id) on delete cascade on update cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade on update cascade
);

create index if not exists starsearch_workspace_threads_idx_id on public.starsearch_workspace_threads (id);
create index if not exists starsearch_workspace_threads_idx_workspace_id on public.starsearch_workspace_threads (workspace_id);
create index if not exists starsearch_workspace_threads_idx_thread_id on public.starsearch_workspace_threads (starsearch_thread_id);
