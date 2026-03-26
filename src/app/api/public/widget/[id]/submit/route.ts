import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import https from 'https';
import http from 'http';
import { isValidUUID, isValidWebhookUrl, checkRateLimit } from '@/lib/validation';

// POST /api/public/widget/[id]/submit - Submit form data to widget webhook
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid widget ID' }, { status: 400 });
    }

    // Rate limiting: 10 submissions per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const rateLimitResult = checkRateLimit(`public-widget:${ip}`, 10, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please wait a moment.' },
        { status: 429 }
      );
    }

    // Fetch the component with instance info
    const { data: widget, error } = await supabaseAdmin
      .from('client_widgets')
      .select('id, webhook_url, webhook_method, widget_type, is_active, instance_id')
      .eq('id', id)
      .single();

    if (error || !widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    if (!widget.is_active) {
      return NextResponse.json({ error: 'Widget is disabled' }, { status: 403 });
    }

    // Check if widget has a workflow configured
    if (!widget.webhook_url || !widget.instance_id) {
      const errorMsg = widget.widget_type === 'chatbot'
        ? 'Connect a workflow with a Chat Trigger to enable this chatbot.'
        : 'Connect a workflow to enable this component.';
      return NextResponse.json(
        {
          error: errorMsg,
          code: 'NO_WORKFLOW',
          message: 'This component is in preview mode.'
        },
        { status: 400 }
      );
    }

    // Get instance URL and subscription status for validation
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('instance_url, subscription_status, deleted_at')
      .eq('id', widget.instance_id)
      .single();

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (instance.deleted_at) {
      return NextResponse.json({ error: 'Instance is no longer available' }, { status: 404 });
    }

    if (instance.subscription_status !== 'active' && instance.subscription_status !== 'trialing') {
      console.warn(`Widget submission blocked - instance ${widget.instance_id} subscription status: ${instance.subscription_status}`);
      return NextResponse.json(
        { error: 'this component is currently unavailable' },
        { status: 503 }
      );
    }

    // Validate webhook URL still points to the correct instance
    if (!instance.instance_url) {
      return NextResponse.json(
        { error: 'this component needs to be reconfigured. Please contact the site owner.' },
        { status: 500 }
      );
    }
    const webhookValidation = isValidWebhookUrl(widget.webhook_url, instance.instance_url);
    if (!webhookValidation.valid) {
      console.error('Public widget webhook validation failed:', id);
      return NextResponse.json(
        { error: 'this component needs to be reconfigured. Please contact the site owner.' },
        { status: 500 }
      );
    }

    // Get form data from request
    const formData = await request.json();

    // Determine HTTP method to use
    type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    let webhookMethod: WebhookMethod = (widget.webhook_method as WebhookMethod) || 'GET';
    if (widget.widget_type === 'form' || widget.widget_type === 'chatbot') {
      webhookMethod = 'POST';
    }

    // Trigger the webhook server-side using native Node.js http/https
    try {
      let webhookUrl = widget.webhook_url;
      let requestBody: string | undefined;

      const methodsWithBody: WebhookMethod[] = ['POST', 'PUT', 'PATCH'];
      const methodsWithQueryParams: WebhookMethod[] = ['GET', 'DELETE'];

      if (methodsWithQueryParams.includes(webhookMethod)) {
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(formData || {})) {
          if (value !== null && value !== undefined) {
            if (typeof value === 'object') {
              queryParams.append(key, JSON.stringify(value));
            } else {
              queryParams.append(key, String(value));
            }
          }
        }
        const queryString = queryParams.toString();
        if (queryString) {
          webhookUrl = `${widget.webhook_url}${widget.webhook_url.includes('?') ? '&' : '?'}${queryString}`;
        }
      } else if (methodsWithBody.includes(webhookMethod)) {
        requestBody = JSON.stringify(formData || {});
      }

      const url = new URL(webhookUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const isFormTrigger = widget.webhook_url?.includes('/n8n-form') && widget.widget_type === 'form';

      let multipartBody: Buffer | undefined;
      let boundary: string | undefined;
      if (isFormTrigger && methodsWithBody.includes(webhookMethod)) {
        boundary = `----FormBoundary${Date.now()}`;
        const parts: string[] = [];
        for (const [key, value] of Object.entries(formData || {})) {
          if (value !== null && value !== undefined) {
            parts.push(`--${boundary}`);
            parts.push(`Content-Disposition: form-data; name="${key}"`);
            parts.push('');
            parts.push(typeof value === 'object' ? JSON.stringify(value) : String(value));
          }
        }
        parts.push(`--${boundary}--`);
        parts.push('');
        multipartBody = Buffer.from(parts.join('\r\n'));
      }

      const headers: Record<string, string> = {
        'User-Agent': 'FlowEngine-PublicWidget/1.0',
        'X-Widget-ID': id,
      };
      if (methodsWithBody.includes(webhookMethod)) {
        if (isFormTrigger && multipartBody) {
          headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
          headers['Content-Length'] = multipartBody.length.toString();
        } else if (requestBody) {
          headers['Content-Type'] = 'application/json';
          headers['Content-Length'] = Buffer.byteLength(requestBody).toString();
        }
      }

      const result = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
        const requestOptions: https.RequestOptions = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: webhookMethod,
          headers,
          timeout: 30000,
          rejectUnauthorized: false,
        };

        const req = lib.request(requestOptions, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            resolve({ statusCode: res.statusCode || 0, body: data });
          });
        });

        req.on('error', (error) => reject(error));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timed out'));
        });

        if (methodsWithBody.includes(webhookMethod)) {
          if (multipartBody) {
            req.write(multipartBody);
          } else if (requestBody) {
            req.write(requestBody);
          }
        }
        req.end();
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        try {
          let responseData = JSON.parse(result.body);

          if (Array.isArray(responseData) && responseData.length > 0) {
            responseData = responseData[0];
          }

          const safeResponse: Record<string, unknown> = { success: true };
          const allowedFields = ['response', 'message', 'output', 'data', 'result', 'text'];
          for (const field of allowedFields) {
            if (responseData[field] !== undefined) {
              safeResponse[field] = responseData[field];
            }
          }

          return NextResponse.json(safeResponse);
        } catch {
          return NextResponse.json({ success: true });
        }
      } else {
        const errorBody = result.body;
        console.error('Public widget webhook failed:', {
          status: result.statusCode,
          url: widget.webhook_url,
          body: errorBody
        });

        let errorMessage = 'Unable to process your request. Please try again later.';
        try {
          const n8nError = JSON.parse(errorBody);
          if (n8nError.hint) {
            errorMessage = n8nError.hint;
          } else if (n8nError.message) {
            errorMessage = n8nError.message;
          }
        } catch {
          if (result.statusCode === 404) {
            if (errorBody.includes('not registered for POST')) {
              errorMessage = 'Webhook is not configured for POST requests. In n8n, edit the Webhook node and set HTTP Method to POST.';
            } else if (errorBody.includes('not registered for GET')) {
              errorMessage = 'Webhook is not configured for GET requests. In n8n, edit the Webhook node and set HTTP Method to GET.';
            } else if (errorBody.includes('not registered')) {
              errorMessage = 'Webhook not found. Please check the workflow is active.';
            } else {
              errorMessage = 'Workflow webhook not found. Please check the workflow is active.';
            }
          } else if (result.statusCode === 500) {
            errorMessage = 'Workflow error. Please check your n8n workflow configuration.';
          } else if (result.statusCode === 401 || result.statusCode === 403) {
            errorMessage = 'Webhook authentication failed. Please check your n8n configuration.';
          }
        }

        return NextResponse.json(
          { success: false, error: errorMessage, status: result.statusCode },
          { status: 502 }
        );
      }
    } catch (fetchError) {
      console.error('Public widget fetch error:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Connection error. Please check your internet and try again.' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Public widget submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
