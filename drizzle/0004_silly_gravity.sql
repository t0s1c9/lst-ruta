ALTER TABLE `offers` ADD `ad_type` text DEFAULT 'route' NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `service_area` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `description` text DEFAULT '' NOT NULL;