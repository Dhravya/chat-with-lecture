'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { signIn, useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { AiResponse } from "@/types/aiResponse"

type Transcript = {
  text: string
  minute: number
}[]

type Messages = {
  role: 'User' | 'AI'
  text: string
}[]

export function UserInterface() {
  const { data: session } = useSession()

  const [buttonText, setButtonText] = useState<string>('Start');
  const [transcript, setTranscript] = useState<Transcript>([]);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  const [messageList, setMessageList] = useState<Messages>([])
  const [userInput, setUserInput] = useState<string>("")

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalId]);

  async function recordForOneMinute() {
    try {
      // Request permissions and get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let chunks: Blob[] = []; // Array to store the chunks of audio
      const recorder = new MediaRecorder(stream);

      // Collect the chunks of audio data as they come in
      recorder.ondataavailable = (e) => chunks.push(e.data);

      // Start recording
      recorder.start();

      // Stop recording after 1 minute (60000ms)
      setTimeout(() => {
        recorder.stop();
      }, 60000);

      // Once the recorder stops, process and send the audio file
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.wav');
        formData.append('currentTranscript', transcript.map((t) => t.text).join(' '))
        try {
          const response = await fetch('/api/getTranscript', {
            method: 'POST',
            body: formData
          });
          const data = await response.text();
          setTranscript((prevTranscript) => [
            ...prevTranscript,
            { text: data, minute: prevTranscript.length / 2 },
          ]);

        } catch (error) {
          console.error('Error sending audio data:', error);
        }
      };
    } catch (error) {
      console.error('Could not start audio recording:', error);
    }
  }

  const handleButtonClick = () => {
    if (buttonText === 'Start') {
      setButtonText('Stop');
      recordForOneMinute(); // Call recordForOneMinute immediately
      const id = setInterval(recordForOneMinute, 60000);
      setIntervalId(id);
    } else {
      setButtonText('Start');
      if (intervalId) clearInterval(intervalId);
    }
  };

  return (
    <div key="1" className="grid grid-cols-2 w-full h-full min-h-screen gap-8 p-12">
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Chat with your lecture</h1>
          {session ? (
            <>
              <p className="text-gray-500 dark:text-gray-400">Click start to begin the transcription.</p>
              <Button variant="outline" onClick={handleButtonClick}>{buttonText}</Button></>
          ) : (
            <>
              <p className="text-gray-500 dark:text-gray-400">Sign in to begin the transcription.</p>
              <Button variant="outline" onClick={() => signIn('google')}>Sign in</Button></>
          )}
        </div>
        <div className="grid gap-1.5">
          <div className="flex flex-col gap-2">
            {transcript.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.floor(t.minute).toString().padStart(2, '0')}:{((t.minute % 1) * 60).toFixed(0).padStart(2, '0')}
                </div>
                {t.text}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded border border-gray-200 dark:border-gray-800 p-4">
        <div className="space-y-4 flex justify-between flex-col h-full">
          <div>
            {messageList.map((message, i) => (
              <div key={i} className={`flex items-start gap-4 ${message.role == "AI" && "flex-row-reverse"}`}>
                <div className="rounded-full overflow-hidden w-10 h-10">
                  <Image
                    unoptimized
                    alt="User Profile picture"
                    className="rounded-full"
                    height="40"
                    src={message.role === 'User' ? (session?.user?.image ?? '/user.svg') : '/ai.svg'}
                    style={{
                      aspectRatio: "40/40",
                      objectFit: "cover",
                    }}
                    width="40"
                  />
                </div>
                <div className="space-y-2">
                  <div className="bg-gray-100 rounded-lg p-4 text-sm dark:bg-gray-800 dark:text-white">
                    {message.text}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{message.role == "User" ? session?.user?.name : "AI"}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="relative flex w-full gap-2">
            <Input
              onChange={(e) => setUserInput(e.target.value)}
              value={userInput}
              placeholder="Type your message..." />
            <Button
              onClick={async () => {
                setMessageList((prev) => [
                  ...prev,
                  {
                    role: 'User',
                    text: userInput,
                  },
                ]);
                const response = await fetch('/api/search?prompt=' + userInput);
                const data = await response.json() as AiResponse;
                setMessageList((prev) => [
                  ...prev,
                  {
                    role: 'AI',
                    text: data[0],
                  },
                ]);
                setUserInput('');
              }
              }
            >Send</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
