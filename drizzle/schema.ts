import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// User Preferences
export const userPreferences = mysqlTable("userPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  smtpEmail: varchar("smtpEmail", { length: 320 }),
  smtpPassword: text("smtpPassword"),
  smtpHost: varchar("smtpHost", { length: 255 }),
  smtpPort: int("smtpPort"),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  whatsappApiKey: text("whatsappApiKey"),
  aiStyle: text("aiStyle"), // JSON storing user's preferred AI response style
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;

// Tasks/Assignments
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: timestamp("dueDate"),
  difficulty: mysqlEnum("difficulty", ["fácil", "médio", "difícil"]).default("médio"),
  priority: mysqlEnum("priority", ["baixa", "média", "alta"]).default("média"),
  status: mysqlEnum("status", ["pendente", "em_progresso", "concluída", "atrasada"]).default("pendente"),
  type: mysqlEnum("type", ["tarefa", "trabalho", "prova", "projeto", "leitura"]).default("tarefa"),
  subject: varchar("subject", { length: 255 }),
  notes: text("notes"),
  referenceFiles: json("referenceFiles"), // Array of {name, url, key}
  completedAt: timestamp("completedAt"),
  completedContent: text("completedContent"), // AI-generated completed work
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// Conversations with AI
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }),
  messages: json("messages"), // Array of {role, content, timestamp}
  taskId: int("taskId"), // Optional: associated task
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// Flashcards
export const flashcards = mysqlTable("flashcards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  deckId: int("deckId"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  subject: varchar("subject", { length: 255 }),
  difficulty: mysqlEnum("difficulty", ["fácil", "médio", "difícil"]).default("médio"),
  timesReviewed: int("timesReviewed").default(0),
  lastReviewedAt: timestamp("lastReviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Flashcard = typeof flashcards.$inferSelect;
export type InsertFlashcard = typeof flashcards.$inferInsert;

// Flashcard Decks
export const flashcardDecks = mysqlTable("flashcardDecks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  subject: varchar("subject", { length: 255 }),
  cardCount: int("cardCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FlashcardDeck = typeof flashcardDecks.$inferSelect;
export type InsertFlashcardDeck = typeof flashcardDecks.$inferInsert;

// Study Schedules
export const studySchedules = mysqlTable("studySchedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  schedule: json("schedule"), // Array of {date, tasks, duration, subject}
  generatedAt: timestamp("generatedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudySchedule = typeof studySchedules.$inferSelect;
export type InsertStudySchedule = typeof studySchedules.$inferInsert;

// Quizzes
export const quizzes = mysqlTable("quizzes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  questions: json("questions"), // Array of {question, options, correctAnswer}
  score: decimal("score", { precision: 5, scale: 2 }),
  totalQuestions: int("totalQuestions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;

// Study Guides
export const studyGuides = mysqlTable("studyGuides", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  content: text("content"),
  sourceTaskId: int("sourceTaskId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudyGuide = typeof studyGuides.$inferSelect;
export type InsertStudyGuide = typeof studyGuides.$inferInsert;

// User Memories (for AI personality learning)
export const userMemories = mysqlTable("userMemories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 255 }), // e.g., "ChatGPT - Matemática", "Meu estilo de escrita"
  content: text("content").notNull(), // Full conversation log or memory text
  source: varchar("source", { length: 100 }), // e.g., "ChatGPT", "Claude", "Gemini", "Manual"
  // Fotos de atividades já respondidas — a IA olha essas imagens junto
  // com o content textual pra aprender como o usuário escreve à mão,
  // formata a resposta, resolve etapas etc. Array de URLs (/manus-storage/
  // ou /uploads/). null = sem imagens.
  imageUrls: json("imageUrls"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserMemory = typeof userMemories.$inferSelect;
export type InsertUserMemory = typeof userMemories.$inferInsert;

// Integration Settings (for email, Toddle, WhatsApp)
export const integrationSettings = mysqlTable("integrationSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Email settings
  emailSmtpHost: varchar("emailSmtpHost", { length: 255 }),
  emailSmtpPort: int("emailSmtpPort"),
  emailUsername: varchar("emailUsername", { length: 320 }),
  emailPassword: text("emailPassword"),
  emailSenderName: varchar("emailSenderName", { length: 255 }),
  emailSenderEmail: varchar("emailSenderEmail", { length: 320 }),
  // Gmail settings (user's own Gmail account)
  gmailUser: varchar("gmailUser", { length: 320 }),
  gmailAppPassword: text("gmailAppPassword"),
  // Toddle/Nordcraft settings
  toddleEmail: varchar("toddleEmail", { length: 320 }),
  toddlePassword: text("toddlePassword"),
  toddleProvider: varchar("toddleProvider", { length: 100 }).default("Lex Brasil"),
  toddleApiKey: text("toddleApiKey"),
  toddleEnabled: boolean("toddleEnabled").default(false),
  // WhatsApp settings
  whatsappPhoneNumber: varchar("whatsappPhoneNumber", { length: 20 }),
  whatsappApiKey: text("whatsappApiKey"),
  whatsappEnabled: boolean("whatsappEnabled").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntegrationSettings = typeof integrationSettings.$inferSelect;
export type InsertIntegrationSettings = typeof integrationSettings.$inferInsert;

// Email Reminders
export const emailReminders = mysqlTable("emailReminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskId: int("taskId").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  reminderTime: timestamp("reminderTime"), // When to send the reminder
  sent: boolean("sent").default(false),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailReminder = typeof emailReminders.$inferSelect;
export type InsertEmailReminder = typeof emailReminders.$inferInsert;
