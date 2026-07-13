import { eq, and, desc, gte, lte, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  InsertUserPreferences, userPreferences,
  InsertTask, tasks,
  InsertConversation, conversations,
  InsertFlashcard, flashcards,
  InsertFlashcardDeck, flashcardDecks,
  InsertStudySchedule, studySchedules,
  InsertQuiz, quizzes,
  InsertStudyGuide, studyGuides,
  InsertEmailReminder, emailReminders,
  InsertUserMemory, userMemories,
  InsertIntegrationSettings, integrationSettings,
  Task, Conversation, Flashcard, StudySchedule, UserMemory, IntegrationSettings
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Força charset utf8mb4 na conexão. Sem isso, os valores de enum
      // acentuados no schema ("fácil", "médio", "difícil", "concluída")
      // corrompem em trânsito quando a DATABASE_URL não declara charset.
      // O mysql2 faz merge: parseia a `uri` e a opção `charset` explícita
      // (definida aqui) tem prioridade sobre o que vier na URL.
      _db = drizzle({
        connection: {
          uri: process.env.DATABASE_URL,
          charset: "utf8mb4",
        },
      });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// User Preferences
export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserPreferences(userId: number, prefs: Partial<InsertUserPreferences>) {
  const db = await getDb();
  if (!db) return undefined;
  
  const existing = await getUserPreferences(userId);
  if (existing) {
    await db.update(userPreferences).set(prefs).where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({ userId, ...prefs });
  }
  return await getUserPreferences(userId);
}

// Tasks
export async function createTask(task: InsertTask) {
  const db = await getDb();
  if (!db) return undefined;

  const [inserted] = await db.insert(tasks).values(task).$returningId();
  if (!inserted) return undefined;
  return await getTaskById(inserted.id, task.userId);
}

export async function getTasksByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.createdAt));
}

export async function getTaskById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTask(id: number, userId: number, updates: Partial<Task>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(tasks).set(updates).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

export async function deleteTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

export async function getUpcomingTasks(userId: number, daysAhead: number = 7) {
  const db = await getDb();
  if (!db) return [];

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  // Filtra por userId + dueDate na janela, excluindo tarefas concluidas
  // (senao uma tarefa marcada como feita apareceria como upcoming so
  // porque a data caia dentro da janela).
  return await db.select().from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      gte(tasks.dueDate, new Date()),
      lte(tasks.dueDate, futureDate),
      ne(tasks.status, "concluída")
    ))
    .orderBy(tasks.dueDate);
}

// Conversations
export async function createConversation(conv: InsertConversation) {
  const db = await getDb();
  if (!db) return undefined;

  const [inserted] = await db.insert(conversations).values(conv).$returningId();
  if (!inserted) return undefined;
  return await getConversationById(inserted.id, conv.userId);
}

export async function getConversationsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function getConversationById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateConversation(id: number, userId: number, updates: Partial<Conversation>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(conversations).set(updates).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function deleteConversation(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

// Flashcards
export async function createFlashcard(card: InsertFlashcard) {
  const db = await getDb();
  if (!db) return undefined;
  
  return await db.insert(flashcards).values(card);
}

export async function getFlashcardsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(flashcards)
    .where(eq(flashcards.userId, userId))
    .orderBy(desc(flashcards.createdAt));
}

export async function getFlashcardsByDeckId(deckId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(flashcards)
    .where(and(eq(flashcards.deckId, deckId), eq(flashcards.userId, userId)))
    .orderBy(desc(flashcards.createdAt));
}

export async function deleteFlashcard(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(flashcards).where(and(eq(flashcards.id, id), eq(flashcards.userId, userId)));
}

/**
 * Incrementa timesReviewed em 1 e atualiza lastReviewedAt para agora.
 * Usa raw update com sql`` pra evitar race condition entre read+write.
 */
export async function reviewFlashcard(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(flashcards)
    .set({
      timesReviewed: sql`${flashcards.timesReviewed} + 1`,
      lastReviewedAt: new Date(),
    })
    .where(and(eq(flashcards.id, id), eq(flashcards.userId, userId)));
}

// Flashcard Decks
export async function createFlashcardDeck(deck: InsertFlashcardDeck) {
  const db = await getDb();
  if (!db) return undefined;
  
  return await db.insert(flashcardDecks).values(deck);
}

export async function getFlashcardDecksByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(flashcardDecks)
    .where(eq(flashcardDecks.userId, userId))
    .orderBy(desc(flashcardDecks.createdAt));
}

export async function deleteFlashcardDeck(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(flashcardDecks).where(and(eq(flashcardDecks.id, id), eq(flashcardDecks.userId, userId)));
}

// Study Schedules
export async function createStudySchedule(schedule: InsertStudySchedule) {
  const db = await getDb();
  if (!db) return undefined;
  
  return await db.insert(studySchedules).values(schedule);
}

export async function getLatestStudySchedule(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(studySchedules)
    .where(eq(studySchedules.userId, userId))
    .orderBy(desc(studySchedules.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Sobrescreve o array de dias do cronograma mais recente do usuário.
// Usado pra persistir marcações (ex: dia concluído) sem regenerar tudo.
export async function updateLatestStudySchedule(userId: number, schedule: any) {
  const db = await getDb();
  if (!db) return undefined;

  const latest = await getLatestStudySchedule(userId);
  if (!latest) return undefined;
  await db.update(studySchedules)
    .set({ schedule })
    .where(eq(studySchedules.id, latest.id));
  return await getLatestStudySchedule(userId);
}

// Quizzes
export async function createQuiz(quiz: InsertQuiz) {
  const db = await getDb();
  if (!db) return undefined;
  
  return await db.insert(quizzes).values(quiz);
}

export async function getQuizzesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(quizzes)
    .where(eq(quizzes.userId, userId))
    .orderBy(desc(quizzes.createdAt));
}

export async function deleteQuiz(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.userId, userId)));
}

// Study Guides
export async function createStudyGuide(guide: InsertStudyGuide) {
  const db = await getDb();
  if (!db) return undefined;
  
  return await db.insert(studyGuides).values(guide);
}

export async function getStudyGuidesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(studyGuides)
    .where(eq(studyGuides.userId, userId))
    .orderBy(desc(studyGuides.createdAt));
}

export async function deleteStudyGuide(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(studyGuides).where(and(eq(studyGuides.id, id), eq(studyGuides.userId, userId)));
}

// Email Reminders
export async function createEmailReminder(reminder: InsertEmailReminder) {
  const db = await getDb();
  if (!db) return undefined;
  
  return await db.insert(emailReminders).values(reminder);
}

export async function getEmailRemindersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emailReminders)
    .where(eq(emailReminders.userId, userId))
    .orderBy(desc(emailReminders.createdAt));
}

export async function getPendingEmailReminders() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emailReminders)
    .where(and(
      eq(emailReminders.sent, false),
      lte(emailReminders.reminderTime, new Date())
    ));
}

export async function updateEmailReminder(id: number, updates: Partial<InsertEmailReminder>) {
  const db = await getDb();
  if (!db) return;

  await db.update(emailReminders).set(updates).where(eq(emailReminders.id, id));
}

// Remove os lembretes ainda NÃO enviados de uma tarefa. Usado ao editar
// (reagenda) ou deletar a tarefa, sem apagar histórico do que já foi enviado.
export async function deleteUnsentRemindersForTask(userId: number, taskId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(emailReminders).where(
    and(
      eq(emailReminders.userId, userId),
      eq(emailReminders.taskId, taskId),
      eq(emailReminders.sent, false)
    )
  );
}


// User Memories
export async function createUserMemory(data: InsertUserMemory) {
  const db = await getDb();
  if (!db) return null;

  const [inserted] = await db.insert(userMemories).values(data).$returningId();
  if (!inserted) return null;
  return await getUserMemoryById(inserted.id, data.userId);
}

export async function getUserMemoriesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(userMemories)
    .where(eq(userMemories.userId, userId))
    .orderBy(desc(userMemories.createdAt));
}

export async function getUserMemoryById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(userMemories)
    .where(and(eq(userMemories.id, id), eq(userMemories.userId, userId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateUserMemory(id: number, userId: number, updates: Partial<InsertUserMemory>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(userMemories)
    .set(updates)
    .where(and(eq(userMemories.id, id), eq(userMemories.userId, userId)));
}

export async function deleteUserMemory(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(userMemories)
    .where(and(eq(userMemories.id, id), eq(userMemories.userId, userId)));
}

// Integration Settings
export async function getIntegrationSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(integrationSettings)
    .where(eq(integrationSettings.userId, userId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Usuários que têm um link de calendário (.ics) configurado — usado pelo
// cron de sincronização automática do Toddle. toddleApiKey guarda o link.
export async function getUsersWithToddleFeed(): Promise<{ userId: number }[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select().from(integrationSettings);
  return rows
    .filter((r) => typeof r.toddleApiKey === "string" && r.toddleApiKey.trim().length > 0)
    .map((r) => ({ userId: r.userId }));
}

export async function createOrUpdateIntegrationSettings(userId: number, data: Partial<InsertIntegrationSettings>) {
  try {
    const db = await getDb();
    if (!db) {
      console.error('[DB] Database not available');
      throw new Error('Database not available');
    }
    
    console.log('[DB] Saving integration settings for user', userId, 'with data:', JSON.stringify(data));
    
    const existing = await getIntegrationSettings(userId);
    
    if (existing) {
      console.log('[DB] Updating existing integration settings');
      await db.update(integrationSettings)
        .set(data)
        .where(eq(integrationSettings.userId, userId));
    } else {
      console.log('[DB] Creating new integration settings');
      await db.insert(integrationSettings).values({
        userId,
        ...data,
      });
    }
    
    const result = await getIntegrationSettings(userId);
    console.log('[DB] Integration settings saved successfully');
    return result;
  } catch (error) {
    console.error('[DB] Error saving integration settings:', error);
    throw error;
  }
}
