-- 20260518-1000-order-status-table

-- part: create-status-table
create table order_status (
    id bigint not null,
    code varchar(20) not null,
    label varchar(50) not null default 'Unknown',
    primary key (id),
    constraint uq_order_status_code unique (code)
);

-- part: create-legacy-table
create table order_status_legacy (
    order_id bigint not null references orders,
    old_status varchar(20)
);
