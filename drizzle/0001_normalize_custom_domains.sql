ALTER TABLE "publications" ADD COLUMN "custom_domain_key" text;--> statement-breakpoint
UPDATE "publications"
SET "custom_domain_key" = regexp_replace(
  lower(trim(both '.' from "custom_domain")),
  '^www\.',
  ''
)
WHERE "custom_domain" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "publications" DROP CONSTRAINT "publications_custom_domain_unique";--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_custom_domain_key_unique" UNIQUE ("custom_domain_key");
