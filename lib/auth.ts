import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Admin email whitelist - only these emails can access the OS
const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];

// Validate OAuth credentials at startup
const googleClientId = process.env.NEXTAUTH_GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.NEXTAUTH_GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  console.error('[NextAuth] Missing Google OAuth credentials:', {
    hasClientId: !!googleClientId,
    hasClientSecret: !!googleClientSecret,
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId || "",
      clientSecret: googleClientSecret || "",
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      // Only allow sign-in if email is in the admin whitelist
      if (user.email && ADMIN_EMAILS.includes(user.email)) {
        return true;
      }
      // Reject sign-in for non-admin users
      return false;
    },

    async session({ session, token }) {
      // Add user info to session
      if (session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },

    async jwt({ token, user }) {
      // Add user info to JWT token
      if (user) {
        token.email = user.email;
      }
      return token;
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
};
