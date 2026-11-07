-- Public schema only; no application records.
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
CREATE TABLE public.t_meter (
    id integer NOT NULL,
    name text NOT NULL,
    meter_type_id integer
);
CREATE SEQUENCE public.t_meter_id_seq
AS integer
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;
ALTER SEQUENCE public.t_meter_id_seq OWNED BY public.t_meter.id;
CREATE TABLE public.t_meter_type (
    id integer NOT NULL,
    name text NOT NULL,
    unit_id integer
);
CREATE SEQUENCE public.t_meter_type_id_seq
AS integer
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;
ALTER SEQUENCE public.t_meter_type_id_seq OWNED BY public.t_meter_type.id;
CREATE TABLE public.t_note (
    id integer NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    text text NOT NULL
);
CREATE SEQUENCE public.t_note_id_seq
AS integer
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;
ALTER SEQUENCE public.t_note_id_seq OWNED BY public.t_note.id;
CREATE TABLE public.t_unit (
    suffix text NOT NULL,
    id integer NOT NULL,
    name text NOT NULL
);
CREATE SEQUENCE public.t_unit_id_seq
AS integer
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;
ALTER SEQUENCE public.t_unit_id_seq OWNED BY public.t_unit.id;
CREATE TABLE public.t_value (
    id integer NOT NULL,
    value double precision NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    meter_id integer
);
CREATE SEQUENCE public.t_value_id_seq
AS integer
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;
ALTER SEQUENCE public.t_value_id_seq OWNED BY public.t_value.id;
ALTER TABLE ONLY public.t_meter ALTER COLUMN id SET DEFAULT nextval(
    'public.t_meter_id_seq'::regclass
);
ALTER TABLE ONLY public.t_meter_type ALTER COLUMN id SET DEFAULT nextval(
    'public.t_meter_type_id_seq'::regclass
);
ALTER TABLE ONLY public.t_note ALTER COLUMN id SET DEFAULT nextval(
    'public.t_note_id_seq'::regclass
);
ALTER TABLE ONLY public.t_unit ALTER COLUMN id SET DEFAULT nextval(
    'public.t_unit_id_seq'::regclass
);
ALTER TABLE ONLY public.t_value ALTER COLUMN id SET DEFAULT nextval(
    'public.t_value_id_seq'::regclass
);
ALTER TABLE ONLY public.t_meter
ADD CONSTRAINT t_meter_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.t_meter_type
ADD CONSTRAINT t_meter_type_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.t_note
ADD CONSTRAINT t_note_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.t_unit
ADD CONSTRAINT t_unit_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.t_value
ADD CONSTRAINT t_value_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.t_meter
ADD CONSTRAINT fk_t_meter_meter_type_id FOREIGN KEY (
    meter_type_id
) REFERENCES public.t_meter_type (id) ON UPDATE SET NULL ON DELETE CASCADE;
ALTER TABLE ONLY public.t_meter_type
ADD CONSTRAINT fk_t_meter_type_unit_id FOREIGN KEY (
    unit_id
) REFERENCES public.t_unit (id) ON UPDATE SET NULL ON DELETE CASCADE;
ALTER TABLE ONLY public.t_value
ADD CONSTRAINT fk_t_value_meter_id FOREIGN KEY (
    meter_id
) REFERENCES public.t_meter (id) ON UPDATE SET NULL ON DELETE CASCADE;
