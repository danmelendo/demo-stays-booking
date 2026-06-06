-- Rename rooms: Space → Paris, Paris → Safari
-- Single UPDATE to avoid name collision between the two renames
UPDATE rooms
SET name = CASE
  WHEN lower(name) = 'space' THEN 'Paris'
  WHEN lower(name) = 'paris' THEN 'Safari'
END
WHERE lower(name) IN ('space', 'paris');
