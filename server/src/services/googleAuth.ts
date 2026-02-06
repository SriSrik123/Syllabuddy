import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.events',
];

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/auth/google/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Generate the Google sign-in URL
export function getGoogleAuthUrl(state: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

// Generate URL specifically for connecting Google Calendar (user already logged in)
export function getGoogleCalendarConnectUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:5001/api/calendar/google/callback';
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

// Exchange auth code for tokens
export async function getGoogleTokens(code: string, redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const uri = redirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/auth/google/callback';
  const client = new google.auth.OAuth2(clientId, clientSecret, uri);
  const { tokens } = await client.getToken(code);
  return tokens;
}

// Get Google user profile info
export async function getGoogleUserInfo(accessToken: string) {
  const client = getOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

// Insert an event into Google Calendar
export async function insertGoogleCalendarEvent(
  accessToken: string,
  refreshToken: string,
  event: {
    summary: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
  }
) {
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: client });

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: event.endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    },
  });

  return res.data;
}
