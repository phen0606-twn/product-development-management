select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and (
    table_name ilike '%progress%'
    or table_name ilike '%timeline%'
    or table_name ilike '%stage%'
    or column_name ilike '%progress%'
    or column_name ilike '%stage%'
    or column_name ilike '%content%'
    or column_name ilike '%completed%'
  )
order by table_name, ordinal_position;

select 'development_progress' as table_name, count(*) as row_count
from development_progress;
