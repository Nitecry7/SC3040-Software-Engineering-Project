import { createClient } from 'npm:@supabase/supabase-js@2.114.0';
import { SMTPClient } from "npm:emailjs@4.0.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return Response.json({ error: 'Invalid authentication' }, { status: 401, headers: corsHeaders });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // A valid JWT alone does not authorize sending replies. Match the existing
    // admin-user endpoint's server-side role check before reading private data.
    const { data: adminProfile, error: adminError } = await supabaseClient
      .from('user_profiles')
      .select('is_admin')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!adminProfile?.is_admin) {
      return Response.json({ error: 'Admin privileges required' }, { status: 403, headers: corsHeaders });
    }

    const { enquiryId, response } = await req.json();

    // Get enquiry details
    const { data: enquiry, error: enquiryError } = await supabaseClient
      .from('enquiries')
      .select('*')
      .eq('id', enquiryId)
      .single();

    if (enquiryError) throw enquiryError;

    // Update enquiry status and response
    const { error: updateError } = await supabaseClient
      .from('enquiries')
      .update({
        status: 'RESPONDED',
        admin_response: response,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enquiryId);

    if (updateError) throw updateError;

    // Send email using SMTP
    const client = new SMTPClient({
      host: 'smtp.gmail.com',
      port: 587,
      tls: true,
      username: Deno.env.get('GMAIL_USER'),
      password: Deno.env.get('GMAIL_APP_PASSWORD'),
    });

    try {
      await client.send({
        from: Deno.env.get('GMAIL_USER') || '',
        to: enquiry.email,
        subject: 'Response to your SG Homie enquiry',
        text: `Dear ${enquiry.name},\n\n${response}\n\nBest regards,\nSG Homie Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Response to your SG Homie enquiry</h2>
            <p>Dear ${enquiry.name},</p>
            <p style="line-height: 1.6;">${response}</p>
            <p style="margin-top: 24px;">Best regards,<br>SG Homie Team</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 14px;">
              This is an automated response. Please do not reply to this email.
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Continue execution even if email fails
    }

    return new Response(
      JSON.stringify({ message: 'Response sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending response:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send response',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
