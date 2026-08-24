CREATE TABLE `portfolio_value_history` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`currency_rate` text,
	`value_primary` text NOT NULL,
	`value_secondary` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolio_value_history_date_unique` ON `portfolio_value_history` (`date`);