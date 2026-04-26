# Fourware Systems - Pre-Sale Database

## Architecture Overview

This is a MySQL-based pre-sale system for managing product reservations through marketing campaigns. The system supports multi-branch dealers with role-based access control.

Key components:
- User management with roles and privileges
- Branch accounts (Cuenta) managed by dealers
- Product catalog linked to campaigns
- Reservation system for pre-sales
- Rating and audit logging

## Database Conventions

- **Naming**: Tables and fields in Spanish (e.g., `Usuario`, `correo`, `estatus`)
- **Primary Keys**: `correo` (email) for users, `SKU` for products, auto-increment INT for others
- **Booleans**: Use TINYINT (1/0) for `activo`, `estatus`
- **Money**: DECIMAL(10,2) for prices and totals
- **Relationships**: Junction tables for many-to-many (e.g., `Usuario_Rol`, `Reserva_Producto`)

## Common Patterns

- **Audit Trail**: All user actions logged in `BitacoraAuditoria` with timestamp, action, IP
- **Soft Deletes**: Use `activo` or `estatus` fields instead of hard deletes
- **Campaign-Based Sales**: Products belong to campaigns, reservations calculate totals per campaign

## Workflows

- **Database Setup**: Run `AVANCE3/ppg_preventa.sql` in MySQL to create schema and sample queries
- **Query Examples**: See end of SQL file for common reports (dealer accounts, campaign sales, etc.)

## Key Files

- `AVANCE3/ppg_preventa.sql`: Complete database schema and sample queries
- Advance PDFs in `AVANCE*/` for project documentation