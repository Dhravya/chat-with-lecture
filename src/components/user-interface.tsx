'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { AiResponse } from '@/types/aiResponse';
import {
  CreateProjectKeyResponse,
  LiveClient,
  LiveTranscriptionEvents,
  createClient,
} from '@deepgram/sdk';
import { useQueue } from '@uidotdev/usehooks';

type Messages = {
  role: 'User' | 'AI';
  text: string;
}[];

export function UserInterface() {
  const { data: session } = useSession();

  const { add, remove, first, size, queue } = useQueue<any>([]);
  const [apiKey, setApiKey] = useState<CreateProjectKeyResponse | null>();
  const [connection, setConnection] = useState<LiveClient | null>();
  const [isListening, setListening] = useState(false);
  const [isLoadingKey, setLoadingKey] = useState(true);
  const [isLoading, setLoading] = useState(true);
  const [isProcessing, setProcessing] = useState(false);
  const [micOpen, setMicOpen] = useState(false);
  const [microphone, setMicrophone] = useState<MediaRecorder | null>();
  const [userMedia, setUserMedia] = useState<MediaStream | null>();
  const [caption, setCaption] = useState<string>('');
  const [messageList, setMessageList] = useState<Messages>([
    {
      role: 'AI',
      text: 'Hello! You can ask me any question about the ongoing lecture.',
    }
  ]);
  const [userInput, setUserInput] = useState<string>('');
  const [isAIResponseLoading, setAIResponseLoading] = useState<boolean | string>(false);

  const [ytVidLink, setYtVidLink] = useState<string | undefined>();

  const toggleMicrophone = useCallback(async () => {
    if (microphone && userMedia) {
      setUserMedia(null);
      setMicrophone(null);

      microphone.stop();
    } else {
      const userMedia = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const microphone = new MediaRecorder(userMedia);
      microphone.start(500);

      microphone.onstart = () => {
        setMicOpen(true);
      };

      microphone.onstop = () => {
        setMicOpen(false);
      };

      microphone.ondataavailable = (e) => {
        add(e.data);
      };

      setUserMedia(userMedia);
      setMicrophone(microphone);
    }
  }, [add, microphone, userMedia]);

  useEffect(() => {
    if (!apiKey) {
      console.log('getting a new api key');
      fetch('/api/getKey')
        .then((res) => res.json())
        .then((object) => {

          // @ts-ignore
          if (!('key' in object)) throw new Error('No api key returned');

          // @ts-ignore
          setApiKey(object);
          setLoadingKey(false);
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) {
      console.log('connecting to deepgram');
      const deepgram = createClient(apiKey.key);
      const connection = deepgram.listen.live({
        model: 'nova-2',
        interim_results: true,
        smart_format: true,
        diarize: true,
      });

      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('connection established');
        connection.keepAlive();
        setListening(true);
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('connection closed');
        setListening(false);
        setApiKey(null);
        setConnection(null);
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        if (!data.is_final) return;
        const words = data.channel.alternatives[0].words;
        const captionNow = words
          .map((word: any) => word.punctuated_word ?? word.word)
          .join(' ');
        if (captionNow !== '') {
          setCaption((cap) => cap + ' ' + captionNow);
        }
      });

      setConnection(connection);
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    const processQueue = async () => {
      if (size > 0 && !isProcessing) {
        setProcessing(true);

        if (isListening) {
          const blob = first;
          connection?.send(blob);
          remove();
        }

        const waiting = setTimeout(() => {
          clearTimeout(waiting);
          setProcessing(false);
        }, 250);
      }
    };

    processQueue();
  }, [connection, queue, remove, first, size, isProcessing, isListening]);

  return (
    <div
      key="1"
      className="grid grid-cols-1 md:grid-cols-2 w-full h-full min-h-screen gap-8 p-12"
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight flex gap-2">
            <Image
              src='/logo.png'
              alt='Lecture Chat logo'
              width={40}
              height={40}
            />
            Chat with your lecture
          </h1>
          {session ? (
            <>
              <p className="text-gray-500 dark:text-gray-400">
                Live chat with your lecture and get real-time transcription.
              </p>
              <Button disabled={isLoadingKey || isLoading} variant={
                !!userMedia && !!microphone && micOpen
                  ? 'destructive'
                  : 'secondary'} onClick={() => toggleMicrophone()}>
                {
                  (isLoadingKey || isLoading) ? 'Loading...' :
                    !!userMedia && !!microphone && micOpen
                      ? 'Stop transcription'
                      : 'Click to start'}
              </Button>

              OR

              <form onSubmit={e => e.preventDefault()}>
                <Input
                  onChange={(e) => setYtVidLink(e.target.value)}
                  placeholder="Enter YouTube video link"
                />

                <Button
                  disabled={!ytVidLink || !apiKey || isLoading}
                  onClick={async () => {
                    const videoId = ytVidLink?.split('v=')[1];
                    setLoading(true);

                    if (!apiKey) {
                      throw new Error('No api key found');
                    }

                    if (videoId) {
                      setYtVidLink(`https://www.youtube.com/embed/${videoId}`);
                    }
                    else {
                      throw new Error('Invalid YouTube video link');
                    }

                    const reque = await fetch('/api/getFullTranscript?url=' + ytVidLink);
                    if (reque.status !== 200) {
                      console.log(reque);
                    } 
                    const data = await reque.json() as { transcript: string };
                    setCaption(data.transcript)
                    setLoading(false);
                    await fetch('/api/makeEmbedding', {
                      method: 'POST',
                      body: JSON.stringify({
                        transcript: data.transcript,
                      })
                    }).then((res) => res.text()).then((text) => console.log(text))
                      .catch((e) => console.error(e));
                  }}
                >
                  {isLoading? 'Loading...' : 'Load video'}
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-gray-500 dark:text-gray-400">
                Sign in to begin the transcription.
              </p>
              <Button variant="outline" onClick={() => signIn('google')}>
                Sign in
              </Button>
            </>
          )}
        </div>
        <div className="grid gap-1.5 overflow-auto h-[74vh]">
          {ytVidLink && (
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              frameBorder="0"
              height="100%"
              src={ytVidLink}
              title="YouTube video player"
              width="100%"
            />
          )}
          <div className="flex flex-col gap-2">{caption}</div>
        </div>
      </div>
      <div className="rounded border border-gray-200 dark:border-gray-800 p-4 overflow-auto min-w-[1/3]">
        <div className="relative space-y-4 flex justify-between flex-col h-[85vh] overflow-auto">
          <div className='space-y-2'>
            {messageList.map((message, i) => (
              <div
                key={i}
                className={`flex items-start gap-4 ${message.role == 'AI' && 'flex-row-reverse'
                  }`}
              >
                <div className="rounded-full overflow-hidden w-10 h-10">
                  <Image
                    unoptimized
                    alt="User Profile picture"
                    className="rounded-full"
                    height="40"
                    src={
                      message.role === 'User'
                        ? session?.user?.image ?? '/user.svg'
                        : '/ai.svg'
                    }
                    style={{
                      aspectRatio: '40/40',
                      objectFit: 'cover',
                    }}
                    width="40"
                  />
                </div>
                <div className="space-y-2">
                  <div className="bg-gray-100 rounded-lg p-4 text-sm dark:bg-gray-800 dark:text-white">
                    {message.text}
                  </div>
                  <div className={`text-xs text-gray-500 dark:text-gray-400 ${message.role === "AI" && 'flex justify-end'}`}>
                    {message.role == 'User' ? session?.user?.name : 'AI'}
                  </div>
                </div>
              </div>
            ))}
            {isAIResponseLoading && (
              <div
                className={`flex items-start gap-4 flex-row-reverse`}
              >
                <div className="rounded-full overflow-hidden w-10 h-10">
                  <Image
                    unoptimized
                    alt="User Profile picture"
                    className="rounded-full min-w-12 h-12"
                    height="40"
                    src='/ai.svg'
                    style={{
                      aspectRatio: '40/40',
                      objectFit: 'cover',
                    }}
                    width="40"
                  />
                </div>
                <div className="space-y-2">
                  <div className="min-w-60 bg-gray-100 rounded-lg p-4 text-sm dark:bg-gray-800 dark:text-white space-y-4">
                    <div className='w-full bg-gray-500 p-1 rounded-full animate-pulse'></div>
                    <div className='bg-gray-500 p-1 rounded-full animate-pulse'></div>
                  </div>
                  <div className={`text-xs text-gray-400 dark:text-gray-500 flex justify-end`}>
                    {typeof isAIResponseLoading === 'string' && `${isAIResponseLoading}`}
                  </div>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={
            (e) => e.preventDefault()
          } className="sticky bottom-0 flex w-full gap-2 p-1">
            <Input
              onChange={(e) => setUserInput(e.target.value)}
              value={userInput}
              placeholder="Type your message..."
            />
            <Button
              type='submit'
              disabled={isAIResponseLoading !== false || !userInput || !session?.user?.email}
              onClick={async () => {
                setUserInput('');
                setAIResponseLoading(true);

                setMessageList((prev) => [
                  ...prev,
                  {
                    role: 'User',
                    text: userInput,
                  },
                ]);

                setAIResponseLoading('Reading the data...');
                console.log(caption)
                await fetch('/api/makeEmbedding', {
                  method: 'POST',
                  body: JSON.stringify({
                    transcript: caption,
                  })
                }).then((res) => res.text()).then((text) => console.log(text))
                  .catch((e) => console.error(e));

                setAIResponseLoading('Read the data. Thinking...');

                const response = await fetch('/api/search?prompt=' + userInput);
                const data = (await response.json()) as AiResponse;
                setAIResponseLoading(false);
                setMessageList((prev) => [
                  ...prev,
                  {
                    role: 'AI',
                    text: data[0],
                  },
                ]);

              }}
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
