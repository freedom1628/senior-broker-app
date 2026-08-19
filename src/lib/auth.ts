import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "mock-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-google-client-secret",
    }),
    CredentialsProvider({
      id: "demo-user",
      name: "Demo Account",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "trader@broker.com" },
      },
      async authorize(credentials) {
        const email = credentials?.email || "trader@broker.com";
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: "Senior Trader",
              accountSize: 10000.0,
              riskPerTrade: 1.0,
            },
          });
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        let dbUser = await prisma.user.findUnique({
          where: { email: session.user.email || "" },
        });
        if (!dbUser && session.user.email) {
          dbUser = await prisma.user.create({
            data: {
              email: session.user.email,
              name: session.user.name || "Senior Trader",
              image: session.user.image,
              accountSize: 10000.0,
              riskPerTrade: 1.0,
            },
          });
        }
        if (dbUser) {
          (session.user as any).id = dbUser.id;
          (session.user as any).accountSize = dbUser.accountSize;
          (session.user as any).riskPerTrade = dbUser.riskPerTrade;
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "senior-broker-super-secret-key-swing-trading-app",
};
