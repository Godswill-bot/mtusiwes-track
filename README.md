# MTU SIWES Tracking System

A comprehensive Student Industrial Work Experience Scheme (SIWES) management platform for Maryam Abacha American University of Nigeria (MAUTECH).

## 🌐 Live Demo

**Production URL**: [https://mtusiwes-track.vercel.app](https://mtusiwes-track.vercel.app)

## 📋 About

The MTU SIWES Tracking System is a web-based application designed to streamline the management and monitoring of student industrial training placements. It provides dedicated portals for:

- **Students** - Log daily activities, submit reports, track placement progress
- **Supervisors** - Monitor assigned students, review logbooks, provide assessments
- **Administrators** - Manage placements, assign supervisors, oversee the entire SIWES program

## ✨ Features

- 📝 Digital logbook for daily activity logging
- 👥 Supervisor-student assignment and management
- 📊 Progress tracking and reporting
- 🔐 Role-based authentication (Student, Supervisor, Admin)
- 📱 Responsive design for mobile and desktop
- 🔔 Notification system for updates and approvals

## 🛠️ Technologies Used

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Database, Authentication, Storage)
- **Deployment**: Vercel

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/Godswill-bot/mtusiwes-track.git

# Navigate to project directory
cd mtusiwes-track

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`

### Environment Variables

Create a `.env` file in the root directory with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

## 📁 Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Application pages/routes
├── services/       # API and database services
├── hooks/          # Custom React hooks
├── lib/            # Utility functions
└── types/          # TypeScript type definitions
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 📄 License

This project is developed for educational purposes as part of the SIWES program at Maryam Abacha American University of Nigeria.

## 👤 Author

**Godswill Nwafor**
- GitHub: [@Godswill-bot](https://github.com/Godswill-bot)
