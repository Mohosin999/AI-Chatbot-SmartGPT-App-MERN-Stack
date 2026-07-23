import { ChatObj } from "../types/chat";
import { GetTransformedItemsParams, TransformedItem } from "../types/response";

const getTransformedItems = ({
  items = [],
  selection = [],
  path = "/",
}: GetTransformedItemsParams): TransformedItem[] => {
  if (!Array.isArray(items) || !Array.isArray(selection)) {
    throw new Error("Invalid section");
  }

  if (selection.length === 0) {
    return items.map((item) => ({
      ...item,
      link: `${path}/${item.id}`,
    })) as unknown as TransformedItem[];
  }

  return items.map((item) => {
    const result: Record<string, unknown> = {};
    selection.forEach((key) => {
      result[key] = item[key];
    });
    result.link = `${path}/${item.id}`;
    return result as TransformedItem;
  });
};

const transformedChatObj = (chat: ChatObj) => ({
  id: chat.id,
  userId: chat.userId,
  name: chat.name,
  userName: chat.userName,
  link: chat.link,
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
});

export { getTransformedItems, transformedChatObj };
