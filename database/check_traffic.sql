SELECT substring(query, 1, 100) AS query_prefix,
       calls, rows,
       total_exec_time::int AS total_ms,
       mean_exec_time::int AS avg_ms
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 30;
