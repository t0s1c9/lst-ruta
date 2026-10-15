CREATE TABLE `vehicle_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`object_key` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicle_photos_driver_position_unique` ON `vehicle_photos` (`driver_id`,`position`);--> statement-breakpoint
CREATE INDEX `vehicle_photos_driver_idx` ON `vehicle_photos` (`driver_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `username` text;--> statement-breakpoint
ALTER TABLE `users` ADD `vehicle_model` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);