import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const hasGoogleAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_ID !== "mock-google-client-id");

const providers: any[] = [
  CredentialsProvider({
    id: "credentials",
    name: "Desk Account",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "trader@broker.com" },
      name: { label: "Name", type: "text" },
    },
    async authorize(credentials) {
      const email = credentials?.email ? credentials.email.toLowerCase().trim() : "trader@broker.com";
      const name = credentials?.name || "Senior Trader";

      let user = await prisma.user.findFirst({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name,
            accountSize: 10000.0,
            riskPerTrade: 1.0,
          },
        });
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    },
  }),
];

if (hasGoogleAuth) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        let dbUser = await prisma.user.findFirst({
          where: { email: session.user.email || "trader@broker.com" },
        });
        if (!dbUser && session.user.email) {
          dbUser = await prisma.user.create({
            data: {
              email: session.user.email,
              name: session.user.name || "Senior Trader",
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
