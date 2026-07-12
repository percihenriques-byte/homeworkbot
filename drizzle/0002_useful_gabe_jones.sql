CREATE TABLE `integrationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailSmtpHost` varchar(255),
	`emailSmtpPort` int,
	`emailUsername` varchar(320),
	`emailPassword` text,
	`emailSenderName` varchar(255),
	`emailSenderEmail` varchar(320),
	`toddleApiKey` text,
	`toddleEnabled` boolean DEFAULT false,
	`whatsappPhoneNumber` varchar(20),
	`whatsappApiKey` text,
	`whatsappEnabled` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrationSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `integrationSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `userMemories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` varchar(255),
	`content` text NOT NULL,
	`source` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userMemories_id` PRIMARY KEY(`id`)
);
