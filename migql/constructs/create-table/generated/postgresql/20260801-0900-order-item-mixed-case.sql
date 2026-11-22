-- 20260801-0900-order-item-mixed-case

-- part: create-table
create table "Order Item" (
    "Id" bigint not null,
    "Line Item" integer not null,
    "Quantity" integer not null default 1,
    "check" varchar(10),
    primary key ("Id"),
    constraint "UQ Order Item" unique ("Line Item")
);
