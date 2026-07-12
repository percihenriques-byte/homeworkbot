CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`messages` json,
	`taskId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskId` int NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`reminderTime` timestamp,
	`sent` boolean DEFAULT false,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailReminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flashcardDecks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`subject` varchar(255),
	`cardCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `flashcardDecks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deckId` int,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`subject` varchar(255),
	`difficulty` enum('fácil','médio','difícil') DEFAULT 'médio',
	`timesReviewed` int DEFAULT 0,
	`lastReviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `flashcards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`subject` varchar(255),
	`questions` json,
	`score` decimal(5,2),
	`totalQuestions` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quizzes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studyGuides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`subject` varchar(255),
	`content` text,
	`sourceTaskId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studyGuides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studySchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`schedule` json,
	`generatedAt` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studySchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`dueDate` timestamp,
	`difficulty` enum('fácil','médio','difícil') DEFAULT 'médio',
	`priority` enum('baixa','média','alta') DEFAULT 'média',
	`status` enum('pendente','em_progresso','concluída','atrasada') DEFAULT 'pendente',
	`type` enum('tarefa','trabalho','prova','projeto','leitura') DEFAULT 'tarefa',
	`subject` varchar(255),
	`notes` text,
	`referenceFiles` json,
	`completedAt` timestamp,
	`completedContent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`smtpEmail` varchar(320),
	`smtpPassword` text,
	`smtpHost` varchar(255),
	`smtpPort` int,
	`whatsappNumber` varchar(20),
	`whatsappApiKey` text,
	`aiStyle` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `userPreferences_userId_unique` UNIQUE(`userId`)
);
