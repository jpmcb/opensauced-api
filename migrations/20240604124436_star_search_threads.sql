-------------------------------------------------------------------------------
-- StarSearch threads
-------------------------------------------------------------------------------

create extension if not exists vector;

-- =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=
--
-- The main thread table that stores the ID for the thread and various metadata.
-- This is the anchor point where "glue" tables can left join to get access to the
-- thread history and other metadata.

create table starsearch_threads (
  id uuid primary key default uuid_generate_v4() not null,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  archived_at timestamp without time zone default null,
  deleted_at timestamp without time zone default null,

  -- StarSearch threads can be shared publicly to enable collaboration
  -- and share information across a history.
  -- This flag denotes ONLY that the thread is publicly viewable.
  is_publicly_viewable boolean default false,

  -- The Dub.co URL for the publicly viewable thread. A consistent link that
  -- always point to the publicly viewable link of the thread.
  public_link text default null,

  -- An LLM generated title for the thread, ideally only 5-10 words from
  -- what the user is generally asking about.
  title varchar(255) default null,

  -- This is a dynamic, elastic column that stores a chunk of text that represents
  -- an LLM generated "memory" of deeper message history. For longer threads, we
  -- cannot give the LLM all the history in the user prompt. So, instead, we'll feed it
  -- this summary alongside the last few raw messages.
  --
  -- This means that the StarSearch manager and its agent prompts should look something like:
  -- {prompt preamble}
  -- {this thread_summary}
  -- {last few raw messages}
  -- {vector search results / other context}
  -- {user provided query}
  --
  -- In this way, we give the model immediate access to the last few messages in history,
  -- a deeper "memory" of older messages via the summary, and the rest of the RAG context.
  thread_summary TEXT default null
);

-- Indexes
create index if not exists starsearch_threads_idx_id on public.starsearch_threads (id);

-- =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=
--
-- This is a one-to-one "glue" table that allows for a user
-- to have many individual threads with StarSearch.
create table starsearch_user_threads (
  id uuid primary key default uuid_generate_v4() not null,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  deleted_at timestamp without time zone default null,

  -- glue together the starsearch thread and the individual user.
  -- A user may have many starsearch threads.
  starsearch_thread_id uuid not null references public.starsearch_threads (id) on delete cascade on update cascade,
  user_id int not null references public.users (id) on delete cascade on update cascade
);

create index if not exists starsearch_user_threads_idx_id on public.starsearch_user_threads (id);
create index if not exists starsearch_user_threads_idx_user_id on public.starsearch_user_threads (user_id);
create index if not exists starsearch_user_threads_idx_thread_id on public.starsearch_user_threads (starsearch_thread_id);

-- =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=   =^..^=
--
-- A "glue" table that can be used with a left join to get all messages for a thread.

create table starsearch_thread_history (
  id uuid primary key default uuid_generate_v4() not null,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  observed_at timestamp without time zone default null,
  deleted_at timestamp without time zone default null,

  -- Backlink to the starsearch thread ID
  starsearch_thread_id uuid not null references public.starsearch_threads (id) on delete cascade on update cascade,

  -- The type of message: this is important for replaying "function_call" events in the
  -- thread history. This type would typically be "content" to denote textual content
  -- from the LLM. But may also be "function_call" to capture when an enriched component
  -- is being renderd.
  type text default null,

  -- The raw, replayable JSON for the LLM content, user messages, function calls, etc.
  -- This is designed to be replayed by the client to backfill history when needed
  message text default null,

  -- Sometimes the LLM encounters an unrecoverable error.
  -- We track these cases to give us the ability to attempt and replay messages / cases
  -- that are errors in the entire thread history.
  is_error boolean default false,
  error text default null,

  -- Who sent the message
  -- (i.e., was it it a user query? Was it StarSearch? Was it a specific StarSearch agent?)
  actor text default null,

  -- If the user thumbed up / down the message. 0 is the default, 1 thumbs up,
  -- -1 thumbs down. This way, we can get a weighted vibe of the whole chat.
  mood INT DEFAULT 0,

  -- Since we embed user queries, we now store them:
  -- Doing any embedding costs money (albeit, fractions of pennies for small texts),
  -- but it also allows us to do vector searches across these embeddings.
  -- In the future, we may be able to find similar style questions from users who
  -- are interacting with StarSearch in similar ways or come up with other
  -- interesting ways to search across embedded user queries.
  --
  -- Currently, only user queries get embedded. So, this column would
  -- be empty for any "actor" that was not "user".
  embedding vector(1024) default null
);

-- Indexes
create index if not exists starsearch_thread_history_idx_id on public.starsearch_thread_history (id);
create index if not exists starsearch_thread_history_idx_thread_id on public.starsearch_thread_history (starsearch_thread_id);
