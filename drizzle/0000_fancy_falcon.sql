CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`body` text NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_tour_idx` ON `messages` (`tour_id`);--> statement-breakpoint
CREATE INDEX `messages_recipient_idx` ON `messages` (`recipient_id`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`origin_city` text NOT NULL,
	`destination_city` text NOT NULL,
	`vehicle_kind` text NOT NULL,
	`total_capacity` real NOT NULL,
	`free_capacity` real NOT NULL,
	`already_loaded` integer DEFAULT false NOT NULL,
	`current_cargo` text DEFAULT '' NOT NULL,
	`available_at` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_driver_id_unique` ON `offers` (`driver_id`);--> statement-breakpoint
CREATE INDEX `offers_active_idx` ON `offers` (`active`);--> statement-breakpoint
CREATE TABLE `tours` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`driver_id` text,
	`pickup_city` text NOT NULL,
	`pickup_address` text NOT NULL,
	`pickup_notes` text DEFAULT '' NOT NULL,
	`pickup_map_url` text,
	`dropoff_city` text NOT NULL,
	`dropoff_address` text NOT NULL,
	`cargo_description` text NOT NULL,
	`cargo_weight` real NOT NULL,
	`vehicle_kind` text NOT NULL,
	`price` real NOT NULL,
	`departure_at` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tours_company_idx` ON `tours` (`company_id`);--> statement-breakpoint
CREATE INDEX `tours_driver_idx` ON `tours` (`driver_id`);--> statement-breakpoint
CREATE INDEX `tours_status_idx` ON `tours` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`company_name` text,
	`phone` text,
	`home_city` text,
	`vehicle_kind` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
