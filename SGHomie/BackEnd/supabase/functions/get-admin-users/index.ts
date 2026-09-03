import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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

    return new Response(
      JSON.stringify({ 
        data: userProfilesWithEmails,
        status: 'success'
      }),
      { 
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        },
      }
    );
  } catch (error) {
    console.error('Error in edge function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal Server Error',
        status: 'error'
      }), 
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        },
      }
    );
  }
});