import NextAuth, { DefaultSession } from "next-auth";

type Role = "FOUNDER" | "ADMIN" | "EDITOR" | "VIEWER" | "MODERATOR" | "SUPPORT" | "ANALYST";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    loginAt?: number;
    lastVerified?: number;
    invalid?: boolean;
  }
}
