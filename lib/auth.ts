import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Admin email whitelist - only these emails can access the OS
const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
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
};
