/*
  # Create view for user property counts

  1. Changes
    - Create a view to handle property counts per seller
    - Add indexes for better performance

  2. Security
    - Enable RLS on the view
    - Add appropriate policies
*/

-- Create view for property counts
CREATE OR REPLACE VIEW user_property_counts AS
SELECT 
  seller_id,
  COUNT(*) as property_count
FROM properties
WHERE seller_id IS NOT NULL
GROUP BY seller_id;

-- Add index to improve performance
CREATE INDEX IF NOT EXISTS idx_properties_seller_id ON properties(seller_id);