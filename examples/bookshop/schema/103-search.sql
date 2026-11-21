-- Search for a part of a book title. Trigram indexes are a PostgreSQL feature.

create extension if not exists pg_trgm;
create index ix_book_title_search on book using gin (title gin_trgm_ops);
