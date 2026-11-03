-- Remove unbound write policies on the product-images bucket.
-- The app never updates or deletes stored objects, so client roles get no
-- UPDATE/DELETE path (secure default instead of a rule anyone can exercise).
DROP POLICY IF EXISTS "Allow update product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete product images" ON storage.objects;