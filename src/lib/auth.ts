import { env } from "@/env";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const {
    handlers: { GET, POST },
    auth,
} = NextAuth({
    secret: env.NEXT_AUTH_SECRET,
    providers: [
        Google({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    prompt: "consent",
                    response_type: "code",
                },
            },
        }),
    ],
});
