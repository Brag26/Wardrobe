// server/src/controllers/chat.controller.ts
// Powers the "chat screen" — free-text conversation with the AI stylist,
// with inline outfit suggestion cards and quick-reply buttons.

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { saveChatMessage, getChatHistory, clearChatHistory, listWardrobeItems } from '../services/mongodb.service';
import { generateChatReply, pickOutfitItems, wantsOutfitSuggestion } from '../services/aiStylist.service';
import { ChatMessage } from '../types/domain';

// GET /api/chat/history
export async function getHistory(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const history = await getChatHistory(userId);
  res.json(history);
}

// DELETE /api/chat/history — the chat screen's "delete conversation" button
export async function deleteHistory(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  await clearChatHistory(userId);
  res.json({ ok: true });
}

// POST /api/chat/message   body: { text: string }
export async function sendMessage(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { text, imageDataUri } = req.body as { text: string; imageDataUri?: string };
  // A photo with no caption is a valid message — only reject if there's
  // truly nothing (no text AND no photo).
  if (!text?.trim() && !imageDataUri) return res.status(400).json({ error: 'text is required' });

  const userMessage: ChatMessage = {
    id: randomUUID(), userId, role: 'user', text: text ?? '',
    suggestedOutfitIds: null, referencedItemIds: null, quickReplies: null, createdAt: Date.now(),
  };
  await saveChatMessage(userMessage);

  const closet = await listWardrobeItems(userId);
  const { text: replyText, quickReplies, referencedItemIds } = await generateChatReply(text ?? '', closet, imageDataUri ?? null);

  // If the message reads like a request for an outfit, attach suggested items.
  const wantsOutfit = wantsOutfitSuggestion(text ?? '');
  const suggestedItems = wantsOutfit ? pickOutfitItems(closet, null, null) : [];

  const assistantMessage: ChatMessage = {
    id: randomUUID(), userId, role: 'assistant', text: replyText,
    suggestedOutfitIds: suggestedItems.length > 0 ? suggestedItems.map((i) => i.id) : null,
    referencedItemIds: referencedItemIds.length > 0 ? referencedItemIds : null,
    quickReplies, createdAt: Date.now(),
  };
  await saveChatMessage(assistantMessage);

  res.status(201).json({ userMessage, assistantMessage });
}
