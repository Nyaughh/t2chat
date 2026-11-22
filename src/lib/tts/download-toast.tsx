'use client'

/**
 * Small, non-blocking toasts for the one-time on-device voice download:
 * the first-use prompt, live progress with Cancel, "ready", and errors with
 * Retry. The chat stays usable throughout.
 */
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { AudioLines, Check, TriangleAlert } from 'lucide-react'
import { downloadLocalModel, getLocalModelState, isLocalModelSavedInBrowser, subscribeLocalModel } from './local-model'
import type { DownloadChoice } from './player'
import { DownloadProgress, MODEL_SIZE, useLocalModel } from './local-model-ui'

const PROMPT_ID = 'local-voice-prompt'
const PROGRESS_ID = 'local-voice-download'

function Card({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex w-[min(356px,calc(100vw-32px))] gap-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{title}</p>
        {children}
      </div>
    </div>
  )
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
}

const primary =
  'cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const secondary =
  'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Asks before the one-time model download. Resolves with the user's choice,
 * or 'dismiss' (and closes the prompt) if the reading is cancelled first.
 */
export function askLocalDownload(signal?: AbortSignal) {
  return new Promise<DownloadChoice>((resolve) => {
    let settled = false
    const settle = (choice: DownloadChoice) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      toast.dismiss(PROMPT_ID)
      resolve(choice)
    }
    const onAbort = () => settle('dismiss')
    if (signal?.aborted) return onAbort()
    signal?.addEventListener('abort', onAbort, { once: true })
    toast.custom(
      () => (
        <Card icon={<AudioLines className="size-4" />} title={`Download the on-device voice (${MODEL_SIZE})?`}>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            One time. After that, replies are read aloud right in your browser: free, private, and offline.
          </p>
          <Actions>
            <button type="button" className={primary} onClick={() => settle('download')}>
              Download
            </button>
            <button type="button" className={secondary} onClick={() => settle('browser')}>
              Use system voice
            </button>
          </Actions>
        </Card>
      ),
      {
        id: PROMPT_ID,
        duration: 30_000,
        onDismiss: () => settle('dismiss'),
        onAutoClose: () => settle('dismiss'),
      },
    )
  })
}

function ProgressToast() {
  const model = useLocalModel()
  if (model.state === 'error') {
    return (
      <Card
        icon={<TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />}
        title="Couldn't download the voice"
      >
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{model.message}</p>
        <Actions>
          <button type="button" className={primary} onClick={() => startLocalDownload()}>
            Retry
          </button>
          <button type="button" className={secondary} onClick={() => toast.dismiss(PROGRESS_ID)}>
            Close
          </button>
        </Actions>
      </Card>
    )
  }
  if (model.state === 'downloading') {
    return (
      <Card icon={<AudioLines className="size-4" />} title="Downloading the on-device voice">
        <p className="mt-0.5 text-xs text-muted-foreground">One time. You can keep chatting.</p>
        <DownloadProgress model={model} className="mt-3" />
      </Card>
    )
  }
  return (
    <Card icon={<Check className="size-4 text-emerald-600 dark:text-emerald-400" />} title="On-device voice ready">
      <p className="mt-0.5 text-xs text-muted-foreground">
        {isLocalModelSavedInBrowser()
          ? 'Saved in this browser. No more downloads.'
          : "Ready for this tab. Your browser didn't let us save it, so it downloads again next visit."}
      </p>
    </Card>
  )
}

let watching = false

/** Starts (or joins) the download and shows a toast that follows it to the end. */
export function startLocalDownload() {
  const promise = downloadLocalModel()
  promise.catch(() => {}) // the toast shows the error
  if (!watching) {
    watching = true
    toast.custom(() => <ProgressToast />, { id: PROGRESS_ID, duration: Infinity })
    const unsubscribe = subscribeLocalModel((state) => {
      if (state.state === 'downloading') return
      unsubscribe()
      watching = false
      if (state.state === 'absent')
        toast.dismiss(PROGRESS_ID) // cancelled
      else if (state.state === 'error') toast.custom(() => <ProgressToast />, { id: PROGRESS_ID, duration: 20_000 })
      else toast.custom(() => <ProgressToast />, { id: PROGRESS_ID, duration: 3000 })
    })
  }
  return promise
}

export const isDownloading = () => getLocalModelState().state === 'downloading'
