# Community Crisis Response and Skill-Based Volunteer Grid

## Environment Setup

1. **Clone the repository** (or use the provided files).
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Create a `.env` file (based on `.env.example`) and add your keys:
   - `GEMINI_API_KEY`: Your Google AI Studio API Key.
   - `SUPABASE_URL`: Your Supabase Project URL.
   - `SUPABASE_KEY`: Your Supabase Service Role Key.
   - `FCM_SERVER_KEY`: Your Firebase Cloud Messaging Server Key.

## Running the Application

### Backend & Web Dashboard (Local)
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

### Mobile Application (React Native)
The mobile code is located in the `/mobile` directory (simulated in this structure).
To run on Android:
```bash
cd mobile
npm install
npm run android
```

## System Architecture

- **Frontend**: React (Web Dashboard) / React Native (Mobile App)
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL) / SQLite (Local Fallback)
- **AI**: Gemini API for Crisis Classification & Live Voice Assistant
- **Notifications**: Firebase Cloud Messaging (FCM)

## Database Schema (SQL)

```sql
-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('citizen', 'volunteer')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Volunteers Table
CREATE TABLE volunteers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  skills TEXT[], -- Array of skills
  availability BOOLEAN DEFAULT TRUE,
  device_token TEXT,
  rating DECIMAL(3,2) DEFAULT 5.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crisis Reports Table
CREATE TABLE crisis_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  crisis_type TEXT,
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'responding', 'resolved', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Responses Table
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id UUID REFERENCES crisis_reports(id),
  volunteer_id UUID REFERENCES volunteers(id),
  status TEXT DEFAULT 'accepted' CHECK (status IN ('accepted', 'declined', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
