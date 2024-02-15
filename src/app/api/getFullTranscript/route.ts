import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {

    const user = await auth()

    if (!user) {
        return NextResponse.redirect("/api/auth/login");
    }

    const url = request.url.split("?")[1].split("=")[1] + "?v=" + request.url.split("?")[2].split("=")[1]
    console.log(url)

    const transcript = await fetch(`https://nobullshit.ing/api/analyze?url=${url}&token=pseudoscience&transcriptOnly=true`)

    const transcriptJson = await transcript.json()
    return NextResponse.json(transcriptJson);
}