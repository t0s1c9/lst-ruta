import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  username: text("username").unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["company", "driver", "private"] }).notNull(),
  companyName: text("company_name"),
  phone: text("phone"),
  homeCity: text("home_city"),
  vehicleKind: text("vehicle_kind"),
  vehicleModel: text("vehicle_model"),
  bio: text("bio"),
  avatarKey: text("avatar_key"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const passwordAccounts = sqliteTable("password_accounts", {
  userId: text("user_id").primaryKey().references(() => users.id),
  email: text("email").notNull().unique(),
  salt: text("salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  iterations: integer("iterations").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const localSessions = sqliteTable("local_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (s) => [index("local_sessions_user_idx").on(s.userId), index("local_sessions_expiry_idx").on(s.expiresAt)]);

export const authAttempts = sqliteTable("auth_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: text("reset_at").notNull(),
});

export const tours = sqliteTable("tours", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => users.id),
  driverId: text("driver_id").references(() => users.id),
  pickupCity: text("pickup_city").notNull(),
  pickupAddress: text("pickup_address").notNull(),
  pickupNotes: text("pickup_notes").notNull().default(""),
  pickupMapUrl: text("pickup_map_url"),
  dropoffCity: text("dropoff_city").notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  cargoDescription: text("cargo_description").notNull(),
  cargoWeight: real("cargo_weight").notNull(),
  vehicleKind: text("vehicle_kind").notNull(),
  price: real("price").notNull(),
  departureAt: text("departure_at").notNull(),
  status: text("status", { enum: ["open", "accepted", "loading", "in_transit", "delivered", "cancelled"] }).notNull().default("open"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("tours_company_idx").on(t.companyId), index("tours_driver_idx").on(t.driverId), index("tours_status_idx").on(t.status)]);

export const offers = sqliteTable("offers", {
  id: text("id").primaryKey(),
  driverId: text("driver_id").notNull().unique().references(() => users.id),
  adType: text("ad_type").notNull().default("route"),
  serviceArea: text("service_area").notNull().default(""),
  description: text("description").notNull().default(""),
  originCity: text("origin_city").notNull(),
  destinationCity: text("destination_city").notNull(),
  vehicleKind: text("vehicle_kind").notNull(),
  totalCapacity: real("total_capacity").notNull(),
  freeCapacity: real("free_capacity").notNull(),
  alreadyLoaded: integer("already_loaded", { mode: "boolean" }).notNull().default(false),
  currentCargo: text("current_cargo").notNull().default(""),
  availableAt: text("available_at").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("offers_active_idx").on(t.active)]);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  tourId: text("tour_id").notNull().references(() => tours.id),
  senderId: text("sender_id").notNull().references(() => users.id),
  recipientId: text("recipient_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (m) => [index("messages_tour_idx").on(m.tourId), index("messages_recipient_idx").on(m.recipientId)]);

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  tourId: text("tour_id").notNull().references(() => tours.id),
  authorId: text("author_id").notNull().references(() => users.id),
  subjectId: text("subject_id").notNull().references(() => users.id),
  score: integer("score").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (r) => [uniqueIndex("reviews_tour_author_unique").on(r.tourId, r.authorId), index("reviews_subject_idx").on(r.subjectId), index("reviews_author_idx").on(r.authorId)]);

export const vehiclePhotos = sqliteTable("vehicle_photos", {
  id: text("id").primaryKey(),
  driverId: text("driver_id").notNull().references(() => users.id),
  objectKey: text("object_key").notNull(),
  position: integer("position").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (p) => [uniqueIndex("vehicle_photos_driver_position_unique").on(p.driverId, p.position), index("vehicle_photos_driver_idx").on(p.driverId)]);
