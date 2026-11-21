-- Indexes that Hibernate does not create.

create index ix_orders_customer on orders (customer_id);
