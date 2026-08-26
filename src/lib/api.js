import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ *
 * This file is the only place that talks to Supabase. App.jsx keeps
 * using the same camelCase shapes it always did (resources, groups,
 * periodsByGroup, bookings, users, notifications) — these functions
 * translate to/from the snake_case table columns in supabase/schema.sql.
 * ------------------------------------------------------------------ */

function throwIfError({ error }) {
  if (error) throw error;
}

// ---------- Load everything on startup ----------

export async function loadAll() {
  const [groupsRes, resourcesRes, periodsRes, usersRes, bookingsRes, notificationsRes] =
    await Promise.all([
      supabase.from("groups").select("*"),
      supabase.from("resources").select("*"),
      supabase.from("periods").select("*").order("sort_order", { ascending: true }),
      supabase.from("app_users").select("*"),
      supabase.from("bookings").select("*"),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    ]);

  [groupsRes, resourcesRes, periodsRes, usersRes, bookingsRes, notificationsRes].forEach(throwIfError);

  const groups = groupsRes.data.map((g) => ({ id: g.id, name: g.name }));

  const resources = resourcesRes.data.map((r) => ({
    id: r.id,
    name: r.name,
    groupId: r.group_id,
    slots: r.slots,
    capacity: r.capacity,
    requiresApproval: r.requires_approval,
  }));

  const periodsByGroup = {};
  for (const p of periodsRes.data) {
    const period = { id: p.id, label: p.label, type: p.type, start: p.start_time, end: p.end_time };
    if (!periodsByGroup[p.group_id]) periodsByGroup[p.group_id] = [];
    periodsByGroup[p.group_id].push(period);
  }

   const users = usersRes.data.map((u) => ({
  id: u.id,
  entraId: u.entra_id,
  name: u.name,
  email: u.email,
  role: u.role,
}));

  const bookings = bookingsRes.data.map((b) => ({
    id: b.id,
    resourceId: b.resource_id,
    periodId: b.period_id,
    allDay: b.all_day,
    date: b.date,
    title: b.title,
    bookedById: b.booked_by_id,
    bookedBy: b.booked_by,
    status: b.status,
    recurrenceId: b.recurrence_id,
    groupId: b.group_id,
  }));

  const notifications = notificationsRes.data.map((n) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    message: n.message,
    createdAt: new Date(n.created_at).getTime(),
  }));

  return { groups, resources, periodsByGroup, users, bookings, notifications };
}

// ---------- Groups ----------

export async function upsertGroup(group) {
  return throwIfError(await supabase.from("groups").upsert({ id: group.id, name: group.name }));
}
export async function deleteGroupRow(id) {
  return throwIfError(await supabase.from("groups").delete().eq("id", id));
}

// ---------- Resources ----------

export async function upsertResource(r) {
  return throwIfError(
    await supabase.from("resources").upsert({
      id: r.id,
      name: r.name,
      group_id: r.groupId,
      slots: r.slots,
      capacity: r.capacity,
      requires_approval: r.requiresApproval,
    })
  );
}
export async function deleteResourceRow(id) {
  return throwIfError(await supabase.from("resources").delete().eq("id", id));
}

// ---------- Periods (a group's whole timetable is replaced on each edit —
// simplest correct way to handle reordering/insert/remove without diffing) ----------

export async function replaceGroupPeriods(groupId, periods) {
  const del = await supabase.from("periods").delete().eq("group_id", groupId);
  throwIfError(del);
  if (periods.length === 0) return;
  const rows = periods.map((p, i) => ({
    id: p.id,
    group_id: groupId,
    label: p.label,
    type: p.type,
    start_time: p.start,
    end_time: p.end,
    sort_order: i,
  }));
  throwIfError(await supabase.from("periods").insert(rows));
}
export async function deletePeriodsForGroup(groupId) {
  return throwIfError(await supabase.from("periods").delete().eq("group_id", groupId));
}

// ---------- Terms ----------

export async function loadTerms() {
  const { data, error } =
    await supabase
      .from("term_dates")
      .select("*")
      .order("id");

  if (error) throw error;

  return data;
}

export async function upsertTerm(term) {
  const { error } =
    await supabase
      .from("term_dates")
      .upsert({
        id: term.id,
        name: term.name,
        start_date: term.start,
        end_date: term.end,
      });

  if (error) throw error;
}

// ---------- Users ----------

export async function upsertUserRow(u) {
  return throwIfError(
    await supabase
      .from("app_users")
      .upsert(
        {
          id: u.id,
          entra_id: u.entraId || null,
          name: u.name,
          email: u.email || null,
          role: u.role,
        },
        {
          onConflict: "id",
        }
      )
  );
}

export async function deleteUserRow(id) {
  return throwIfError(await supabase.from("app_users").delete().eq("id", id));
}

// ---------- Bookings ----------

function toBookingRow(b) {
  return {
    id: b.id,
    resource_id: b.resourceId,
    period_id: b.periodId,
    all_day: b.allDay,
    date: b.date,
    title: b.title,
    booked_by_id: b.bookedById,
    booked_by: b.bookedBy,
    status: b.status,
    recurrence_id: b.recurrenceId,
    group_id: b.groupId,
  };
}

export async function insertBookings(bookingsArr) {
  if (bookingsArr.length === 0) return;
  return throwIfError(await supabase.from("bookings").insert(bookingsArr.map(toBookingRow)));
}
export async function updateBookingStatusRow(id, status) {
  return throwIfError(await supabase.from("bookings").update({ status }).eq("id", id));
}
export async function updateBookingStatusForRecurrence(recurrenceId, status) {
  return throwIfError(
    await supabase.from("bookings").update({ status }).eq("recurrence_id", recurrenceId).eq("status", "pending")
  );
}
export async function deleteBookingRow(id) {
  return throwIfError(await supabase.from("bookings").delete().eq("id", id));
}
export async function deleteBookingsByRecurrenceRow(recurrenceId) {
  return throwIfError(await supabase.from("bookings").delete().eq("recurrence_id", recurrenceId));
}
export async function deletePendingByRecurrenceRow(recurrenceId) {
  return throwIfError(
    await supabase.from("bookings").delete().eq("recurrence_id", recurrenceId).eq("status", "pending")
  );
}
export async function deleteBookingsByResourceRow(resourceId) {
  return throwIfError(await supabase.from("bookings").delete().eq("resource_id", resourceId));
}
export async function deleteBookingsByPeriodRow(periodId) {
  return throwIfError(await supabase.from("bookings").delete().eq("period_id", periodId));
}

// ---------- Notifications ----------

export async function insertNotificationRow(n) {
  return throwIfError(
    await supabase.from("notifications").insert({
      id: n.id,
      user_id: n.userId,
      type: n.type,
      message: n.message,
    })
  );
}
export async function deleteNotificationRow(id) {
  return throwIfError(await supabase.from("notifications").delete().eq("id", id));
}
export async function deleteNotificationsByUserRow(userId) {
  return throwIfError(await supabase.from("notifications").delete().eq("user_id", userId));
}

// ---------- Audit log ----------
// Call this alongside the booking mutation functions above whenever a
// booking is created, approved, rejected, or cancelled. This table is
// append-only — it's your history of who did what, independent of the
// current state of the `bookings` table.

export async function logEvent(bookingId, action, actor, actorId, details) {
  const { error } = await supabase.from("booking_events").insert({
    booking_id: bookingId,
    action,
    actor,
    actor_id: actorId || null,
    details: details || null,
  });
  if (error) console.error("Failed to write booking_events log entry:", error);
}
