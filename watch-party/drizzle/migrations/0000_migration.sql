create extension if not exists pg_trgm with schema extensions;

-- ========== ROOMS (server-authoritative sync state) ==========
create table public.rooms (
  code text primary key,
  version integer not null default 0,
  playing boolean not null default false,
  position_at_ref double precision not null default 0,
  server_ref_time double precision not null default 0,
  host_session text not null,
  control_mode text not null default 'everyone',
  video_url text,
  video_title text,
  movie_id integer,
  theme text not null default 'friends',
  locked boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.rooms to anon, authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create policy "rooms readable" on public.rooms for select to anon, authenticated using (true);

create or replace function public.server_ms() returns double precision
language sql volatile set search_path = public as $$
  select extract(epoch from clock_timestamp()) * 1000
$$;

create or replace function public.room_json(r public.rooms, applied boolean) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'code', r.code, 'version', r.version, 'playing', r.playing,
    'positionAtRef', r.position_at_ref, 'serverRefTime', r.server_ref_time,
    'hostId', r.host_session, 'controlMode', r.control_mode,
    'videoUrl', r.video_url, 'videoTitle', r.video_title, 'movieId', r.movie_id,
    'theme', r.theme, 'locked', r.locked,
    'serverNow', public.server_ms(), 'applied', applied)
$$;

create or replace function public.create_room(p_session text, p_theme text, p_video_url text, p_video_title text, p_movie_id integer default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text; r public.rooms; i int;
begin
  if p_session is null or length(p_session) < 8 then raise exception 'invalid session'; end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.rooms(code, host_session, theme, video_url, video_title, movie_id, server_ref_time)
  values (v_code, p_session, coalesce(p_theme, 'friends'), p_video_url, p_video_title, p_movie_id, public.server_ms())
  returning * into r;
  return public.room_json(r, true);
end $$;

create or replace function public.get_room(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where code = upper(p_code);
  if not found then return null; end if;
  return public.room_json(r, true);
end $$;

-- play / pause / seek / load. Versioned optimistic concurrency: stale -> current state returned.
create or replace function public.room_command(p_code text, p_session text, p_version integer, p_action text, p_position double precision default null, p_video_url text default null, p_video_title text default null, p_movie_id integer default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.rooms; v_now double precision; v_cur double precision;
begin
  select * into r from public.rooms where code = upper(p_code) for update;
  if not found then raise exception 'room not found'; end if;
  if r.control_mode = 'host' and r.host_session <> p_session then return public.room_json(r, false); end if;
  if p_version is distinct from r.version then return public.room_json(r, false); end if;
  v_now := public.server_ms();
  v_cur := case when r.playing then r.position_at_ref + (v_now - r.server_ref_time) / 1000.0 else r.position_at_ref end;
  if p_action = 'play' then
    r.playing := true; r.position_at_ref := greatest(0, coalesce(p_position, v_cur));
  elsif p_action = 'pause' then
    r.playing := false; r.position_at_ref := greatest(0, coalesce(p_position, v_cur));
  elsif p_action = 'seek' then
    r.position_at_ref := greatest(0, coalesce(p_position, v_cur));
  elsif p_action = 'load' then
    r.playing := false; r.position_at_ref := 0;
    r.video_url := p_video_url; r.video_title := p_video_title; r.movie_id := p_movie_id;
  else
    raise exception 'unknown action %', p_action;
  end if;
  r.server_ref_time := v_now; r.version := r.version + 1;
  update public.rooms set playing = r.playing, position_at_ref = r.position_at_ref, server_ref_time = r.server_ref_time,
    version = r.version, video_url = r.video_url, video_title = r.video_title, movie_id = r.movie_id
  where code = r.code;
  return public.room_json(r, true);
end $$;

-- host admin: transfer (by host), claim (when expected host is gone), mode, lock
create or replace function public.room_admin(p_code text, p_session text, p_action text, p_target text default null, p_value text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where code = upper(p_code) for update;
  if not found then raise exception 'room not found'; end if;
  if p_action = 'claim' then
    if r.host_session <> p_target then return public.room_json(r, false); end if;
    r.host_session := p_session;
  else
    if r.host_session <> p_session then return public.room_json(r, false); end if;
    if p_action = 'transfer' then r.host_session := p_target;
    elsif p_action = 'mode' then r.control_mode := case when p_value = 'host' then 'host' else 'everyone' end;
    elsif p_action = 'lock' then r.locked := (p_value = 'true');
    else raise exception 'unknown action'; end if;
  end if;
  r.version := r.version + 1;
  update public.rooms set host_session = r.host_session, control_mode = r.control_mode, locked = r.locked, version = r.version where code = r.code;
  return public.room_json(r, true);
end $$;

grant execute on function public.server_ms() to anon, authenticated;
grant execute on function public.create_room(text, text, text, text, integer) to anon, authenticated;
grant execute on function public.get_room(text) to anon, authenticated;
grant execute on function public.room_command(text, text, integer, text, double precision, text, text, integer) to anon, authenticated;
grant execute on function public.room_admin(text, text, text, text, text) to anon, authenticated;

-- ========== MOVIE DATABASE ==========
create table public.languages (code text primary key, name text not null);
create table public.genres (id serial primary key, name text not null unique);
create table public.movies (
  id integer primary key, title text not null, original_title text, year integer, overview text,
  runtime integer, rating numeric(3,1), popularity numeric, language text references public.languages(code),
  poster_path text, playable_url text
);
create table public.movie_genres (movie_id integer references public.movies(id) on delete cascade, genre_id integer references public.genres(id) on delete cascade, primary key (movie_id, genre_id));
create table public.people (id serial primary key, name text not null unique);
create table public.movie_cast (movie_id integer references public.movies(id) on delete cascade, person_id integer references public.people(id) on delete cascade, character text, billing_order integer, primary key (movie_id, person_id));
create table public.movie_crew (movie_id integer references public.movies(id) on delete cascade, person_id integer references public.people(id) on delete cascade, job text not null, primary key (movie_id, person_id, job));

create index movies_title_trgm on public.movies using gin (lower(title) extensions.gin_trgm_ops);
create index people_name_trgm on public.people using gin (lower(name) extensions.gin_trgm_ops);

grant select on public.languages, public.genres, public.movies, public.movie_genres, public.people, public.movie_cast, public.movie_crew to anon, authenticated;
grant all on public.languages, public.genres, public.movies, public.movie_genres, public.people, public.movie_cast, public.movie_crew to service_role;
alter table public.languages enable row level security;
alter table public.genres enable row level security;
alter table public.movies enable row level security;
alter table public.movie_genres enable row level security;
alter table public.people enable row level security;
alter table public.movie_cast enable row level security;
alter table public.movie_crew enable row level security;
create policy "public read" on public.languages for select to anon, authenticated using (true);
create policy "public read" on public.genres for select to anon, authenticated using (true);
create policy "public read" on public.movies for select to anon, authenticated using (true);
create policy "public read" on public.movie_genres for select to anon, authenticated using (true);
create policy "public read" on public.people for select to anon, authenticated using (true);
create policy "public read" on public.movie_cast for select to anon, authenticated using (true);
create policy "public read" on public.movie_crew for select to anon, authenticated using (true);

create or replace function public.movie_card(m public.movies) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', m.id, 'title', m.title, 'originalTitle', m.original_title, 'year', m.year,
    'overview', m.overview, 'runtime', m.runtime, 'rating', m.rating, 'popularity', m.popularity,
    'language', m.language, 'posterPath', m.poster_path, 'playableUrl', m.playable_url,
    'genres', coalesce((select jsonb_agg(g.name order by g.name) from movie_genres mg join genres g on g.id = mg.genre_id where mg.movie_id = m.id), '[]'),
    'directors', coalesce((select jsonb_agg(p.name) from movie_crew c join people p on p.id = c.person_id where c.movie_id = m.id and c.job = 'Director'), '[]'),
    'cast', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'character', c.character) order by c.billing_order) from movie_cast c join people p on p.id = c.person_id where c.movie_id = m.id), '[]'))
$$;

create or replace function public.fuzzy_name_match(p_query text, p_name text) returns boolean
language sql immutable set search_path = public, extensions as $$
  select word_similarity(lower(p_query), lower(p_name)) > 0.45 or similarity(lower(p_query), lower(p_name)) > 0.35
$$;

create or replace function public.search_movies(
  q text default null, p_genre text default null, p_actor text default null, p_director text default null,
  p_language text default null, p_year_from integer default null, p_year_to integer default null,
  p_min_rating numeric default null, p_max_runtime integer default null, p_sort text default 'relevance',
  p_page integer default 1, p_page_size integer default 24)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  with base as (
    select m.*,
      case when coalesce(trim(q), '') = '' then 0 else greatest(
        similarity(lower(m.title), lower(q)),
        word_similarity(lower(q), lower(m.title)),
        word_similarity(lower(q), lower(coalesce(m.original_title, ''))),
        case when m.title ilike '%' || q || '%' then 1 else 0 end,
        coalesce((select max(greatest(word_similarity(lower(q), lower(p.name)), similarity(lower(q), lower(p.name)))) * 0.9
          from people p where p.id in (select person_id from movie_cast where movie_id = m.id union select person_id from movie_crew where movie_id = m.id)), 0)
      ) end as score
    from movies m
    where (p_genre is null or exists (select 1 from movie_genres mg join genres g on g.id = mg.genre_id where mg.movie_id = m.id and lower(g.name) = lower(p_genre)))
      and (p_language is null or m.language = p_language)
      and (p_year_from is null or m.year >= p_year_from)
      and (p_year_to is null or m.year <= p_year_to)
      and (p_min_rating is null or m.rating >= p_min_rating)
      and (p_max_runtime is null or m.runtime <= p_max_runtime)
      and (p_actor is null or exists (select 1 from movie_cast c join people p on p.id = c.person_id where c.movie_id = m.id and fuzzy_name_match(p_actor, p.name)))
      and (p_director is null or exists (select 1 from movie_crew c join people p on p.id = c.person_id where c.movie_id = m.id and c.job = 'Director' and fuzzy_name_match(p_director, p.name)))
  ), matched as (
    select * from base where coalesce(trim(q), '') = '' or score > 0.32
  ), ordered as (
    select * from matched
    order by
      case when p_sort = 'rating' then rating end desc nulls last,
      case when p_sort = 'year' then year end desc nulls last,
      case when p_sort = 'runtime' then runtime end asc nulls last,
      case when p_sort = 'title' then title end asc,
      case when p_sort = 'popularity' then popularity end desc nulls last,
      score desc, popularity desc nulls last
    limit greatest(1, least(p_page_size, 100)) offset (greatest(p_page, 1) - 1) * greatest(1, least(p_page_size, 100))
  )
  select jsonb_build_object(
    'total', (select count(*) from matched), 'page', greatest(p_page, 1),
    'items', coalesce((select jsonb_agg(movie_card(row(o.id, o.title, o.original_title, o.year, o.overview, o.runtime, o.rating, o.popularity, o.language, o.poster_path, o.playable_url)::movies) || jsonb_build_object('score', round(o.score::numeric, 3))) from ordered o), '[]'))
$$;

create or replace function public.search_people(q text, p_role text default null) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(x order by x.score desc), '[]') from (
    select p.id, p.name, round(greatest(word_similarity(lower(q), lower(p.name)), similarity(lower(q), lower(p.name)))::numeric, 3) as score,
      case when exists (select 1 from movie_crew c where c.person_id = p.id and c.job = 'Director') then 'director' else 'actor' end as role
    from people p
    where fuzzy_name_match(q, p.name)
      and (p_role is null
        or (p_role = 'director' and exists (select 1 from movie_crew c where c.person_id = p.id and c.job = 'Director'))
        or (p_role = 'actor' and exists (select 1 from movie_cast c where c.person_id = p.id)))
    order by 3 desc limit 8
  ) x
$$;

create or replace function public.movie_facets() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'genres', (select coalesce(jsonb_agg(jsonb_build_object('name', g.name, 'count', (select count(*) from movie_genres mg where mg.genre_id = g.id)) order by g.name), '[]') from genres g),
    'languages', (select coalesce(jsonb_agg(jsonb_build_object('code', l.code, 'name', l.name, 'count', (select count(*) from movies m where m.language = l.code)) order by l.name), '[]') from languages l),
    'total', (select count(*) from movies))
$$;

create or replace function public.similar_movies(p_id integer) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(movie_card(m) || jsonb_build_object('similarity', s.score) order by s.score desc, m.popularity desc), '[]')
  from (
    select o.id, (
      2 * (select count(*) from movie_genres a join movie_genres b on a.genre_id = b.genre_id where a.movie_id = p_id and b.movie_id = o.id)
      + 4 * (select count(*) from movie_crew a join movie_crew b on a.person_id = b.person_id and a.job = 'Director' and b.job = 'Director' where a.movie_id = p_id and b.movie_id = o.id)
      + 3 * (select count(*) from movie_cast a join movie_cast b on a.person_id = b.person_id where a.movie_id = p_id and b.movie_id = o.id)
    ) as score
    from movies o where o.id <> p_id
  ) s join movies m on m.id = s.id
  where s.score > 0
  limit 12
$$;

grant execute on function public.search_movies(text, text, text, text, text, integer, integer, numeric, integer, text, integer, integer) to anon, authenticated;
grant execute on function public.search_people(text, text) to anon, authenticated;
grant execute on function public.movie_facets() to anon, authenticated;
grant execute on function public.similar_movies(integer) to anon, authenticated;

-- ========== SAMPLE SEED ==========
insert into public.languages(code, name) values
 ('en','English'),('fr','French'),('hi','Hindi'),('ja','Japanese'),('ko','Korean'),('es','Spanish'),('zh','Chinese');

create or replace function public._seed_movie(p_id int, p_title text, p_year int, p_runtime int, p_rating numeric, p_pop numeric, p_lang text,
  p_genres text[], p_directors text[], p_cast text[], p_overview text, p_url text default null, p_original text default null)
returns void language plpgsql set search_path = public as $$
declare n text; i int := 0; pid int; gid int;
begin
  insert into movies(id, title, original_title, year, overview, runtime, rating, popularity, language, playable_url)
  values (p_id, p_title, coalesce(p_original, p_title), p_year, p_overview, p_runtime, p_rating, p_pop, p_lang, p_url);
  foreach n in array p_genres loop
    insert into genres(name) values (n) on conflict (name) do nothing;
    select id into gid from genres where name = n;
    insert into movie_genres values (p_id, gid) on conflict do nothing;
  end loop;
  foreach n in array p_directors loop
    insert into people(name) values (n) on conflict (name) do nothing;
    select id into pid from people where name = n;
    insert into movie_crew values (p_id, pid, 'Director') on conflict do nothing;
  end loop;
  foreach n in array p_cast loop
    i := i + 1;
    insert into people(name) values (n) on conflict (name) do nothing;
    select id into pid from people where name = n;
    insert into movie_cast values (p_id, pid, null, i) on conflict do nothing;
  end loop;
end $$;

select public._seed_movie(1,'Big Buck Bunny',2008,10,6.5,80,'en',array['Animation','Comedy','Family'],array['Sacha Goedegebure'],array[]::text[],'A giant gentle rabbit takes a hilarious revenge on three bullying rodents. A Blender open movie.','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
select public._seed_movie(2,'Sintel',2010,15,7.4,70,'en',array['Animation','Fantasy','Adventure'],array['Colin Levy'],array['Halina Reijn','Thom Hoffman'],'A lonely girl searches the world for the baby dragon she once rescued. A Blender open movie.','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4');
select public._seed_movie(3,'Tears of Steel',2012,12,6.0,55,'en',array['Science Fiction','Action'],array['Ian Hubert'],array['Derek de Lint','Sergio Hasselbaink'],'Warriors and scientists in future Amsterdam try to save the world from robots. A Blender open movie.','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
select public._seed_movie(4,'Elephants Dream',2006,11,6.2,45,'en',array['Animation','Science Fiction'],array['Bassam Kurdali'],array['Tygo Gernandt','Cas Jansen'],'Two men explore a strange, ever-shifting machine world. The first Blender open movie.','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4');
select public._seed_movie(5,'Inception',2010,148,8.4,98,'en',array['Action','Science Fiction','Thriller'],array['Christopher Nolan'],array['Leonardo DiCaprio','Joseph Gordon-Levitt','Elliot Page'],'A thief who steals secrets through dreams is given one last job: planting an idea.');
select public._seed_movie(6,'Interstellar',2014,169,8.4,97,'en',array['Adventure','Drama','Science Fiction'],array['Christopher Nolan'],array['Matthew McConaughey','Anne Hathaway','Jessica Chastain'],'Explorers travel through a wormhole to find humanity a new home.');
select public._seed_movie(7,'The Dark Knight',2008,152,8.5,96,'en',array['Action','Crime','Drama'],array['Christopher Nolan'],array['Christian Bale','Heath Ledger','Michael Caine'],'Batman faces the Joker, a criminal who wants to watch Gotham burn.');
select public._seed_movie(8,'Oppenheimer',2023,180,8.1,95,'en',array['Drama','History'],array['Christopher Nolan'],array['Cillian Murphy','Emily Blunt','Robert Downey Jr.'],'The story of the physicist who led the creation of the atomic bomb.');
select public._seed_movie(9,'Titanic',1997,194,7.9,94,'en',array['Drama','Romance'],array['James Cameron'],array['Leonardo DiCaprio','Kate Winslet'],'Two young people from different worlds fall in love aboard a doomed ship.');
select public._seed_movie(10,'Avatar',2009,162,7.6,93,'en',array['Action','Adventure','Science Fiction'],array['James Cameron'],array['Sam Worthington','Zoe Saldaña'],'A marine on an alien moon is torn between orders and the world he comes to love.');
select public._seed_movie(11,'La La Land',2016,128,7.9,88,'en',array['Romance','Drama','Music'],array['Damien Chazelle'],array['Ryan Gosling','Emma Stone'],'A jazz pianist and an aspiring actress fall in love in Los Angeles.');
select public._seed_movie(12,'Whiplash',2014,107,8.4,85,'en',array['Drama','Music'],array['Damien Chazelle'],array['Miles Teller','J.K. Simmons'],'A young drummer is pushed to the edge by a ruthless music teacher.');
select public._seed_movie(13,'The Notebook',2004,123,7.9,84,'en',array['Romance','Drama'],array['Nick Cassavetes'],array['Ryan Gosling','Rachel McAdams'],'A poor young man and a rich young woman fall in love one summer.');
select public._seed_movie(14,'Pride & Prejudice',2005,129,8.1,80,'en',array['Romance','Drama'],array['Joe Wright'],array['Keira Knightley','Matthew Macfadyen'],'Elizabeth Bennet and Mr. Darcy clash, then fall in love.');
select public._seed_movie(15,'Before Sunrise',1995,101,8.0,70,'en',array['Romance','Drama'],array['Richard Linklater'],array['Ethan Hawke','Julie Delpy'],'Two strangers meet on a train and spend one night walking around Vienna.');
select public._seed_movie(16,'Amélie',2001,122,7.9,78,'fr',array['Comedy','Romance'],array['Jean-Pierre Jeunet'],array['Audrey Tautou','Mathieu Kassovitz'],'A shy waitress in Paris decides to change the lives of those around her.','','Le Fabuleux Destin d''Amélie Poulain');
select public._seed_movie(17,'Dilwale Dulhania Le Jayenge',1995,189,8.5,82,'hi',array['Romance','Comedy','Drama'],array['Aditya Chopra'],array['Shah Rukh Khan','Kajol'],'Two young Indians fall in love on a trip across Europe.');
select public._seed_movie(18,'Lagaan',2001,224,8.0,74,'hi',array['Drama','Sports','Music'],array['Ashutosh Gowariker'],array['Aamir Khan','Gracy Singh'],'Villagers bet their taxes on a cricket match against British officers.');
select public._seed_movie(19,'Dangal',2016,161,8.2,83,'hi',array['Drama','Sports'],array['Nitesh Tiwari'],array['Aamir Khan','Fatima Sana Shaikh'],'A former wrestler trains his daughters to become world-class champions.');
select public._seed_movie(20,'Rocky',1976,120,7.7,80,'en',array['Drama','Sports'],array['John G. Avildsen'],array['Sylvester Stallone','Talia Shire'],'A small-time boxer gets a once-in-a-lifetime shot at the title.');
select public._seed_movie(21,'Moneyball',2011,133,7.2,70,'en',array['Drama','Sports'],array['Bennett Miller'],array['Brad Pitt','Jonah Hill'],'A baseball manager uses data to build a winning team on a budget.');
select public._seed_movie(22,'Remember the Titans',2000,113,7.5,68,'en',array['Drama','Sports'],array['Boaz Yakin'],array['Denzel Washington','Ryan Hurst'],'A new coach unites a racially divided high school football team.');
select public._seed_movie(23,'Ford v Ferrari',2019,152,8.0,81,'en',array['Drama','Sports','Action'],array['James Mangold'],array['Matt Damon','Christian Bale'],'Engineers and drivers build a car to beat Ferrari at Le Mans.');
select public._seed_movie(24,'Space Jam',1996,88,6.6,72,'en',array['Animation','Comedy','Family','Sports'],array['Joe Pytka'],array['Michael Jordan','Bill Murray'],'Michael Jordan helps the Looney Tunes win a basketball game against aliens.');
select public._seed_movie(25,'Coco',2017,105,8.2,90,'en',array['Animation','Family','Fantasy'],array['Lee Unkrich'],array['Anthony Gonzalez','Gael García Bernal'],'A boy who dreams of music journeys to the Land of the Dead.');
select public._seed_movie(26,'Toy Story',1995,81,8.0,88,'en',array['Animation','Comedy','Family'],array['John Lasseter'],array['Tom Hanks','Tim Allen'],'A cowboy doll feels threatened when a space ranger toy arrives.');
select public._seed_movie(27,'Finding Nemo',2003,100,7.8,86,'en',array['Animation','Family'],array['Andrew Stanton'],array['Albert Brooks','Ellen DeGeneres'],'A timid clownfish crosses the ocean to find his son.');
select public._seed_movie(28,'Paddington 2',2017,103,7.8,70,'en',array['Comedy','Family','Adventure'],array['Paul King'],array['Ben Whishaw','Hugh Grant'],'Paddington is framed for theft and must clear his name.');
select public._seed_movie(29,'Spirited Away',2001,125,8.5,89,'ja',array['Animation','Family','Fantasy'],array['Hayao Miyazaki'],array['Rumi Hiiragi','Miyu Irino'],'A girl must work in a spirit bathhouse to free her parents.','','千と千尋の神隠し');
select public._seed_movie(30,'My Neighbor Totoro',1988,86,8.1,80,'ja',array['Animation','Family','Fantasy'],array['Hayao Miyazaki'],array['Noriko Hidaka','Chika Sakamoto'],'Two sisters meet friendly forest spirits in rural Japan.','','となりのトトロ');
select public._seed_movie(31,'Parasite',2019,132,8.5,92,'ko',array['Comedy','Thriller','Drama'],array['Bong Joon-ho'],array['Song Kang-ho','Choi Woo-shik'],'A poor family schemes its way into working for a wealthy household.','','기생충');
select public._seed_movie(32,'The Grand Budapest Hotel',2014,100,8.0,79,'en',array['Comedy','Drama'],array['Wes Anderson'],array['Ralph Fiennes','Tony Revolori'],'A legendary concierge and his lobby boy are caught up in a theft and murder.');
select public._seed_movie(33,'Jurassic Park',1993,127,7.9,90,'en',array['Adventure','Science Fiction'],array['Steven Spielberg'],array['Sam Neill','Laura Dern','Jeff Goldblum'],'A theme park of cloned dinosaurs breaks down during a preview tour.');
select public._seed_movie(34,'E.T. the Extra-Terrestrial',1982,115,7.5,82,'en',array['Science Fiction','Family','Adventure'],array['Steven Spielberg'],array['Henry Thomas','Drew Barrymore'],'A boy befriends a stranded alien and helps him get home.');
select public._seed_movie(35,'Back to the Future',1985,116,8.3,89,'en',array['Adventure','Comedy','Science Fiction'],array['Robert Zemeckis'],array['Michael J. Fox','Christopher Lloyd'],'A teenager is sent back to 1955 in a time-travelling DeLorean.');
select public._seed_movie(36,'Forrest Gump',1994,142,8.5,91,'en',array['Comedy','Drama','Romance'],array['Robert Zemeckis'],array['Tom Hanks','Robin Wright'],'A kind man witnesses and shapes decades of American history.');
select public._seed_movie(37,'The Shawshank Redemption',1994,142,8.7,93,'en',array['Drama','Crime'],array['Frank Darabont'],array['Tim Robbins','Morgan Freeman'],'Two prisoners form a deep friendship over decades behind bars.');
select public._seed_movie(38,'Pulp Fiction',1994,154,8.5,90,'en',array['Crime','Thriller'],array['Quentin Tarantino'],array['John Travolta','Uma Thurman','Samuel L. Jackson'],'Interlocking stories of crime in Los Angeles.');
select public._seed_movie(39,'Mad Max: Fury Road',2015,120,7.6,87,'en',array['Action','Adventure','Science Fiction'],array['George Miller'],array['Tom Hardy','Charlize Theron'],'In a desert wasteland, a woman rebels against a tyrant.');
select public._seed_movie(40,'Crouching Tiger, Hidden Dragon',2000,120,7.4,72,'zh',array['Action','Drama','Romance'],array['Ang Lee'],array['Chow Yun-fat','Michelle Yeoh'],'Two warriors pursue a stolen legendary sword.','','臥虎藏龍');
select public._seed_movie(41,'Roma',2018,135,7.7,65,'es',array['Drama'],array['Alfonso Cuarón'],array['Yalitza Aparicio'],'A year in the life of a housekeeper in 1970s Mexico City.');
select public._seed_movie(42,'Pan''s Labyrinth',2006,118,7.8,76,'es',array['Fantasy','Drama','War'],array['Guillermo del Toro'],array['Ivana Baquero','Sergi López'],'A girl escapes into a dark fairy-tale world in post-war Spain.','','El laberinto del fauno');
select public._seed_movie(43,'3 Idiots',2009,170,8.0,85,'hi',array['Comedy','Drama'],array['Rajkumar Hirani'],array['Aamir Khan','R. Madhavan','Kareena Kapoor'],'Two friends search for a long-lost college buddy.');
select public._seed_movie(44,'The Intouchables',2011,112,8.3,80,'fr',array['Comedy','Drama'],array['Olivier Nakache'],array['François Cluzet','Omar Sy'],'A wealthy man forms an unlikely friendship with his carer.','','Intouchables');
select public._seed_movie(45,'Home Alone',1990,103,7.4,84,'en',array['Comedy','Family'],array['Chris Columbus'],array['Macaulay Culkin','Joe Pesci'],'A boy left home alone defends his house from burglars.');
select public._seed_movie(46,'Night of the Living Dead',1968,96,7.5,60,'en',array['Horror'],array['George A. Romero'],array['Duane Jones','Judith O''Dea'],'Strangers barricade a farmhouse against the walking dead.');
select public._seed_movie(47,'The General',1926,79,8.0,50,'en',array['Comedy','Action','War'],array['Buster Keaton','Clyde Bruckman'],array['Buster Keaton','Marion Mack'],'A train engineer chases his stolen locomotive across enemy lines.');
select public._seed_movie(48,'Love Actually',2003,135,7.6,78,'en',array['Comedy','Romance'],array['Richard Curtis'],array['Hugh Grant','Emma Thompson','Keira Knightley'],'Interwoven love stories in London in the weeks before Christmas.');

update public.movies set playable_url = null where playable_url = '';
drop function public._seed_movie(int, text, int, int, numeric, numeric, text, text[], text[], text[], text, text, text);
