import { kv } from "@vercel/kv";
import { Ratelimit } from "@upstash/ratelimit";
import { env } from "@/env";
import { FileSource, createClient } from '@deepgram/sdk'
import { auth } from "@/lib/auth";

export const runtime = "edge";
const deepgram = createClient(env.DEEPGRAM_API_KEY)

export async function POST(req: Request): Promise<Response> {

    const user = await auth();

    if (!user?.user?.email) {
      return new Response("Saved locally | Login for Cloud Sync", {
        status: 401,
      });
    }

    if (
        env.KV_REST_API_URL &&
        env.KV_REST_API_TOKEN
    ) {
        const ip = req.headers.get("x-forwarded-for");
        const ratelimit = new Ratelimit({
            redis: kv,
            limiter: Ratelimit.slidingWindow(2, "1 m"),
        });

        const { success, limit, reset, remaining } = await ratelimit.limit(
            `notty_ratelimit_${ip}`,
        );

        if (!success) {
            return new Response("You have reached your request limit for the minute.", {
                status: 429,
                headers: {
                    "X-RateLimit-Limit": limit.toString(),
                    "X-RateLimit-Remaining": remaining.toString(),
                    "X-RateLimit-Reset": reset.toString(),
                },
            });
        }
    }

    const formData = await req.formData();
    const audio = formData.get("audio") as Blob;

    const audioBytes = await audio.arrayBuffer();

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(audioBytes as FileSource)

    if (error) {
        console.log(error)
        return new Response("An error occurred while transcribing the audio.", {
            status: 500,
        });
    }
    const transcript = result.results.channels[0]?.alternatives[0]?.transcript

    try {
        const saveEmbedding = await fetch(`${env.BACKEND_BASE_URL}/api/v1/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `${env.AUTH_SECRET}`
          },
          body: JSON.stringify({
            source: formData.get('currentTranscript') + " " + transcript,
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
