import { createClient } from 'npm:@supabase/supabase-js@2.114.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = req.headers.get('Authorization');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    if (!authorization) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    // Validate the caller with the user's JWT before using the service role
    // client to read all profiles and Auth emails.
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Invalid authentication' }, 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: adminProfile, error: adminProfileError } = await supabaseClient
      .from('user_profiles')
      .select('is_admin')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (adminProfileError) throw adminProfileError;
    if (!adminProfile?.is_admin) {
      return jsonResponse({ error: 'Admin privileges required' }, 403);
    }

    // Get all user profiles
    const { data: userProfiles, error: usersError } = await supabaseClient
      .from('user_profiles')
      .select('*');

    if (usersError) {
      throw usersError;
    }

    // Get property counts from the view
    const { data: propertyCounts, error: propertyError } = await supabaseClient
      .from('user_property_counts')
      .select('*');

    if (propertyError) {
      throw propertyError;
    }

    // Create a map of seller_id to property count
    const propertyCountMap = new Map(
      propertyCounts.map(item => [item.seller_id, parseInt(item.property_count)])
    );

    // Get emails for all users
    const userProfilesWithEmails = await Promise.all(
      userProfiles.map(async (profile) => {
        try {
          const { data: authUser, error: authError } = await supabaseClient.auth.admin.getUserById(profile.id);

          if (authError) {
            console.error(`Error fetching email for user ${profile.id}:`, authError);
            return { 
              ...profile, 
              email: 'Unknown',
              property_count: propertyCountMap.get(profile.id) || 0
            };
          }

          return { 
            ...profile, 
            email: authUser?.user?.email || 'Unknown',
            property_count: propertyCountMap.get(profile.id) || 0
          };
        } catch (error) {
          console.error(`Error processing user ${profile.id}:`, error);
          return { 
            ...profile, 
            email: 'Unknown',
            property_count: propertyCountMap.get(profile.id) || 0
          };
        }
      })
    );

    return jsonResponse({
      data: userProfilesWithEmails,
      status: 'success',
    });
  } catch (error) {
    console.error('Error in edge function:', error);
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Internal Server Error',
      status: 'error',
    }, 500);
  }
});
