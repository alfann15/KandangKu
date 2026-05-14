import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: number;
      nama: string;
      role: string;
      username: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true, // Untuk bypass cek host saat development dengan domain custom
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: String(user.id),
          username: user.username,
          nama: user.nama,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = parseInt(user.id as string, 10);
        token.nama = (user as any).nama;
        token.role = (user as any).role;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = (token.id as number) || 0;
      (session.user as any).nama = (token.nama as string) || '';
      (session.user as any).role = (token.role as string) || '';
      (session.user as any).username = (token.username as string) || '';
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});
