# SIMPulse 📊

## International SIM Sales Analytics Dashboard

SIMPulse is a web-based **International SIM Sales Analytics Dashboard**
built to help users monitor and understand SIM sales performance across
destinations.

The dashboard brings key sales metrics, destination performance, revenue
trends, ARPU, market contribution, and strategic opportunity analysis
into one interactive interface.

------------------------------------------------------------------------

## 📌 Project Overview

SIMPulse provides a centralized view of international SIM sales
analytics.

The main dashboard includes:

-   Total Orders
-   Total Revenue
-   Average ARPU
-   Top Destination
-   Destination Performance
-   Revenue Growth Analysis
-   Market Contribution / Market Share
-   ARPU Ranking
-   Opportunity Matrix
-   Revenue vs. Order Volume
-   Sales Observations
-   Destination and period filters
-   CSV export
-   Dashboard refresh
-   User authentication
-   Separate administrator portal

------------------------------------------------------------------------

## ✨ Key Features

### 📈 Executive KPI Dashboard

The dashboard provides four primary performance indicators:

-   **Total Orders**
-   **Total Revenue**
-   **Average ARPU**
-   **Top Destination**

These provide a quick overview of overall sales performance.

### 🌍 Destination Performance

Users can search and analyze individual destinations using a detailed
performance table.

The table includes:

-   Current Orders
-   Current Revenue
-   Previous Orders
-   Previous Revenue
-   Order Growth %
-   Revenue Growth %
-   ARPU
-   Market Share %
-   Opportunity Category

Column sorting is supported for easier analysis.

### 📊 Revenue & Market Analysis

SIMPulse provides visual analysis through interactive charts:

-   Revenue Growth by Destination
-   Market Contribution

### 💰 ARPU Performance

The ARPU section ranks destinations according to their average revenue
per order and helps identify premium or high-value markets.

### 💡 Strategic Opportunity Analysis

The Opportunity Matrix evaluates destinations using revenue and growth
performance.

The dashboard categorizes destinations into:

  Category       Meaning
  -------------- ----------------------------
  **INVEST**     High growth + High revenue
  **MAINTAIN**   Low growth + High revenue
  **EXPLORE**    High growth + Low revenue
  **FIX**        Low growth + Low revenue

### 🔎 Revenue vs. Order Volume

The dashboard compares revenue and order volume to identify high-volume
and high-value markets.

### 📝 Sales Observations

SIMPulse also provides data-driven observations for the selected
reporting period.

### 🔐 Authentication & Access Control

The application includes:

-   User sign-in
-   User registration
-   Forgot-password flow
-   Role-based redirection
-   User dashboard
-   Administrator dashboard
-   Sign-out functionality

Authentication is integrated with **Supabase Auth**.

### 👨‍💼 Admin Portal

Administrators have a dedicated administration interface containing:

-   Administrative Overview
-   User Management
-   System Status
-   Activity & Access Logs
-   Platform Settings
-   User role management
-   System health information
-   Security and RLS status

------------------------------------------------------------------------

## 🛠️ Technology Stack

  Technology     Usage
  -------------- -------------------------------------
  HTML5          Application structure
  CSS3           UI design and styling
  JavaScript     Application logic
  Chart.js       Interactive charts
  Supabase       Authentication and backend services
  REST/RPC API   Analytics data retrieval
  PostgreSQL     Backend database

------------------------------------------------------------------------

## 📁 Project Structure

``` text
SIMPulse/
│
├── css/
│   └── style.css
│
├── js/
│   ├── admin.js
│   ├── api.js
│   ├── auth.js
│   ├── charts.js
│   └── dashboard.js
│
├── admin.html
├── index.html
├── login.html
└── README.md
```

### File Responsibilities

**`login.html`**

Provides the authentication interface for signing in, creating a user
account, and requesting password resets.

**`index.html`**

Contains the main Sales & Analytics Dashboard.

**`admin.html`**

Contains the administrator portal for platform management.

**`css/style.css`**

Contains the application's visual design, layout, components, tables,
cards, forms, and responsive styling.

**`js/auth.js`**

Handles authentication-related functionality used by the login and
protected dashboard pages.

**`js/api.js`**

Handles analytics API configuration and communication with the backend.

**`js/charts.js`**

Contains the chart rendering functionality using Chart.js.

**`js/dashboard.js`**

Controls the main analytics dashboard, including data loading, filters,
tables, KPIs, and dashboard interactions.

**`js/admin.js`**

Controls administrator dashboard functionality including user
management, logs, system status, and settings.

------------------------------------------------------------------------

## 🔄 Application Flow

``` text
                    ┌──────────────────┐
                    │    Login Page    │
                    │    login.html    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Supabase Auth    │
                    │    auth.js        │
                    └────────┬─────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
             USER ROLE               ADMIN ROLE
                 │                       │
                 ▼                       ▼
        ┌────────────────┐      ┌────────────────┐
        │ Sales Dashboard│      │ Admin Dashboard│
        │   index.html   │      │  admin.html    │
        └───────┬────────┘      └────────────────┘
                │
                ▼
        ┌────────────────┐
        │   api.js       │
        │ Analytics API  │
        └───────┬────────┘
                │
                ▼
        ┌────────────────┐
        │ Supabase / DB  │
        └────────────────┘
```

------------------------------------------------------------------------

## 📊 Analytics Architecture

The main dashboard consumes destination-level analytics data containing
metrics such as:

``` text
destination
current_orders
current_revenue
prev_orders
prev_revenue
order_growth_pct
revenue_growth_pct
arpu
market_share_pct
opportunity_category
revenue_order_relation
```

This data is used to populate the KPI cards, performance table, charts,
and strategic analysis sections.

------------------------------------------------------------------------

## 🔐 Security

SIMPulse uses Supabase authentication and role-based access control.

The application includes:

-   Authenticated user sessions
-   Role-based dashboard redirection
-   Admin route protection
-   Password reset functionality
-   Supabase Auth integration
-   Database Row Level Security (RLS)

### Important

Do **not** commit private credentials, passwords, service-role keys, or
other secrets to GitHub.

If the project contains environment variables or private credentials,
add them to `.gitignore`.

Example:

``` gitignore
.env
.env.*
node_modules/
.vscode/
```

Only public/client-safe configuration should be exposed in frontend
code.

------------------------------------------------------------------------

## 🚀 Getting Started

### 1. Clone the repository

``` bash
git clone https://github.com/YOUR_USERNAME/SIMPulse.git
```

### 2. Open the project

``` bash
cd SIMPulse
```

Open the folder in VS Code.

### 3. Configure Supabase

Configure the Supabase project and required backend/API settings used by
SIMPulse.

Make sure sensitive credentials are kept outside the public repository.

### 4. Run the application

The project can be opened using a local development server such as VS
Code Live Server.

Open:

``` text
login.html
```

The application will then direct authenticated users to the appropriate
dashboard based on their role.

------------------------------------------------------------------------

## 🖥️ Application Pages

### Login Page

Provides:

-   Sign In
-   Create User Account
-   Forgot Password
-   Password visibility toggle
-   Authentication feedback

### Sales & Analytics Dashboard

Provides:

-   KPI cards
-   Destination filters
-   Period filters
-   Destination performance table
-   Revenue growth chart
-   Market contribution chart
-   ARPU ranking
-   Opportunity Matrix
-   Revenue vs. Order Volume
-   Sales observations
-   CSV export

### Admin Dashboard

Provides:

-   Administrative overview
-   User management
-   System status
-   Activity and access logs
-   Platform settings
-   Role management
-   Security status

------------------------------------------------------------------------

## 🎯 Project Objectives

SIMPulse was designed to:

1.  Centralize international SIM sales analytics.
2.  Make important sales KPIs easy to understand.
3.  Compare destination performance.
4.  Identify revenue and growth opportunities.
5.  Visualize complex sales data through interactive charts.
6.  Provide separate user and administrator access.
7.  Reduce the effort required for manual sales analysis.

------------------------------------------------------------------------

## 🔮 Future Improvements

Possible future improvements include:

-   Advanced forecasting
-   Automated PDF reports
-   Scheduled reporting
-   Advanced role-based permissions
-   Improved audit logging
-   More detailed customer analytics
-   Mobile optimization
-   Advanced data export options
-   Automated alerts for unusual sales trends
-   Additional business intelligence metrics

------------------------------------------------------------------------

## 📸 Screenshots

Add screenshots of the application here when the final UI screenshots
are ready.

Example:

``` markdown
![SIMPulse Dashboard](screenshots/dashboard.png)
```

Recommended screenshots:

-   Login page
-   Main analytics dashboard
-   Destination performance table
-   Opportunity Matrix
-   Revenue Growth chart
-   Admin dashboard

------------------------------------------------------------------------

## 📌 Project Status

**Status:** 🚧 Active Development

SIMPulse is an actively developed sales analytics dashboard with
authentication, analytics visualization, and administration features.

------------------------------------------------------------------------

## 👨‍💻 Author

**Om Jee**

GitHub: `https://github.com/YOUR_USERNAME`

------------------------------------------------------------------------

## 📄 License

This project is currently intended for educational, demonstration, and
portfolio purposes.

A formal open-source license can be added if the project is released for
public contribution.
