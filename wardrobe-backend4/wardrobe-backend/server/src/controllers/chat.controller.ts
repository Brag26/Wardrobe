// server/src/controllers/chat.controller.ts
// Powers the "chat screen" — free-text conversation with the AI stylist,
// with inline outfit suggestion cards and quick-reply buttons.

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { saveChatMessage, getChatHistory, clearChatHistory, listWardrobeItems } from '../services/mongodb.service';
import { generateChatReply, pickOutfitItems, wantsOutfitSuggestion } from '../services/aiStylist.service';
import { getPublicUrl } from '../services/s3.service';
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

// POST /api/chat/message   body: { text: string, s3Key?: string }
// s3Key: an image the person just attached (uploaded beforehand via the
// same presigned-URL flow as everything else — POST /wardrobe/upload-url,
// then PUT the photo, then send the resulting key here). Previously this
// endpoint only ever accepted text, so an attached photo never actually
// reached the AI — the app just appended "[+ photo attached]" as a string
// and the model replied to that literal text, not the image. Now, when a
// photo comes with the message, it's actually sent to a vision-capable
// model (same two-tier AI_VISION_PROVIDER chain used by color analysis /
// tag scanning) so Ara genuinely sees it.
export async function sendMessage(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { text, s3Key } = req.body as { text: string; s3Key?: string };
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  const imageUrl = s3Key ? getPublicUrl(s3Key) : undefined;

  const userMessage: ChatMessage = {
    id: randomUUID(), userId, role: 'user', text, imageUrl: imageUrl ?? null,
    suggestedOutfitIds: null, referencedItemIds: null, quickReplies: null, createdAt: Date.now(),
  };
  await saveChatMessage(userMessage);

  const closet = await listWardrobeItems(userId);
  const { text: replyText, quickReplies, referencedItemIds } = await generateChatReply(text, closet, imageUrl);

  // If the message reads like a request for an outfit, attach suggested items.
  const wantsOutfit = wantsOutfitSuggestion(text);
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
