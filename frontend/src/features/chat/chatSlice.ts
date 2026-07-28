import api from "@/api/axiosInstance";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { ChatState, Message } from "@/types";

/** ---------------------------------------------------------------
 * ABORT CONTROLLER MANAGEMENT
 * Manages abort controller for canceling streaming API requests
 * when user navigates away or stops generation.
 ----------------------------------------------------------------*/

let _abortController: AbortController | null = null;

// export const setAbortController = (controller: AbortController | null) => {
//   _abortController = controller;
// };

export const abortStream = () => {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
};

/** ---------------------------------------------------------------
 * INITIAL STATE CONFIGURATION
 ----------------------------------------------------------------*/

const initialState: ChatState = {
  chat: null,
  allChats: null,
  currentChat: null,
  isLoading: false,
  error: null,
  isGenerating: false,
  isDeleting: false,
  isCreating: false,
};

/** ---------------------------------------------------------------
 * ASYNC THUNKS
 ----------------------------------------------------------------*/

export const createChat = createAsyncThunk(
  "chat/createChat",
  async (userData: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken)
        return rejectWithValue("No authentication accessToken found");

      const res = await api.post(
        `${import.meta.env.VITE_BASE_URL}/chats`,
        userData,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      return res.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Create chat failed",
      );
    }
  },
);

export const getAllChats = createAsyncThunk(
  "chat/getAllChats",
  async (_, { rejectWithValue }) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken)
        return rejectWithValue("No authentication accessToken found");

      const res = await api.get(`${import.meta.env.VITE_BASE_URL}/chats`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return res.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Fetch chats failed",
      );
    }
  },
);

export const getChatById = createAsyncThunk(
  "chat/getChatById",
  async (chatId: string, { rejectWithValue }) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken)
        return rejectWithValue("No authentication accessToken found");

      const res = await api.get(
        `${import.meta.env.VITE_BASE_URL}/chats/${chatId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      return res.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Fetch chat failed",
      );
    }
  },
);

export const deleteAllChats = createAsyncThunk(
  "chat/deleteAllChats",
  async (_, { rejectWithValue }) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken)
        return rejectWithValue("No authentication accessToken found");

      await api.delete(`${import.meta.env.VITE_BASE_URL}/chats`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return true;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Delete all chats failed",
      );
    }
  },
);

export const deleteChatById = createAsyncThunk(
  "chat/deleteChatById",
  async (chatId: string, { rejectWithValue }) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken)
        return rejectWithValue("No authentication accessToken found");

      await api.delete(`${import.meta.env.VITE_BASE_URL}/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return chatId;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Delete chat failed",
      );
    }
  },
);

export const renameChatById = createAsyncThunk(
  "chat/renameChatById",
  async ({ chatId, name }: { chatId: string; name: string }, { rejectWithValue }) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken)
        return rejectWithValue("No authentication accessToken found");

      const res = await api.patch(
        `${import.meta.env.VITE_BASE_URL}/chats/${chatId}`,
        { name },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      return { chatId, name, data: res.data };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Rename chat failed",
      );
    }
  },
);

export const createMessageStream = createAsyncThunk(
  "chat/createMessageStream",
  async (
    messageData: { prompt: string; chatId: string; files?: { name: string; mimeType: string; data: string }[] },
    { dispatch, rejectWithValue },
  ) => {
    // Initialize abort controller for stream cancellation
    const controller = new AbortController();
    _abortController = controller;

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        _abortController = null;
        return rejectWithValue("No authentication accessToken found");
      }

      // Establish streaming connection using fetch API with SSE
      const response = await fetch(
        `${import.meta.env.VITE_BASE_URL}/messages/stream`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(messageData),
        },
      );

      // Handle HTTP errors from the stream endpoint
      if (!response.ok) {
        _abortController = null;
        const err = await response.json().catch(() => null);
        return rejectWithValue(
          err?.message || `Stream request failed (${response.status})`,
        );
      }

      // Initialize stream reader for processing chunks
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Process streaming response chunks in a loop
      while (true) {
        const { done, value } = await reader.read();
        if (done) break; // Stream completed

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        // Process each complete SSE line
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = JSON.parse(line.slice(6));

          if (data.error) {
            _abortController = null;
            return rejectWithValue(data.error);
          }

          if (data.done) {
            _abortController = null;
            dispatch(finalizeAssistantMessage(data.message));
            // Update chat name if server provided a new one
            if (data.message?.chatName) {
              dispatch(
                updateChatName({
                  chatId: messageData.chatId,
                  chatName: data.message.chatName,
                }),
              );
            }
            return data.message;
          }

          // Handle content chunk - append to assistant message in real-time
          if (data.chunk) {
            dispatch(appendStreamChunk(data.chunk));
          }
        }
      }

      // Stream ended without proper completion event
      _abortController = null;
      return rejectWithValue("Stream ended without completion event");
    } catch (error: any) {
      _abortController = null;

      if (error.name === "AbortError") {
        dispatch(finalizeAssistantMessage({}));
        return "aborted";
      }

      // Handle other network/stream errors
      return rejectWithValue(error.message || "Stream request failed");
    }
  },
);

export const editMessageStream = createAsyncThunk(
  "chat/editMessageStream",
  async (
    { chatId, messageId, prompt }: { chatId: string; messageId: string | number; prompt: string },
    { dispatch, rejectWithValue },
  ) => {
    const controller = new AbortController();
    _abortController = controller;

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        _abortController = null;
        return rejectWithValue("No authentication accessToken found");
      }

      const response = await fetch(
        `${import.meta.env.VITE_BASE_URL}/messages/stream/edit`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ chatId, messageId, prompt }),
        },
      );

      if (!response.ok) {
        _abortController = null;
        const err = await response.json().catch(() => null);
        return rejectWithValue(
          err?.message || `Stream request failed (${response.status})`,
        );
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = JSON.parse(line.slice(6));

          if (data.error) {
            _abortController = null;
            return rejectWithValue(data.error);
          }

          if (data.done) {
            _abortController = null;
            dispatch(finalizeAssistantMessage(data.message));
            if (data.message?.chatName) {
              dispatch(
                updateChatName({
                  chatId,
                  chatName: data.message.chatName,
                }),
              );
            }
            return data.message;
          }

          if (data.chunk) {
            dispatch(appendStreamChunk(data.chunk));
          }
        }
      }

      _abortController = null;
      return rejectWithValue("Stream ended without completion event");
    } catch (error: any) {
      _abortController = null;

      if (error.name === "AbortError") {
        dispatch(finalizeAssistantMessage({}));
        return "aborted";
      }

      return rejectWithValue(error.message || "Stream request failed");
    }
  },
);

/** ---------------------------------------------------------------
 * CHAT SLICE - REDUX STATE MANAGEMENT
 ----------------------------------------------------------------*/

const chatSlice = createSlice({
  name: "chat",
  initialState,

  // =========================
  // REDUCERS
  // =========================
  reducers: {
    updateChatName: (state, action) => {
      const { chatId, chatName } = action.payload as {
        chatId: string;
        chatName: string;
      };

      if (state.currentChat?.data?.id === chatId) {
        state.currentChat.data.name = chatName;
      }

      const index = state.allChats?.data?.findIndex(
        (chat) => chat.id === chatId,
      );

      if (index !== undefined && index !== -1 && state.allChats?.data) {
        state.allChats.data[index].name = chatName;
      }
    },

    clearCurrentChat: (state) => {
      state.currentChat = null;
      state.chat = null;
      state.error = null;
    },

    addChatToAllChats: (state, action) => {
      state.allChats = state.allChats
        ? { ...state.allChats, data: [action.payload, ...state.allChats.data] }
        : { status: true, message: "", data: [action.payload] };
    },

    addTempMessage: (state, action) => {
      const chatData = state.currentChat?.data;

      // If no messages array exists yet, create one
      if (!chatData?.messages) {
        chatData!.messages = [];
      }
      // Add the new message to the list
      chatData!.messages.push(action.payload);
    },

    updateMessageContent: (state, action) => {
      const { messageId, content } = action.payload as { messageId: string | number; content: string };
      if (!state.currentChat?.data?.messages) return;
      const msg = state.currentChat.data.messages.find(
        (m) => m.id === messageId,
      );
      if (msg) {
        msg.content = content;
      }
    },

    removeMessagesAfter: (state, action) => {
      const { messageId } = action.payload as { messageId: string | number };
      if (!state.currentChat?.data?.messages) return;
      const index = state.currentChat.data.messages.findIndex(
        (m) => m.id === messageId,
      );
      if (index !== -1) {
        state.currentChat.data.messages = state.currentChat.data.messages.slice(0, index + 1);
      }
    },

    // replaceTempMessage: (state, action) => {
    //   if (!state.currentChat?.data?.messages) return;
    //   const index = state.currentChat.data.messages.findIndex(
    //     (msg) => (msg as Message).isTemp === true && msg.role === "assistant",
    //   );
    //   if (index !== -1) {
    //     state.currentChat.data.messages[index] = action.payload;
    //   }
    // },

    appendStreamChunk: (state, action) => {
      if (!state.currentChat?.data?.messages) return;

      // Find the last streaming assistant message
      const lastAssistant = [...state.currentChat.data.messages]
        .reverse()
        .find(
          (msg) =>
            (msg as Message).isStreaming === true && msg.role === "assistant",
        );

      if (lastAssistant) {
        lastAssistant.content += action.payload as string;
      }
    },

    finalizeAssistantMessage: (state, action) => {
      if (!state.currentChat?.data?.messages) return;

      const payload = action.payload as Partial<Message> & { userMessageId?: string };

      const index = state.currentChat.data.messages.findIndex(
        (msg) =>
          (msg as Message).isStreaming === true && msg.role === "assistant",
      );

      if (index !== -1) {
        const existing = state.currentChat.data.messages[index] as Message;
        // Merge existing with final data and clear streaming flags
        state.currentChat.data.messages[index] = {
          ...existing,
          ...payload,
          isStreaming: false,
          isTemp: false,
        };
      }

      // Sync user message ID from backend response
      if (payload?.userMessageId && index > 0) {
        const userMsg = state.currentChat.data.messages[index - 1];
        if (userMsg && userMsg.role === "user") {
          userMsg.id = payload.userMessageId;
        }
      }
    },

    removeStreamingMessage: (state) => {
      if (!state.currentChat?.data?.messages) return;
      state.currentChat.data.messages = state.currentChat.data.messages.filter(
        (msg) => !((msg as Message).isStreaming && msg.role === "assistant"),
      );
    },
  },

  // =========================
  // EXTRA REDUCERS
  // =========================

  extraReducers: (builder) => {
    builder
      // ---------- CREATE CHAT LIFECYCLE ----------
      .addCase(createChat.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createChat.fulfilled, (state, action) => {
        state.isCreating = false;
        state.chat = action.payload;
        state.error = null;
      })
      .addCase(createChat.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      })

      // ---------- GET ALL CHATS LIFECYCLE ----------
      .addCase(getAllChats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAllChats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.allChats = action.payload;
        state.error = null;
        if (!action.payload?.data?.length) {
          state.currentChat = null;
          state.chat = null;
        }
      })
      .addCase(getAllChats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // ---------- GET CHAT BY ID LIFECYCLE ----------
      .addCase(getChatById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getChatById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentChat = action.payload;
        state.error = null;
      })
      .addCase(getChatById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // ---------- DELETE ALL CHATS LIFECYCLE ----------
      .addCase(deleteAllChats.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteAllChats.fulfilled, (state) => {
        state.isDeleting = false;
        state.currentChat = null;
        state.chat = null;
        if (state.allChats?.data) {
          state.allChats.data = [];
        }
        state.error = null;
      })
      .addCase(deleteAllChats.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload as string;
      })

      // ---------- DELETE CHAT BY ID LIFECYCLE ----------
      .addCase(deleteChatById.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteChatById.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.currentChat = null;
        state.chat = null;
        // Remove deleted chat from allChats list
        if (state.allChats?.data) {
          state.allChats.data = state.allChats.data.filter(
            (c) => c.id !== (action.payload as string),
          );
        }
        state.error = null;
      })
      .addCase(deleteChatById.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload as string;
      })

      // ---------- RENAME CHAT LIFECYCLE ----------
      .addCase(renameChatById.fulfilled, (state, action) => {
        const { chatId, name } = action.payload;

        if (state.currentChat?.data?.id === chatId) {
          state.currentChat.data.name = name;
        }

        if (state.allChats?.data) {
          const index = state.allChats.data.findIndex((c) => c.id === chatId);
          if (index !== -1) {
            const [chat] = state.allChats.data.splice(index, 1);
            chat.name = name;
            state.allChats.data.unshift(chat);
          }
        }
      })

      // ---------- COMMENTED OUT: CREATE MESSAGE LIFECYCLE ----------
      // .addCase(createMessage.pending, (state) => {
      //   state.isGenerating = true;
      //   state.error = null;
      // })
      // .addCase(createMessage.fulfilled, (state) => {
      //   state.isGenerating = false;
      //   state.error = null;
      // })
      // .addCase(createMessage.rejected, (state, action) => {
      //   state.isGenerating = false;
      //   state.error = action.payload as string;
      // })

      // ---------- CREATE MESSAGE STREAM LIFECYCLE ----------
      .addCase(createMessageStream.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(createMessageStream.fulfilled, (state) => {
        state.isGenerating = false;
        state.error = null;
      })
      .addCase(createMessageStream.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload as string;
        // Remove stuck streaming messages on error
        if (state.currentChat?.data?.messages) {
          state.currentChat.data.messages = state.currentChat.data.messages.filter(
            (msg) => !((msg as Message).isStreaming && msg.role === "assistant"),
          );
        }
      })

      // ---------- EDIT MESSAGE STREAM LIFECYCLE ----------
      .addCase(editMessageStream.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(editMessageStream.fulfilled, (state) => {
        state.isGenerating = false;
        state.error = null;
      })
      .addCase(editMessageStream.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload as string;
        if (state.currentChat?.data?.messages) {
          state.currentChat.data.messages = state.currentChat.data.messages.filter(
            (msg) => !((msg as Message).isStreaming && msg.role === "assistant"),
          );
        }
      })
      .addMatcher(
        (action) =>
          ["auth/logoutUser/fulfilled", "auth/loginUser/fulfilled", "auth/registerUser/fulfilled", "auth/googleLogin/fulfilled"].includes(action.type),
        () => initialState,
      );
  },
});

// Export all synchronous actions for use in components
export const {
  updateChatName,
  clearCurrentChat,
  addChatToAllChats,
  addTempMessage,
  updateMessageContent,
  removeMessagesAfter,
  // replaceTempMessage,
  appendStreamChunk,
  finalizeAssistantMessage,
  removeStreamingMessage,
} = chatSlice.actions;

// Export the reducer for store configuration
export default chatSlice.reducer;
