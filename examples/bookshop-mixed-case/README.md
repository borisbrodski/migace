# examples/bookshop-mixed-case

The schema of the bookshop as an application creates it that sends every name in quotes, for example Hibernate with quoting switched on for all names. Tables and columns are in mixed case.

The table `Book` has two columns that differ only in case: `Title` and `title`. PostgreSQL keeps them apart; some other databases do not.

This variant runs through the same proofs as `examples/bookshop/`.
