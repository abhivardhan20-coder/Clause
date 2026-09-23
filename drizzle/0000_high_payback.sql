CREATE TABLE `ai_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_rate_limits_expiry` ON `ai_rate_limits` (`expires_at`);