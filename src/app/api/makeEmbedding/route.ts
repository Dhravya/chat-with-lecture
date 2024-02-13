import { env } from "@/env";
import { auth } from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: Request): Promise<Response> {

    const user = await auth();

    if (!user?.user?.email) {
      return new Response("Saved locally | Login for Cloud Sync", {
        status: 401,
      });
    }

    const body = await req.json() as { transcript: string };
    const { transcript } = body;

    try {
        const saveEmbedding = await fetch(`${env.BACKEND_BASE_URL}/api/v1/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `${env.AUTH_SECRET}`
          },
          body: JSON.stringify({
            source: transcript,
            user: user.user.email + "-study",
            note_id: '1',
          }),
        });
    
        if (saveEmbedding.status !== 200) {
          console.error("Failed to save embedding");
        }
      } catch (error) {
        console.error("Error occurred while saving embedding: ", error);
      }

    return new Response(transcript);
}
