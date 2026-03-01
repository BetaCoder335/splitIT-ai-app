// src/services/ai.service.ts
import OpenAI from 'openai';
import { query, queryOne } from '../config/database';
import { BillScan, BillItem, ItemAssignment, AIConversationState } from '../../../shared/types';
import { logger } from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o';

// ─── Bill Scanning ────────────────────────────────────────────

export interface BillScanResult {
  items: BillItem[];
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number;
  currency: string;
  raw_text: string;
}

export async function scanBillImage(imageUrl: string): Promise<BillScanResult> {
  logger.info(`Scanning bill image: ${imageUrl}`);

  const systemPrompt = `You are a precise bill/receipt OCR extraction system.
Your job is to extract all items, prices, taxes, tips, and totals from receipt images.
Always respond with valid JSON only. No markdown, no explanations.`;

  const userPrompt = `Extract all information from this receipt image and return JSON with this exact structure:
{
  "items": [
    {
      "id": "item_1",
      "name": "Item name",
      "price": 12.99,
      "quantity": 1
    }
  ],
  "subtotal": 45.97,
  "tax": 4.59,
  "tip": null,
  "total": 50.56,
  "currency": "USD",
  "raw_text": "The raw OCR text from the receipt"
}

Rules:
- Extract ALL line items with their prices
- If quantity is not shown, assume 1
- Include subtotal, tax, tip, and total if shown
- If tip is not shown, set to null
- Infer currency from symbols ($ = USD, £ = GBP, € = EUR, ₹ = INR)
- For total, use the final amount charged
- Generate unique IDs for each item like "item_1", "item_2", etc.`;

  const response = await openai.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from vision model');
  }

  const parsed = JSON.parse(content) as BillScanResult;

  // Validate and clean up
  parsed.items = parsed.items.map((item, idx) => ({
    ...item,
    id: item.id || `item_${idx + 1}`,
    price: parseFloat(item.price.toString()),
    quantity: item.quantity || 1,
    assigned_to: [],
  }));

  parsed.total = parseFloat(parsed.total.toString());
  if (parsed.subtotal) parsed.subtotal = parseFloat(parsed.subtotal.toString());
  if (parsed.tax) parsed.tax = parseFloat(parsed.tax.toString());
  if (parsed.tip) parsed.tip = parseFloat(parsed.tip.toString());

  logger.info(`Bill scan complete: ${parsed.items.length} items, total: ${parsed.total}`);
  return parsed;
}

// ─── Item Assignment AI ───────────────────────────────────────

export interface AssignmentQuestion {
  question: string;
  item_id: string;
  item_name: string;
  price: number;
}

export function generateAssignmentQuestion(
  item: BillItem,
  memberNames: string[]
): AssignmentQuestion {
  const namesFormatted = memberNames.map((n) => `"${n}"`).join(', ');
  return {
    question: `Who had ${item.name} ($${item.price.toFixed(2)})? Options: ${namesFormatted}`,
    item_id: item.id,
    item_name: item.name,
    price: item.price,
  };
}

export async function parseAssignmentResponse(
  response: string,
  availableMembers: Array<{ id: string; name: string }>,
  itemName: string
): Promise<string[]> {
  // Try to parse with AI for fuzzy matching
  const systemPrompt = `You extract user assignments from natural language responses.
Return a JSON array of matched user IDs from the available members list.
If someone says "me" or "I", match to the speaker (first in the list).
If no one is specified, return all member IDs (split equally).`;

  const userPrompt = `The bill item is: "${itemName}"
Available members: ${JSON.stringify(availableMembers.map((m) => ({ id: m.id, name: m.name })))}
User response: "${response}"

Return JSON: { "assigned_to": ["user_id_1", "user_id_2"] }`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return availableMembers.map((m) => m.id);

  const parsed = JSON.parse(content) as { assigned_to: string[] };
  return parsed.assigned_to || availableMembers.map((m) => m.id);
}

// ─── General AI Chat Agent ────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GroupContext {
  group_name: string;
  members: Array<{ id: string; name: string }>;
  your_balance: number;
  total_expenses: number;
  currency: string;
}

export async function processAIMessage(
  userMessage: string,
  conversationHistory: ChatMessage[],
  groupContext: GroupContext,
  state: AIConversationState
): Promise<{
  reply: string;
  newState: AIConversationState;
  action?: {
    type: 'create_expense' | 'mark_settled' | 'none';
    data?: Record<string, unknown>;
  };
}> {
  const systemPrompt = `You are SplitAI, an intelligent expense splitting assistant embedded in a group expense app.
You help people split bills, track expenses, and settle debts fairly.

Current group context:
- Group: ${groupContext.group_name}
- Members: ${groupContext.members.map((m) => m.name).join(', ')}
- Your balance: ${groupContext.your_balance >= 0 ? '+' : ''}$${groupContext.your_balance.toFixed(2)}
- Currency: ${groupContext.currency}

Available commands:
/split-equal - Split last bill equally among all members
/split-custom - Split with custom amounts
/analyze-bill - Analyze an uploaded bill image
/assign-items - Start item-by-item assignment flow
/summary - Show group balance summary

Personality: Be concise, helpful, and friendly. Use emojis sparingly. 
When helping with item assignment, ask one item at a time clearly.
Format currency amounts clearly (e.g., $12.50).
Current conversation state: ${JSON.stringify(state)}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    { role: 'user', content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 500,
    messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
    temperature: 0.7,
  });

  const reply = completion.choices[0]?.message?.content || 'I could not process that request.';
  const newState = { ...state }; // State mutations handled by chat controller

  return { reply, newState };
}

export async function generateSummary(
  groupContext: GroupContext,
  balances: Array<{ from: string; to: string; amount: number }>
): Promise<string> {
  const balanceText = balances.length === 0
    ? 'Everyone is settled up! 🎉'
    : balances.map((b) => `${b.from} owes ${b.to}: $${b.amount.toFixed(2)}`).join('\n');

  const prompt = `Generate a friendly, concise summary for a group expense summary.

Group: ${groupContext.group_name}
Members: ${groupContext.members.map((m) => m.name).join(', ')}
Total expenses: $${groupContext.total_expenses.toFixed(2)}

Outstanding balances:
${balanceText}

Keep it brief (2-3 sentences), friendly, and actionable.`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
  });

  return completion.choices[0]?.message?.content || balanceText;
}

// ─── AI Item Allocation Calculator ───────────────────────────

export function calculateAIAllocatedSplits(
  items: BillItem[],
  assignment: ItemAssignment,
  tax: number | null,
  tip: number | null,
  total: number
): Array<{ user_id: string; amount: number; items: BillItem[] }> {
  const userAmounts = new Map<string, { amount: number; items: BillItem[] }>();

  // Calculate item subtotal
  const itemSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const overhead = total - itemSubtotal; // tax + tip
  const overheadRatio = overhead > 0 ? overhead / itemSubtotal : 0;

  for (const item of items) {
    const assignedUsers = assignment[item.id] || [];
    if (assignedUsers.length === 0) continue;

    const itemTotal = item.price * item.quantity;
    const perPersonBase = itemTotal / assignedUsers.length;
    const perPersonTotal = perPersonBase * (1 + overheadRatio);

    for (const userId of assignedUsers) {
      const existing = userAmounts.get(userId) || { amount: 0, items: [] };
      existing.amount += perPersonTotal;
      existing.items.push({ ...item, assigned_to: assignedUsers });
      userAmounts.set(userId, existing);
    }
  }

  return Array.from(userAmounts.entries()).map(([user_id, data]) => ({
    user_id,
    amount: parseFloat(data.amount.toFixed(2)),
    items: data.items,
  }));
}
