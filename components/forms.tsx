"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Upload, X, Check, AlertCircle } from "lucide-react";
const UploadContext = createContext<(change: number) => void>(() => {});
export async function action(name: string, data: unknown) {
  const response = await fetch(`/api/actions/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "요청을 처리하지 못했습니다.");
  return result as { redirect?: string };
}
function values(form: HTMLFormElement) {
  const data: Record<string, unknown> = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value === "string") data[key] = value;
  });
  for (const key of ["pinned", "allDay"])
    if (form.elements.namedItem(key)) data[key] = data[key] === "on";
  if (typeof data.mediaIds === "string")
    data.mediaIds = JSON.parse(data.mediaIds || "[]");
  if (data.avatarId === "") data.avatarId = null;
  for (const key of ["startDate", "endDate"]) {
    if (typeof data[key] === "string" && data[key])
      data[key] = new Date(
        `${data[key]}${data[key].length === 10 ? "T00:00:00" : ":00"}+09:00`,
      ).toISOString();
  }
  if (data.allDay === true && typeof data.endDate === "string")
    data.endDate = new Date(
      new Date(data.endDate).getTime() + 86400000 - 1,
    ).toISOString();
  return data;
}
export function ActionForm({
  name,
  payload = {},
  children,
  label = "저장하기",
  confirm,
  gate = false,
  danger = false,
  reset = false,
  className = "",
  graduation = false,
  onSaved,
}: {
  name: string;
  payload?: Record<string, unknown>;
  children?: ReactNode;
  label?: string;
  confirm?: string;
  gate?: boolean;
  danger?: boolean;
  reset?: boolean;
  className?: string;
  graduation?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter(),
    formRef = useRef<HTMLFormElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    pendingData = useRef<Record<string, unknown>>({});
  const [pending, setPending] = useState(false),
    [uploads, setUploads] = useState(0),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [deleteReady, setDeleteReady] = useState(false);
  async function send(data: Record<string, unknown>) {
    if (confirm && !window.confirm(confirm)) return;
    setPending(true);
    setError("");
    setSuccess(false);
    try {
      const result = await action(name, data);
      dialog.current?.close();
      if (result.redirect) {
        router.push(result.redirect);
        router.refresh();
      } else {
        setSuccess(true);
        onSaved?.();
        if (reset) formRef.current?.reset();
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploads) return;
    const data = { ...values(event.currentTarget), ...payload };
    pendingData.current = data;
    if (gate) {
      setError("");
      dialog.current?.showModal();
    } else void send(data);
  }
  return (
    <UploadContext.Provider value={(n) => setUploads((v) => v + n)}>
      <form
        ref={formRef}
        className={`action-form ${className}`}
        onSubmit={submit}
        onChange={() => {
          if (graduation && formRef.current) {
            const d = values(formRef.current);
            setDeleteReady(
              !!d.password &&
                d.password === d.confirm &&
                d.phrase === "학교를 졸업하겠습니다",
            );
          }
        }}
      >
        <fieldset disabled={pending}>{children}</fieldset>
        {error && !gate && (
          <p className="form-error" role="alert">
            <AlertCircle size={16} />
            {error}
          </p>
        )}
        {success && (
          <p className="form-success" role="status">
            <Check size={16} />
            저장했습니다.
          </p>
        )}
        <button
          className={`button ${danger ? "danger" : "primary"}`}
          disabled={pending || uploads > 0 || (graduation && !deleteReady)}
          type="submit"
        >
          {(pending || uploads > 0) && (
            <LoaderCircle size={16} className="spin" />
          )}
          {uploads > 0 ? "사진 처리 중…" : pending ? "처리 중…" : label}
        </button>
      </form>
      {gate && (
        <dialog ref={dialog} className="dialog" onCancel={() => setError("")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const pw = new FormData(e.currentTarget).get("gatePassword");
              void send({ ...pendingData.current, gatePassword: pw });
            }}
          >
            <h2>작성 비밀번호</h2>
            <p className="muted">선생님께 전달받은 비밀번호를 입력하세요.</p>
            <Field
              label="비밀번호"
              name="gatePassword"
              type="password"
              required
              autoComplete="off"
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="actions">
              <button
                type="button"
                className="button"
                onClick={() => dialog.current?.close()}
              >
                취소
              </button>
              <button className="button primary" disabled={pending}>
                확인 후 저장
              </button>
            </div>
          </form>
        </dialog>
      )}
    </UploadContext.Provider>
  );
}
export function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function TextArea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea {...props} />
    </label>
  );
}
async function compress(file: File) {
  if (file.size > 25 * 1024 * 1024)
    throw new Error("원본 사진은 25MB 이하로 선택하세요.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPG, PNG, WebP 사진을 선택하세요.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.8),
  );
  if (!blob || blob.size > 3000000)
    throw new Error("사진이 너무 큽니다. 작은 사진으로 다시 시도해 주세요.");
  return blob;
}
export function ImageUpload({
  purpose,
  initial = [],
  max = 10,
  single = false,
}: {
  purpose: "avatar" | "board" | "album" | "profile";
  initial?: string[];
  max?: number;
  single?: boolean;
}) {
  const [ids, setIds] = useState(initial),
    [preview, setPreview] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const change = useContext(UploadContext);
  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true);
    change(1);
    setError("");
    let url: string | undefined;
    try {
      const chosen = Array.from(files);
      if (chosen.length > max - ids.length && !single)
        throw new Error(`최대 ${max}장까지 첨부할 수 있습니다.`);
      for (const file of chosen.slice(0, single ? 1 : max - ids.length)) {
        const blob = await compress(file);
        url = URL.createObjectURL(blob);
        setPreview(url);
        const body = new FormData();
        body.set("file", blob, "photo.webp");
        body.set("purpose", purpose);
        const response = await fetch("/api/upload", { method: "POST", body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setIds((old) => (single ? [result.id] : [...old, result.id]));
        URL.revokeObjectURL(url);
        url = undefined;
        setPreview(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드하지 못했습니다.");
    } finally {
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
      setBusy(false);
      change(-1);
    }
  }
  return (
    <div className="upload">
      <input
        type="hidden"
        name={single ? "avatarId" : "mediaIds"}
        value={single ? ids[0] || "" : JSON.stringify(ids)}
      />
      <span className="field-label">
        {single ? "프로필 사진" : "사진"}{" "}
        <span className="muted">
          {ids.length}/{single ? 1 : max}
        </span>
      </span>
      <div className="upload-previews">
        {ids.map((id) => (
          <div className="upload-preview" key={id}>
            <img src={`/api/media/${id}`} alt="첨부 사진 미리보기" />
            <button
              type="button"
              aria-label="첨부 사진 제거"
              onClick={() => setIds(ids.filter((x) => x !== id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
        {preview && (
          <div className="upload-preview processing">
            <img src={preview} alt="업로드 중인 사진" />
          </div>
        )}
      </div>
      <label className="upload-button">
        <Upload size={20} />
        <strong>{busy ? "사진을 최적화하고 있어요" : "사진 선택"}</strong>
        <span>JPG · PNG · WebP / 자동 용량 최적화</span>
        <input
          aria-label="사진 파일 선택"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={!single}
          disabled={busy || (!single && ids.length >= max)}
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function ThemeControl({ initial }: { initial: "light" | "dark" }) {
  const router = useRouter(),
    [theme, setTheme] = useState(initial),
    [error, setError] = useState("");
  async function change(value: "light" | "dark") {
    try {
      await action("theme", { theme: value });
      setTheme(value);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div>
      <div className="theme-options">
        {(["light", "dark"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={theme === v}
            className={`theme-choice ${theme === v ? "selected" : ""}`}
            onClick={() => void change(v)}
          >
            <span className={`theme-sample ${v}`} />
            {v === "light" ? "라이트" : "다크"}
            {theme === v && <Check size={16} />}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
