CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`author_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_tour_author_unique` ON `reviews` (`tour_id`,`author_id`);--> statement-breakpoint
CREATE INDEX `reviews_subject_idx` ON `reviews` (`subject_id`);--> statement-breakpoint
CREATE INDEX `reviews_author_idx` ON `reviews` (`author_id`);