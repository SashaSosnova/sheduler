import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  openFrontCamera,
  pickRecorderMimeType,
  stopMediaStream,
} from './exerciseVideo'

export type ControlCameraHandle = {
  /** Stop recording and return the blob (null if nothing useful was captured). */
  stopAndGetBlob: () => Promise<Blob | null>
  /** True while MediaRecorder is actively capturing. */
  isRecording: () => boolean
}

type Props = {
  active: boolean
  onError?: (message: string) => void
}

type CamStatus = 'idle' | 'starting' | 'preview' | 'recording' | 'error'

function friendlyCameraError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? '')
  const name = err instanceof DOMException ? err.name : ''
  if (
    name === 'NotAllowedError' ||
    /NotAllowed|Permission|denied/i.test(message)
  ) {
    return 'Разреши доступ к камере (иконка 🔒 в адресной строке) и нажми снова'
  }
  if (
    name === 'NotReadableError' ||
    name === 'TrackStartError' ||
    /Could not start video source|NotReadable|in use/i.test(message)
  ) {
    return 'Камера занята другим приложением. Закрой Zoom/Teams и нажми снова'
  }
  if (name === 'NotFoundError' || /NotFound|no device/i.test(message)) {
    return 'Камера не найдена на этом устройстве'
  }
  if (/Timeout|не ответила/i.test(message)) {
    return 'Камера не ответила. Разреши доступ в адресной строке и нажми снова'
  }
  return message || 'Не удалось открыть камеру'
}

export const ControlCamera = forwardRef<ControlCameraHandle, Props>(
  function ControlCamera({ active, onError }, ref) {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const mimeRef = useRef('')
    const intentionalStopRef = useRef(false)
    const runIdRef = useRef(0)
    const onErrorRef = useRef(onError)
    onErrorRef.current = onError

    const [status, setStatus] = useState<CamStatus>('idle')
    const [errorText, setErrorText] = useState<string | null>(null)
    /** 0 = wait for user tap; bump to open camera / retry */
    const [bootToken, setBootToken] = useState(0)

    useImperativeHandle(ref, () => ({
      isRecording: () => recorderRef.current?.state === 'recording',
      stopAndGetBlob: () =>
        new Promise<Blob | null>((resolve) => {
          intentionalStopRef.current = true
          const recorder = recorderRef.current
          if (!recorder || recorder.state === 'inactive') {
            stopMediaStream(streamRef.current)
            streamRef.current = null
            resolve(null)
            return
          }

          recorder.onstop = () => {
            const mime = mimeRef.current || 'video/webm'
            const blob =
              chunksRef.current.length > 0
                ? new Blob(chunksRef.current, { type: mime })
                : null
            chunksRef.current = []
            recorderRef.current = null
            stopMediaStream(streamRef.current)
            streamRef.current = null
            resolve(blob && blob.size > 0 ? blob : null)
          }

          try {
            recorder.stop()
          } catch {
            stopMediaStream(streamRef.current)
            streamRef.current = null
            resolve(null)
          }
        }),
    }))

    useEffect(() => {
      if (!active || bootToken === 0) return

      const runId = ++runIdRef.current
      intentionalStopRef.current = false
      setStatus('starting')
      setErrorText(null)

      let cancelled = false

      function fail(message: string) {
        if (cancelled || runId !== runIdRef.current) return
        setErrorText(message)
        setStatus('error')
        onErrorRef.current?.(message)
      }

      async function openPreview() {
        try {
          const stream = await openFrontCamera({ audio: false })
          if (cancelled || runId !== runIdRef.current) {
            stopMediaStream(stream)
            return
          }

          streamRef.current = stream
          const video = videoRef.current
          if (video) {
            video.srcObject = stream
            video.muted = true
            try {
              await video.play()
            } catch {
              /* preview may still show */
            }
          }

          if (typeof MediaRecorder === 'undefined') {
            fail('Запись видео не поддерживается в этом браузере')
            stopMediaStream(stream)
            streamRef.current = null
            return
          }

          if (!cancelled && runId === runIdRef.current) setStatus('preview')
        } catch (err) {
          fail(friendlyCameraError(err))
        }
      }

      void openPreview()

      return () => {
        cancelled = true
        if (intentionalStopRef.current) return
        const recorder = recorderRef.current
        if (recorder && recorder.state !== 'inactive') {
          try {
            recorder.stop()
          } catch {
            /* ignore */
          }
        }
        recorderRef.current = null
        chunksRef.current = []
        stopMediaStream(streamRef.current)
        streamRef.current = null
        const video = videoRef.current
        if (video) video.srcObject = null
      }
    }, [active, bootToken])

    function requestCamera() {
      setBootToken((n) => n + 1)
    }

    function startRecording() {
      const stream = streamRef.current
      if (!stream || status !== 'preview') return
      if (typeof MediaRecorder === 'undefined') {
        setErrorText('Запись видео не поддерживается в этом браузере')
        setStatus('error')
        onErrorRef.current?.('Запись недоступна')
        return
      }

      const mime = pickRecorderMimeType()
      chunksRef.current = []

      let recorder: MediaRecorder
      try {
        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream)
      } catch {
        setErrorText('Не удалось начать запись')
        setStatus('error')
        onErrorRef.current?.('Не удалось начать запись')
        return
      }

      mimeRef.current = recorder.mimeType || mime || 'video/webm'
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      recorder.onerror = () => {
        setErrorText('Ошибка записи')
        setStatus('error')
        onErrorRef.current?.('Ошибка записи')
      }
      recorder.start(1000)
      recorderRef.current = recorder
      setStatus('recording')
    }

    return (
      <div className="ex-control-camera">
        <p className="ex-control-camera-banner">Зафиксируй камеру</p>
        <div className="ex-control-camera-frame">
          <video
            ref={videoRef}
            className="ex-control-camera-video"
            playsInline
            muted
            autoPlay
          />
          {status === 'idle' ? (
            <div className="ex-control-camera-status">
              <p>Сначала включи камеру и поставь телефон</p>
              <button
                type="button"
                className="btn primary ex-control-camera-retry"
                onClick={requestCamera}
              >
                Включить камеру
              </button>
            </div>
          ) : null}
          {status === 'starting' ? (
            <p className="ex-control-camera-status">Включаю камеру…</p>
          ) : null}
          {status === 'error' ? (
            <div className="ex-control-camera-status is-error">
              <p>{errorText ?? 'Камера недоступна'}</p>
              <button
                type="button"
                className="btn primary ex-control-camera-retry"
                onClick={requestCamera}
              >
                Повторить
              </button>
            </div>
          ) : null}
          {status === 'recording' ? (
            <span className="ex-control-camera-rec" aria-label="Идёт запись">
              ● Запись
            </span>
          ) : null}
        </div>
        {status === 'preview' ? (
          <div className="ex-control-camera-actions">
            <p className="ex-control-camera-hint">
              Поставь телефон и встань в кадр — запись ещё не идёт
            </p>
            <button
              type="button"
              className="btn primary wide"
              onClick={startRecording}
            >
              Начать запись
            </button>
          </div>
        ) : null}
        {status === 'recording' ? (
          <p className="ex-control-camera-hint is-rec">
            Идёт запись — можно делать упражнение
          </p>
        ) : null}
      </div>
    )
  },
)
