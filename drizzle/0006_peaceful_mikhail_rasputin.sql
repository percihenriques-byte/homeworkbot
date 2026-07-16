ALTER TABLE `integrationSettings` ADD `gmailUser` varchar(320);--> statement-breakpoint
ALTER TABLE `integrationSettings` ADD `gmailAppPassword` text;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;