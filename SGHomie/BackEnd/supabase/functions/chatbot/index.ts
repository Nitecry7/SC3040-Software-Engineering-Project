import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FAQ_RESPONSES = {
  'how to buy': 'To buy a property on SG Homie:\n1. Create an account\n2. Browse listings in the Search page\n3. Click on properties to view details\n4. Use the contact form to reach out to sellers\n5. Schedule viewings and proceed with the purchase',
  
  'how to sell': 'To sell a property on SG Homie:\n1. Sign up for an account\n2. Go to "Become a Seller" in your profile\n3. Complete the seller verification\n4. Click "Add Property" in your seller dashboard\n5. Fill in property details and submit for approval',
  
  'payment methods': 'We support various payment methods for property transactions:\n- Bank Transfer\n- Cashier\'s Check\n- Property Loan\nPlease consult with your bank or financial advisor for the best payment option.',
  
  'contact support': 'You can reach our support team through:\n1. Email: support@sghomie.com\n2. Phone: +65 6789 0123\n3. Contact form on our website\nOur support hours are Mon-Fri, 9am-6pm.',
  
  'property types': 'We list various HDB property types:\n- 2 Room Flats\n- 3 Room Flats\n- 4 Room Flats\n- Executive Flats\nEach type has different sizes and features.',
  
  'viewing arrangement': 'To arrange a property viewing:\n1. Find a property you\'re interested in\n2. Click "Contact Seller" on the property page\n3. Fill out the enquiry form\n4. The seller will contact you to arrange a viewing time',
  
  'default': 'I can help you with:\n- Buying properties\n- Selling properties\n- Payment information\n- Property types\n- Viewing arrangements\n- Support contact\n\nWhat would you like to know more about?'
};

function findBestMatch(input: string): string {
  input = input.toLowerCase();
  
  // Check for keyword matches
  for (const [key, response] of Object.entries(FAQ_RESPONSES)) {
    if (input.includes(key)) {
      return response;
    }
  }
  
  // Check for common questions
  if (input.includes('help') || input.includes('what') || input.includes('how')) {
    return FAQ_RESPONSES['default'];
  }
  
  if (input.includes('price') || input.includes('cost') || input.includes('payment')) {
    return FAQ_RESPONSES['payment methods'];
  }
  
  if (input.includes('view') || input.includes('visit') || input.includes('see')) {
    return FAQ_RESPONSES['viewing arrangement'];
  }
  
  if (input.includes('contact') || input.includes('support') || input.includes('help')) {
    return FAQ_RESPONSES['contact support'];
  }
  
  // Default response
  return FAQ_RESPONSES['default'];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    const response = findBestMatch(message);

    return new Response(
      JSON.stringify({ response }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal Server Error'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});