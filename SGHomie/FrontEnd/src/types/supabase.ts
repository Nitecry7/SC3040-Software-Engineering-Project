export type Property = {
  id: string;
  title: string;
  price: number;
  location: string;
  type: string;
  image_url: string;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  description: string | null;
  created_at: string;
  user_id: string;
};