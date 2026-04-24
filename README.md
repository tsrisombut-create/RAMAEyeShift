# RAMAEyeShift

A premium, web-based Ophthalmology Resident Scheduling and OR Management System. Originally conceived as a SwiftUI application, this platform has been transformed into a high-performance web experience designed for clinical staff at Ramathibodi Hospital.

## Features

- **Resident Scheduling**: Automated and manual shift management for R1, R2, and R3 residents.
- **OR Management**: High-density board for tracking surgical operations and staff assignments.
- **Holiday Integration**: Intelligent handling of public holidays and custom staff leave.
- **Data Sync**: Real-time integration with Google Sheets for robust backend persistence.
- **Smart Exports**: Generate schedule strings for LINE or export comprehensive data via CSV.
- **Premium UI**: Modern glassmorphic design system using *Plus Jakarta Sans* typography.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Vanilla CSS (Custom Design System)
- **Deployment**: GitHub Pages (Automated via Actions)

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your Google Sheets API credentials (see `.env.example`).

### Development
```bash
npm run dev
```

## PWA Support
RAMAEyeShift is built as a Progressive Web App. You can add it to your Home Screen on iOS or Android for a native-like app experience.

## Support

For any issues or questions, please contact:
- **Thansit Srisombut**
- Email: [tsrisombut@gmail.com](mailto:tsrisombut@gmail.com)

---
*Built for the Department of Ophthalmology, Ramathibodi Hospital.*
