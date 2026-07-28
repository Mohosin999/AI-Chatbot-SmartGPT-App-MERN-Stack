import React, {
  useState,
  useImperativeHandle,
  forwardRef,
  useRef,
  useCallback,
} from "react";
import {
  FaPlus,
  FaFilePdf,
  FaXmark,
} from "react-icons/fa6";
import { FaArrowAltCircleUp } from "react-icons/fa";


export interface ChatInputHandle {
  focus: (options?: FocusOptions) => void;
}

interface SelectedFile {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  preview: string;
}

interface ChatInputProps {
  onSend: (
    text: string,
    files?: Omit<SelectedFile, "preview" | "id">[],
  ) => void;
  isStreaming?: boolean;
  onStop?: () => void;
}

const ACCEPTED_TYPES =
  "image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf";
const MAX_FILES = 5;

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  ({ onSend, isStreaming, onStop }, ref) => {
    const [value, setValue] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const token = localStorage.getItem("accessToken") || "";

    const adjustHeight = () => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      adjustHeight();
    };

    const readFile = (file: File): Promise<SelectedFile> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const raw = result.split(",")[1];
          resolve({
            id: crypto.randomUUID(),
            name: file.name,
            mimeType: file.type,
            data: raw,
            preview: result,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    const handleFilePick = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const remaining = MAX_FILES - selectedFiles.length;
        const toAdd = files.slice(0, remaining);
        const read = await Promise.all(toAdd.map(readFile));
        setSelectedFiles((prev) => [...prev, ...read]);

        if (fileInputRef.current) fileInputRef.current.value = "";
        textareaRef.current?.focus();
      },
      [selectedFiles.length],
    );

    const removeFile = (id: string) => {
      setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const sendMessage = () => {
      const text = value.trim();
      if (!text && !selectedFiles.length) return;

      const files = selectedFiles.length
        ? selectedFiles.map((f) => ({
            name: f.name,
            mimeType: f.mimeType,
            data: f.data,
          }))
        : undefined;

      onSend(text, files);

      setValue("");
      setSelectedFiles([]);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };

  useImperativeHandle(ref, () => ({
    focus: (options?: FocusOptions) => textareaRef.current?.focus(options),
  }));

    const canSend =
      (value.trim().length > 0 || selectedFiles.length > 0) && token;

    return (
      <div className="w-full flex flex-col items-center">
        {selectedFiles.length > 0 && (
          <div className="w-full flex flex-wrap gap-1.5 mb-2 px-1">
            {selectedFiles.map((file) => (
              <div
                key={file.id}
                className="relative group/file flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#3a3a3a] px-2 py-1 pr-6 text-xs"
              >
                {file.mimeType === "application/pdf" ? (
                  <FaFilePdf className="text-red-500 shrink-0" size={14} />
                ) : (
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="h-6 w-6 rounded object-cover shrink-0"
                  />
                )}
                <span className="max-w-20 truncate text-gray-700 dark:text-gray-300">
                  {file.name}
                </span>
                <button
                  onClick={() => removeFile(file.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover/file:flex items-center justify-center h-3.5 w-3.5 rounded-full bg-gray-400 hover:bg-gray-500 text-white"
                >
                  <FaXmark size={7} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative w-full rounded-full border border-gray-300 bg-white dark:bg-[#303030] dark:border-[#303030] shadow-md group">
          <div className="flex items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!token || selectedFiles.length >= MAX_FILES}
              className={`shrink-0 flex items-center justify-center h-9 w-9 ml-2 rounded-lg transition-all ${
                !token || selectedFiles.length >= MAX_FILES
                  ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3a] cursor-pointer"
              }`}
              title={
                selectedFiles.length >= MAX_FILES
                  ? `Max ${MAX_FILES} files`
                  : "Attach files"
              }
            >
              <FaPlus size={16} />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              onChange={handleFilePick}
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleInput}
              onInput={adjustHeight}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything"
              rows={1}
              disabled={!token}
              className={`flex-1 resize-none overflow-hidden rounded-xl bg-transparent px-2 py-3 xl:py-4 pr-2 text-gray-800 dark:text-gray-200 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-0 transition-all duration-150 max-h-60 ${
                !token ? "cursor-not-allowed opacity-50 select-none" : ""
              }`}
            />

            <div className="shrink-0 pr-2">
              {isStreaming ? (
                <button
                  onClick={onStop}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-base font-bold text-gray-700 dark:text-gray-200">
                    ■
                  </span>
                </button>
              ) : (
                <FaArrowAltCircleUp
                  onClick={canSend ? sendMessage : undefined}
                  className={`h-7 w-7 active:scale-105 transition-all duration-150 ${
                    canSend
                      ? "cursor-pointer text-gray-900 dark:text-gray-100 hover:text-gray-800 hover:dark:text-gray-300"
                      : "text-gray-300 dark:text-gray-600"
                  }`}
                />
              )}
            </div>
          </div>

          {!token && (
            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full mb-2 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out">
              <div className="rounded-lg bg-gray-800 px-3 py-1 text-sm text-white shadow-lg animate-fade-up">
                You need to login first
              </div>
            </div>
          )}
        </div>

        <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-up {
          animation: fade-up 0.25s ease-out forwards;
        }
      `}</style>
      </div>
    );
  },
);

ChatInput.displayName = "ChatInput";

export default ChatInput;
