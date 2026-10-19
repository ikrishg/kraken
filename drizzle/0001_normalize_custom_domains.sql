UPDATE "publications"
SET "custom_domain" = regexp_replace(lower(trim(both '.' from "custom_domain")), '^www\.', '')
WHERE "custom_domain" IS NOT NULL;
