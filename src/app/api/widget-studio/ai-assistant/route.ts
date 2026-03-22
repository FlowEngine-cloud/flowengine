import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkRateLimit } from '@/lib/validation';
import { getPortalSettings } from '@/lib/portalSettings';

interface AIAssistantRequest {
  prompt: string;
  widgetContext?: {
    type: 'form' | 'chatbot' | 'button';
    selectedElement?: string | null;
    selectedElementLabel?: string | null;
    fields?: Array<any>;
    chatbotConfig?: Record<string, any>;
    buttonConfig?: Record<string, any>;
    styles?: Record<string, any>;
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: AIAssistantRequest = await request.json();
    const { prompt, widgetContext, conversationHistory = [] } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid prompt' }, { status: 400 });
    }

    if (prompt.length > 4000) {
      return NextResponse.json({ error: 'Prompt too long. Maximum 4000 characters allowed.' }, { status: 400 });
    }

    if (conversationHistory.length > 20) {
      return NextResponse.json({ error: 'Too many messages in history. Maximum 20 allowed.' }, { status: 400 });
    }

    if (widgetContext && JSON.stringify(widgetContext).length > 50000) {
      return NextResponse.json({ error: 'Component context too large.' }, { status: 400 });
    }

    // Authenticate user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Rate limit: 30 requests/minute per user
    const rateLimitResult = checkRateLimit(`ai-assistant:${user.id}`, 30, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429 });
    }

    // Get AI config from portal settings (set in Settings → AI Provider)
    const portalSettings = await getPortalSettings().catch(() => null);
    const aiBaseUrl = (portalSettings?.ai_base_url || process.env.AI_BASE_URL || 'https://openrouter.ai/api').replace(/\/+$/, '');
    const aiApiKey = portalSettings?.ai_api_key || process.env.AI_API_KEY || null;

    if (!aiApiKey) {
      return NextResponse.json(
        {
          error: 'AI not configured',
          message: 'Configure an AI provider in Settings → AI Provider.',
        },
        { status: 502 }
      );
    }

    const systemPrompt = `You are a friendly design assistant in FlowEngine's UI Studio. You help users customize their UI components (form, chatbot, button) with natural conversation.

Current component type: ${widgetContext?.type || 'unknown'}
${widgetContext?.selectedElement ? `\n🎯 CURRENTLY SELECTED: "${widgetContext.selectedElementLabel}" (element: ${widgetContext.selectedElement})` : ''}

## Changing Component Type
You CAN change the component type! Use: {"widgetType": "form"} or {"widgetType": "chatbot"} or {"widgetType": "button"}
When user asks for a form and current type is chatbot, change the type AND create the fields in one update.

## Element to Config Key Mapping
When the user has selected an element, use these mappings:

### Chatbot Elements → chatbotConfig keys:
- bubble / Chat Bubble Button → bubbleColor, bubbleSize
- header-bg / Header Background → headerColor
- header-text / Header Text → headerTextColor, chatbotName
- chat-bg / Chat Window Background → chatBackgroundColor
- user-msg / User Message Bubble → userMessageColor
- user-text / User Message Text → userMessageTextColor
- user-avatar / User Avatar → userAvatarColor
- bot-msg / Bot Message Bubble → botMessageColor
- bot-text / Bot Message Text → botMessageTextColor
- bot-avatar / Bot Avatar → botAvatarColor
- input / Input Field → inputBackgroundColor, inputTextColor
- send-button / Send Button → sendButtonColor

### Form Elements → styles keys:
- form-bg → backgroundColor
- form-title → textColor
- form-input → inputBackgroundColor, inputBorderColor
- form-button → primaryColor, buttonTextColor

### Form Fields → fields array:
To add, modify, or replace form fields, use the "fields" key with an array of field objects.
Each field object has these properties:
- name (string, required): Display label for the field
- type (string, required): One of: text, email, number, textarea, select, date, time, file, checkbox, radio, phone, url
- required (boolean, required): Whether the field is mandatory
- placeholder (string, optional): Placeholder text
- options (string[], optional): For select/radio types - array of choices
- width (string, optional): '25', '33', '50', or '100' (percentage width)
- alignment (string, optional): 'left', 'center', or 'right'
- accept (string, optional): For file type - accepted file types (e.g., "image/*,.pdf")
- maxSize (number, optional): For file type - max size in MB
- multiple (boolean, optional): For file/select - allow multiple selections

## Your Role
- Be conversational and friendly
- When the user has an element selected, assume they want to modify THAT element
- If they say "make it blue", apply blue to the selected element's color property
- Describe changes in simple terms

## Making Changes
ALWAYS include a hidden update block when making any changes:

1. Write a friendly 1-2 sentence response
2. Add the update block (hidden from user)

<WIDGET_UPDATE>
{"chatbotConfig":{"propertyName":"value"}}
</WIDGET_UPDATE>

CRITICAL RULES:
- Put ONLY raw JSON inside tags - NO markdown, NO code fences
- Always use proper hex colors like #8b5cf6
- For chatbot changes use: {"chatbotConfig":{...}}
- For form/button style changes use: {"styles":{...}}
- For form field changes use: {"fields":[...]} - this REPLACES all fields, so include existing ones you want to keep

## Current Configuration
${widgetContext?.chatbotConfig ? `Chatbot Config: ${JSON.stringify(widgetContext.chatbotConfig, null, 2)}` : ''}
${widgetContext?.styles ? `Styles: ${JSON.stringify(widgetContext.styles, null, 2)}` : ''}
${widgetContext?.fields && widgetContext.fields.length > 0 ? `Form Fields: ${JSON.stringify(widgetContext.fields, null, 2)}` : 'Form Fields: (none yet)'}

Be creative and helpful!`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: prompt },
    ];

    const response = await fetch(`${aiBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || '',
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'anthropic/claude-sonnet-4-5',
        messages,
        stream: true,
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI-ASSISTANT] Provider error:', response.status, errorText);
      return NextResponse.json(
        { error: 'AI service error', message: `Provider returned ${response.status}` },
        { status: 500 }
      );
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[AI-ASSISTANT] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
