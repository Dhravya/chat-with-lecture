'use client'

import { UserInterface } from "@/components/user-interface";
import { SessionProvider } from "next-auth/react";
export const runtime = "edge"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <SessionProvider>
        <UserInterface />
      </SessionProvider>
    </main>
  );
}
