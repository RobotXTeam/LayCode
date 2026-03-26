import { pgTable, text, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["FREE", "PRO"]);
export const containerStatusEnum = pgEnum("container_status", [
  "CREATING", "STARTING", "RUNNING", "STOPPING", "STOPPED", "ERROR",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  githubId: text("github_id").unique().notNull(),
  email: text("email").notNull(),
  githubUsername: text("github_username"),
  githubToken: text("github_token"),
  plan: planEnum("plan").default("FREE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  githubRepo: text("github_repo").notNull(),
  branch: text("branch").default("main").notNull(),
  framework: text("framework"),
  flyMachineId: text("fly_machine_id").unique(),
  containerStatus: containerStatusEnum("container_status").default("STOPPED").notNull(),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const editEvents = pgTable("edit_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  instruction: text("instruction").notNull(),
  success: boolean("success").notNull(),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
