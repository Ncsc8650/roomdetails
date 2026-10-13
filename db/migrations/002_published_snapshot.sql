ALTER TABLE layouts ADD COLUMN published_config jsonb;
UPDATE layouts SET published_config=jsonb_build_object('width',width,'depth',depth,'orientation',orientation,'settings',settings) WHERE published_at IS NOT NULL;
