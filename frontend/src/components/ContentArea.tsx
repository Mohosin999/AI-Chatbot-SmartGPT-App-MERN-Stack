import React, { useRef, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import ChatInput, { type ChatInputHandle } from "./ChatInput";
import { useDispatch } from "react-redux";
import Message from "./Message";
import {
  createChat,
  createMessageStream,
  editMessageStream,
  getChatById,
  addChatToAllChats,
  addTempMessage,
  updateMessageContent,
  updateChatName,
  removeMessagesAfter,
  abortStream,
} from "@/features/chat/chatSlice";
import { useAppSelector } from "@/hooks/useAppStore";
import type { Message as MessageType } from "@/types";
import toast from "react-hot-toast";

const ContentArea = () => {
  const { currentChat, isGenerating, error } = useAppSelector(
    (state) => state.chat,
  );

  useEffect(() => {
    if (error) {
      if (error === "Resource not found" && !currentChat) return;
      toast.error(error, { duration: 5000 });
    }
  }, [error, currentChat]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const dispatch = useDispatch();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const prevChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [currentChat?.data?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollMessagesToBottom = (instant?: boolean) => {
    const container = chatContainerRef.current;
    if (!container) return;
    if (instant) {
      container.scrollTop = container.scrollHeight;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const hasStreamingMessage = currentChat?.data?.messages?.some(
    (msg: MessageType) => msg.isStreaming,
  );
  const accessToken = localStorage.getItem("accessToken");

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const chatId = currentChat?.data?.id ?? null;
    const isNewChat = chatId !== prevChatIdRef.current;
    prevChatIdRef.current = chatId;

    if (isNewChat) {
      scrollMessagesToBottom(true);
      return;
    }

    if (hasStreamingMessage) {
      container.scrollTop = container.scrollHeight;
      return;
    }

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (!isNearBottom) return;

    const images = container.querySelectorAll("img");
    if (images.length === 0) {
      scrollMessagesToBottom(false);
      return;
    }

    let loadedCount = 0;
    images.forEach((img) => {
      if (img.complete) {
        loadedCount++;
      } else {
        img.addEventListener("load", () => {
          loadedCount++;
          if (loadedCount === images.length) scrollMessagesToBottom(false);
        });
        img.addEventListener("error", () => {
          loadedCount++;
          if (loadedCount === images.length) scrollMessagesToBottom(false);
        });
      }
    });

    if (loadedCount === images.length) scrollMessagesToBottom(false);
  }, [currentChat?.data?.messages, hasStreamingMessage]);

  useEffect(() => {
    if (!accessToken) return;
    if (!currentChat || currentChat?.data?.messages.length === 0) {
      chatInputRef.current?.focus({ preventScroll: true });
    }
  }, [accessToken, currentChat, currentChat?.data?.messages, isGenerating]);

  const handleSend = async (
    text: string,
    files?: { name: string; mimeType: string; data: string }[],
  ) => {
    if (!accessToken) return;
    if (!text.trim() && (!files || !files.length)) return;

    const existingChatId = currentChat?.data?.id;
    let currentChatId = existingChatId;

    if (!currentChatId) {
      const res = await dispatch(createChat({}) as any);

      if (res.meta.requestStatus !== "fulfilled") return;

      currentChatId = res.payload.data.id as string;
      dispatch(addChatToAllChats(res.payload.data));

      await dispatch(getChatById(currentChatId) as any);

      if (text.trim()) {
        dispatch(
          updateChatName({ chatId: currentChatId, chatName: text.trim() }),
        );
      }
    }

    const userMsg: Record<string, unknown> = {
      id: Date.now(),
      role: "user",
      content: text,
    };

    if (files && files.length > 0) {
      userMsg.files = files.map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        data: f.data,
      }));
    }

    dispatch(addTempMessage(userMsg));

    dispatch(
      addTempMessage({
        id: "streaming-msg",
        role: "assistant",
        content: "",
        isStreaming: true,
        isTemp: true,
      }),
    );

    dispatch(
      createMessageStream({
        prompt: text.trim(),
        chatId: currentChatId!,
        files,
      }) as any,
    );

    chatInputRef.current?.focus({ preventScroll: true });
  };

  const handleEdit = async (messageId: string | number, newContent: string) => {
    const chatId = currentChat?.data?.id;
    if (!chatId) return;

    dispatch(updateMessageContent({ messageId, content: newContent }));
    dispatch(removeMessagesAfter({ messageId }));

    dispatch(
      addTempMessage({
        id: "streaming-msg",
        role: "assistant",
        content: "",
        isStreaming: true,
        isTemp: true,
      }),
    );

    dispatch(
      editMessageStream({ chatId, messageId, prompt: newContent }) as any,
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#151517] pb-6 pt-16 lg:pt-6 relative">
      {(() => {
        const messages = currentChat?.data?.messages;
        const hasMessages = messages && messages.length > 0;

        if (hasMessages) {
          return (
            <>
              <div
                className="flex-1 overflow-y-auto"
                ref={chatContainerRef}
                style={{ scrollbarGutter: "stable" }}
              >
                <div className="min-h-full flex flex-col relative">
                  <div className="flex-1 custom-padding pb-3">
                    <div className="flex flex-col space-y-4 mt-4 relative">
                      {messages!.map((msg) => (
                        <Message
                          key={msg.id}
                          msg={msg}
                          onEdit={isGenerating ? undefined : handleEdit}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <div className="sticky bottom-0 custom-padding bg-white dark:bg-[#151517] z-10">
                    {showScrollButton && (
                      <button
                        onClick={scrollToBottom}
                        className="absolute -top-12 right-2 md:right-8 lg:right-10 p-2 bg-white dark:bg-[#303030] text-gray-700 dark:text-gray-200 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-[#3a3a3a] border border-gray-300 dark:border-gray-600 transition z-10 cursor-pointer"
                      >
                        <ChevronDown size={20} />
                      </button>
                    )}

                    <ChatInput
                      ref={chatInputRef}
                      onSend={handleSend}
                      isStreaming={hasStreamingMessage}
                      onStop={abortStream}
                    />
                  </div>
                </div>
              </div>
            </>
          );
        }

        {
          /* ----------- Chat input without content message ---------- */
        }
        return (
          <div className="flex-1 flex flex-col items-center justify-center custom-padding">
            <img src="./vite.png" alt="Logo" className="w-30 h-30 mb-4" />
            <h2 className="text-3xl md:text-4xl xl:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-8">
              What's on your <span className="text-[#48A4FF]">mind?</span>
            </h2>

            <ChatInput
              ref={chatInputRef}
              onSend={handleSend}
              isStreaming={false}
              onStop={abortStream}
            />
          </div>
        );
      })()}
    </div>
  );
};

export default React.memo(ContentArea);
