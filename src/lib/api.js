import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ *
 * Supabase data access layer.
 * Translates DB snake_case <-> App camelCase.
 * ------------------------------------------------------------------ */

function throwIfError(result) {
  if (result?.error) throw result.error;
  return result?.data;
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

  const groups = (groupsRes.data || []).map((g) => ({ id: g.id, name: g.name }));

  const resources = (resourcesRes.data || []).map((r) => ({
    id: r.id,
    name: r.name,
    groupId: r.group_id,
    slots: r.slots,
    capacity: r.capacity,
    requiresApproval: r.requires_approval,
  }));

  const periodsByGroup = {};
  for (const p of periodsRes.data || []) {
    const period = {
      id: p.id,
      label: p.label,
      type: p.type,
      start: p.start_time,
      end: p.end_time,
    };

    if (!periodsByGroup[p.group_id]) {
      periodsByGroup[p.group_id] = [];
    }

    periodsByGroup[p.group_id].push(period);
  }

  const users = (usersRes.data || []).map((u) => ({
    id: u.id,
    entraId: u.entra_id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));

  const bookings = (bookingsRes.data || []).map((b) => ({
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

  const notifications = (notificationsRes.data || []).map((n) => ({
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
export async function upsertResource(resource) {
  return throwIfError(
    await supabase.from("resources").upsert({
      id: resource.id,
      name: resource.name,
      group_id: resource.groupId,
      slots: resource.slots,
      capacity: resource.capacity,
      requires_approval: resource.requiresApproval,
    })
  );
}

export async function deleteResourceRow(id) {
  return throwIfError(await supabase.from("resources").delete().eq("id", id));
}

// ---------- Periods ----------
export async function replaceGroupPeriods(groupId, periods) {
  throwIfError(await supabase.from("periods").delete().eq("group_id", groupId));

  if (!periods.length) return;

  const rows = periods.map((p, index) => ({
    id: p.id,
    group_id: groupId,
    label: p.label,
    type: p.type,
    start_time: p.start,
    end_time: p.end,
    sort_order: index,
  }));

  return throwIfError(await supabase.from("periods").insert(rows));
}

export async function deletePeriodsForGroup(groupId) {
  return throwIfError(await supabase.from("periods").delete().eq("group_id", groupId));
}

// ---------- Timetable Templates ----------

export async function loadTemplates() {
  const { data, error } =
    await supabase
      .from("timetable_templates")
      .select("*")
      .order("name");

  if (error) {
    console.warn(
      "loadTemplates:",
      error
    );
    return [];
  }

  return (data || []).map(
    (template) => ({
      id: template.id,
      name: template.name,
      blocks:
        template.blocks || [],
    })
  );
}

export async function upsertTemplate(
  template
) {
  const { error } =
    await supabase
      .from("timetable_templates")
      .upsert(
        {
          id: template.id,
          name: template.name,
          blocks: template.blocks,
        },
        {
          onConflict: "id",
        }
      );

  if (error) {
    throw error;
  }
}

export async function deleteTemplate(
  id
) {
  const { error } =
    await supabase
      .from("timetable_templates")
      .delete()
      .eq("id", id);

  if (error) {
    throw error;
  }
}

// ---------- Terms ----------
export async function loadTerms() {
  const { data, error } = await supabase
    .from("term_dates")
    .select("*")
    .order("id");

  if (error) {
    console.warn("loadTerms:", error);
    return [];
  }

  return data || [];
}

export async function getTerm(id) {
  const { data, error } = await supabase
    .from("term_dates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function upsertTerm(term) {
  const { error } = await supabase.from("term_dates").upsert(
    {
      id: term.id,
      name: term.name,
      start_date: term.start || null,
      end_date: term.end || null,
    },
    {
      onConflict: "id",
    }
  );

  if (error) throw error;
}

// ---------- Users ----------
export async function upsertUserRow(user) {
  return throwIfError(
    await supabase.from("app_users").upsert(
      {
        id: user.id,
        entra_id: user.entraId || null,
        name: user.name,
        email: user.email || null,
        role: user.role,
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
function toBookingRow(booking) {
  return {
    id: booking.id,
    resource_id: booking.resourceId,
    period_id: booking.periodId,
    all_day: booking.allDay,
    date: booking.date,
    title: booking.title,
    booked_by_id: booking.bookedById,
    booked_by: booking.bookedBy,
    status: booking.status,
    recurrence_id: booking.recurrenceId,
    group_id: booking.groupId,
  };
}

export async function insertBookings(bookings) {
  if (!bookings.length) return;
  return throwIfError(await supabase.from("bookings").insert(bookings.map(toBookingRow)));
}

export async function updateBookingStatusRow(id, status) {
  return throwIfError(await supabase.from("bookings").update({ status }).eq("id", id));
}

export async function updateBookingStatusForRecurrence(recurrenceId, status) {
  return throwIfError(
    await supabase.from("bookings")
      .update({ status })
      .eq("recurrence_id", recurrenceId)
      .eq("status", "pending")
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
    await supabase.from("bookings")
      .delete()
      .eq("recurrence_id", recurrenceId)
      .eq("status", "pending")
  );
}

export async function deleteBookingsByResourceRow(resourceId) {
  return throwIfError(await supabase.from("bookings").delete().eq("resource_id", resourceId));
}

export async function deleteBookingsByPeriodRow(periodId) {
  return throwIfError(await supabase.from("bookings").delete().eq("period_id", periodId));
}

// ---------- Notifications ----------
export async function insertNotificationRow(notification) {
  return throwIfError(
    await supabase.from("notifications").insert([
      {
        id: notification.id,
        user_id: notification.userId,
        type: notification.type,
        message: notification.message,
      },
    ])
  );
}

export async function deleteNotificationRow(id) {
  return throwIfError(await supabase.from("notifications").delete().eq("id", id));
}

export async function deleteNotificationsByUserRow(userId) {
  return throwIfError(await supabase.from("notifications").delete().eq("user_id", userId));
}

// ---------- Audit Log ----------
export async function logEvent(bookingId, action, actor, actorId, details) {
  const { error } = await supabase.from("booking_events").insert({
    booking_id: bookingId,
    action,
    actor,
    actor_id: actorId || null,
    details: details || null,
  });

  if (error) {
    console.error("Failed to write booking_events log entry:", error);
  }
}
