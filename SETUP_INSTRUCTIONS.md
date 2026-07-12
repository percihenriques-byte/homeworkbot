# Homework Assistant - Setup & Deployment Guide

A full-stack student homework management application built with React, TypeScript, Express, tRPC, and MySQL/TiDB.

## Quick Start

### Prerequisites
- Node.js 22+ and pnpm
- MySQL/TiDB database (or create a new one)
- Manus OAuth credentials (for authentication)

### Installation

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   
   Create a `.env.local` file in the project root with:
   ```
   # Database
   DATABASE_URL=mysql://user:password@host:port/database

   # Manus OAuth
   VITE_APP_ID=your_app_id
   OAUTH_SERVER_URL=https://api.manus.im
   VITE_OAUTH_PORTAL_URL=https://oauth.manus.im

   # JWT
   JWT_SECRET=your_secret_key_here

   # Owner info (auto-filled in Manus)
   OWNER_OPEN_ID=your_open_id
   OWNER_NAME=Your Name

   # Manus APIs (for LLM, storage, notifications)
   BUILT_IN_FORGE_API_URL=https://api.manus.im
   BUILT_IN_FORGE_API_KEY=your_api_key
   VITE_FRONTEND_FORGE_API_KEY=your_frontend_key
   VITE_FRONTEND_FORGE_API_URL=https://api.manus.im

   # Analytics (optional)
   VITE_ANALYTICS_ENDPOINT=your_analytics_endpoint
   VITE_ANALYTICS_WEBSITE_ID=your_website_id
   ```

3. **Run database migrations:**
   ```bash
   pnpm drizzle-kit generate
   pnpm drizzle-kit migrate
   ```

4. **Start the development server:**
   ```bash
   pnpm dev
   ```

   The app will be available at `http://localhost:5173` (frontend) with the backend at `http://localhost:3000/api/trpc`.

## Project Structure

```
homework-assistant/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/            # Page components
│   │   ├── components/       # Reusable UI components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities (tRPC client, etc.)
│   │   ├── contexts/         # React contexts
│   │   ├── App.tsx           # Main app routing
│   │   └── main.tsx          # Entry point
│   ├── index.html
│   └── public/               # Static assets
├── server/                    # Express backend
│   ├── routers.ts            # tRPC procedure definitions
│   ├── db.ts                 # Database query helpers
│   ├── email.ts              # Email service (Gmail SMTP)
│   ├── _core/                # Framework internals
│   └── *.test.ts             # Vitest tests
├── drizzle/                   # Database schema & migrations
│   ├── schema.ts             # Table definitions
│   └── migrations/           # Generated SQL migrations
├── shared/                    # Shared types & constants
├── storage/                   # S3 file storage helpers
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Key Features

### Authentication
- Manus OAuth integration for user login
- Session-based authentication with JWT
- Role-based access control (admin/user)

### Task Management
- Create, edit, delete homework tasks
- Toddle integration for automatic task sync
- Task status tracking (pending, completed)
- Due date management

### AI Features
- AI-powered task completion assistance
- Customizable AI writing style (formal, casual, etc.)
- Chat interface for homework help

### Integrations
- **Gmail SMTP**: Send email notifications about tasks
- **Toddle**: Sync assignments automatically
- **WhatsApp**: Send task reminders via WhatsApp
- **Google Maps**: Location-based features

### Database
- MySQL/TiDB for data persistence
- Drizzle ORM for type-safe queries
- Automatic timestamps (createdAt, updatedAt)

## Development

### Running Tests
```bash
pnpm test
```

### Type Checking
```bash
pnpm check
```

### Building for Production
```bash
pnpm build
```

## API Endpoints

All API endpoints are under `/api/trpc` using tRPC. Key procedures:

- `auth.me` - Get current user
- `auth.logout` - Logout user
- `tasks.list` - Get all tasks
- `tasks.create` - Create new task
- `tasks.update` - Update task
- `tasks.delete` - Delete task
- `integrations.getSettings` - Get user integration settings
- `integrations.updateSettings` - Update integration settings
- `email.sendTest` - Send test email
- `chat.send` - Send chat message to AI

## Database Schema

### Users Table
- `id` - Primary key
- `openId` - Manus OAuth ID
- `email` - User email
- `name` - User name
- `role` - admin or user
- `createdAt`, `updatedAt` - Timestamps

### Tasks Table
- `id` - Primary key
- `userId` - Foreign key to users
- `title` - Task title
- `description` - Task details
- `subject` - Subject/course
- `dueDate` - Due date timestamp
- `status` - pending, completed, or cancelled
- `createdAt`, `updatedAt` - Timestamps

### Integration Settings Table
- `id` - Primary key
- `userId` - Foreign key to users
- `gmailUser` - Gmail address for SMTP
- `gmailAppPassword` - Gmail app password
- `toddleEmail` - Toddle username
- `toddlePassword` - Toddle password
- `toddleProvider` - Toddle provider (Lex Brasil, etc.)
- `whatsappPhoneNumber` - WhatsApp phone number
- `whatsappApiKey` - WhatsApp API key
- `createdAt`, `updatedAt` - Timestamps

### User Preferences Table
- `id` - Primary key
- `userId` - Foreign key to users
- `aiStyle` - AI writing style preference
- `smtpEmail`, `smtpPassword`, `smtpHost`, `smtpPort` - Custom SMTP settings
- `createdAt`, `updatedAt` - Timestamps

## Deployment

### Deploy to Manus (Recommended)

The project is configured for Manus hosting with automatic deployment:

1. Ensure all changes are committed
2. Push to your repository
3. Manus will automatically build and deploy

### Deploy to Other Platforms

For Railway, Render, Vercel, or other platforms:

1. **Build the project:**
   ```bash
   pnpm build
   ```

2. **Set environment variables** in your hosting platform's dashboard

3. **Run the production server:**
   ```bash
   NODE_ENV=production node dist/server.js
   ```

## Troubleshooting

### Gmail SMTP Not Working
- Ensure you're using an [App Password](https://myaccount.google.com/apppasswords), not your regular Gmail password
- Verify the Gmail address is correct in Settings
- Check that 2FA is enabled on your Google account

### Database Connection Issues
- Verify DATABASE_URL is correct
- For TiDB Cloud, ensure SSL is enabled
- Check that your IP is whitelisted in the database firewall

### Toddle Sync Not Working
- Verify Toddle credentials are saved in Settings
- Check that the Toddle provider type matches your school's setup
- Ensure you have assignments in your Toddle account

### Email Sending Fails
- Check that Gmail credentials are saved
- Verify the recipient email is valid
- Check server logs for detailed error messages

## Support & Documentation

- **Manus Docs**: https://docs.manus.im
- **tRPC Docs**: https://trpc.io
- **Drizzle ORM**: https://orm.drizzle.team
- **React Docs**: https://react.dev

## License

This project is proprietary. All rights reserved.

## Contributing

For bug reports or feature requests, please contact the development team.
