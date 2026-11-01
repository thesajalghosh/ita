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

## Local Development

```bash
npm install
npm run dev
```
