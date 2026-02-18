-- PostgreSQL Setup Script for Textile Inventory
-- Run this as postgres user: psql -f setup_postgres.sql

-- Create database
CREATE DATABASE textile_inventory;

-- Create user
CREATE USER textile_user WITH PASSWORD 'textile2024secure';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE textile_inventory TO textile_user;

-- Connect to the database
\c textile_inventory

-- Grant schema permissions (PostgreSQL 15+)
GRANT ALL ON SCHEMA public TO textile_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO textile_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO textile_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO textile_user;

-- Set database owner
ALTER DATABASE textile_inventory OWNER TO textile_user;

-- Display success message
\echo 'Database setup complete! User: textile_user, Database: textile_inventory'
