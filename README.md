# ita

# Brick Kiln Hisab - Management System

A complete, mobile-first brick kiln accounting management web application built with React, Vite, Tailwind CSS, and Supabase.

## Features

- 🏗️ **6 Accounting Categories**: Labour, Ita Sell, Koila, Kamin, Sordar, Ita Khola
- 👤 **Person Management**: Add, search, and manage persons per category
- 📊 **Dynamic Calculations**: Multi-column calculation sections per person (quantity & money)
- 💰 **Financial Ledger**: Full money tracking with 4 transaction types (Receivable, Received, Payable, Paid)
- 📱 **Mobile-First PWA**: Installable on Android/iOS as a native-like app
- 🔐 **Authentication**: Secure login with Supabase Auth
- 🛡️ **Row Level Security**: Database-level security policies
- 📋 **Audit Logs**: All modifications tracked with timestamps
- ⚙️ **Edit/Delete Controls**: Toggle permissions from Settings
- 📥 **CSV Export**: Export person data to CSV

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, React Router v7, Lucide Icons
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Row Level Security)
- **Deployment**: Vercel

## Vercel Deployment

1. Import this repository into [Vercel](https://vercel.com).
2. Set Environment Variables in Project Settings:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon/public key
3. Deploy! Vercel will build and serve the application automatically.

## Supabase Database Setup

Run `supabase/migrations/001_initial_schema.sql` and then
`supabase/migrations/002_ita_sales_payments.sql` and
`supabase/migrations/003_idempotent_ita_legacy_import.sql` in the Supabase SQL Editor.
The ITA Sell weekly details page needs the `ita_sales` and `ita_payments` tables
from the second migration. The third migration prevents legacy entries from being
imported more than once, including when multiple devices open the same person;
deploying the frontend alone does not apply database migrations.

The frontend is a static Vercel deployment; Supabase is the separate authentication and database service. App code can retry database requests and keep the app shell available offline, but it cannot guarantee uptime for Vercel, Supabase, or the user's network. Check both providers' project status and service limits if cloud data is unavailable.

If a database request fails while signed in, new records are kept in that browser's local storage and automatically retried when connectivity returns. They are not visible on another device until the sync succeeds. Use the same Supabase account on each device; the explicit local-access option is device-local and is not a cloud account.

## Local Development

```bash
npm install
npm run dev
```
