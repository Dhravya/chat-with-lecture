import { DeepgramError, createClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // gotta use the request object to invalidate the cache every request :vomit:
  const url = request.url;
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY ?? "");

  let { result: projectsResult, error: projectsError } =
    await deepgram.manage.getProjects();

  if (projectsError) {
    return NextResponse.json(projectsError);
  }

  const project = projectsResult?.projects[0];

  if (!project) {
    return NextResponse.json(
      new DeepgramError(
        "Cannot find a Deepgram project. Please create a project first."
      )
    );
  }

  let { result: newKeyResult, error: newKeyError } =
    await deepgram.manage.createProjectKey(project.project_id, {
      comment: "Temporary API key",
      scopes: ["usage:write"],
      tags: ["next.js"],
      time_to_live_in_seconds: 10,
    });

  if (newKeyError) {
    return NextResponse.json(newKeyError);
  }

  return NextResponse.json({ ...newKeyResult, url });
}