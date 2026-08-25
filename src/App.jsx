import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Calendar, Search, RotateCcw, CalendarPlus, ChevronDown, ChevronUp,
  Info, X, Trash2, Plus, Loader2, ShieldCheck, LogOut, Clock, Upload, ArrowUp, ArrowDown, Boxes,
  Bell, Inbox, Check, Repeat as RepeatIcon,
} from "lucide-react";
import * as api from "./lib/api";
import {
  useMsal,
  useIsAuthenticated
} from "@azure/msal-react";

import { loginRequest } from "./authConfig";

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');";

const C = {
  purple: "#5B2A86",
  purpleDeep: "#4C1D78",
  purpleBright: "#7C2FC9",
  lavender: "#F3E9FB",
  lavenderBorder: "#D9C3EF",
  ink: "#1F2430",
  inkSoft: "#68707E",
  border: "#E4E3EA",
  toolbar: "#F7F6FA",
  page: "#FFFFFF",
  break: "#F6DDAE",
  breakText: "#8A6A2E",
  danger: "#B0402E",
  dangerBg: "#FBEAE6",
  successBg: "#E9F5EC",
  successText: "#276B3E",
  pendingBg: "#FDF3E1",
  pendingBorder: "#C99A3C",
  pendingText: "#8A6A2E",
};

const DEFAULT_BLOCK_COLOR = "#FFFFFF";
const DEFAULT_BLOCK_TEXT = "#1F2430";
const DEFAULT_BREAK_COLOR = "#F6DDAE";
const DEFAULT_BREAK_TEXT = "#8A6A2E";

function periodColors(p) {
  return p.type === "break"
    ? { bg: DEFAULT_BREAK_COLOR, text: DEFAULT_BREAK_TEXT }
    : { bg: DEFAULT_BLOCK_COLOR, text: DEFAULT_BLOCK_TEXT };
}

function pad(n) { return String(n).padStart(2, "0"); }
function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d, n) { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; }
function toDateInputValue(date) { return date.toISOString().split("T")[0]; }
function formatDate(d) { return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
function formatShort(d) { return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); }
function getWeekStart(d) {
  const nd = new Date(d);
  const day = nd.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  nd.setDate(nd.getDate() + diff);
  return nd;
}
function formatTime12(t) {
  if (!t || !t.includes(":")) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${mStr} ${period}`;
}
function formatDateShort(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function uid() { return Math.random().toString(36).slice(2, 10); }

function getGroupList(envValue) {
  return (envValue || "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

function getCurrentTerm(
  date,
  terms
) {
  const iso = toISODate(date);

  return terms.find(
    (term) =>
      term.start &&
      term.end &&
      iso >= term.start &&
      iso <= term.end
  );
}

function Modal({ children, onClose, title, width = 400 }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(31,36,48,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.page, borderRadius: 8, width: `min(${width}px, 94vw)`,
        boxShadow: "0 16px 40px rgba(31,36,48,0.3)", overflow: "hidden", maxHeight: "90vh",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: 4, display: "flex", flexShrink: 0 }}>
            <X size={17} />
          </button>
        </div>
        <div style={{ padding: 18, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function fieldStyle() {
  return {
    width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
    fontSize: 13.5, fontFamily: "'Inter', sans-serif", color: C.ink, background: "#FCFCFD",
    boxSizing: "border-box", outline: "none",
  };
}
function labelStyle() {
  return { fontSize: 11.5, fontWeight: 600, color: C.inkSoft, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.03em" };
}
function toolBtn() {
  return { display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${C.purple}`, borderRadius: 6, padding: "7px 12px", fontSize: 13, fontWeight: 500, color: C.purple, cursor: "pointer" };
}
function roleBadge(role) {
  const admin = role === "admin";
  return (
    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.04em", background: admin ? "#F6E9D8" : C.lavender, color: admin ? "#966A1E" : C.purpleDeep }}>
      {admin ? "Admin" : "Member"}
    </span>
  );
}
function iconBtnStyle() {
  return { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", color: C.ink };
}

export default function ResourceBookingApp() {
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [resources, setResources] = useState([]);
  const [groups, setGroups] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [periodsByGroup, setPeriodsByGroup] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sessionUser, setSessionUser] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState("Detailed");

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
  title: "",
  repeat: "none",
  repeatEndType: "term",
  repeatEndDate: "",
});
  const [formError, setFormError] = useState("");
  const [createResult, setCreateResult] = useState(null);
  const [newResourceName, setNewResourceName] = useState("");
  const [newResourceSlots, setNewResourceSlots] = useState(1);
  const [newResourceCapacity, setNewResourceCapacity] = useState("");
  const [newResourceApproval, setNewResourceApproval] = useState(false);
  const [newResourceGroupId, setNewResourceGroupId] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [resourcePanelError, setResourcePanelError] = useState("");
  const [saveState, setSaveState] = useState("idle");

  const fileInputRef = useRef(null);
  const datePickerRef = useRef(null);

  const [terms, setTerms] = useState([
  {
    id: "term1",
    name: "Term 1",
    start: "",
    end: "",
  },
  {
    id: "term2",
    name: "Term 2",
    start: "",
    end: "",
  },
  {
    id: "term3",
    name: "Term 3",
    start: "",
    end: "",
  },
  {
    id: "term4",
    name: "Term 4",
    start: "",
    end: "",
  }
]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadError("");
      try {
        const data = await api.loadAll();
        if (cancelled) return;

        const loadedGroups = data.groups ?? [];
        const firstGroupId = loadedGroups[0]?.id ?? null;
        setGroups(loadedGroups);
        setResources(data.resources ?? []);
        setBookings(data.bookings ?? []);
        setPeriodsByGroup(data.periodsByGroup ?? {});
        setUsers(data.users ?? []);
        setNotifications(data.notifications ?? []);
        setActiveGroupId(firstGroupId);
        setEditingGroupId(firstGroupId);
        setNewResourceGroupId(firstGroupId);
      } catch (error) {
        console.error("Failed to load data from Supabase.", error);
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load data from Supabase.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncMicrosoftUser() {
      if (!loaded) return;

      if (!isAuthenticated) {
        if (!cancelled) setSessionUser(null);
        return;
      }

      const account =
        instance.getActiveAccount() ||
        instance.getAllAccounts()[0];

      if (!account) return;

      const entraId = account.localAccountId;
      const email = account.username?.trim().toLowerCase();
      const name = account.name?.trim() || email;

      const groups =
  account.idTokenClaims?.groups || [];

const accessGroups = getGroupList(
  import.meta.env.VITE_BOOKING_ACCESS_GROUPS
);

const adminGroups = getGroupList(
  import.meta.env.VITE_BOOKING_ADMIN_GROUPS
);

const isAdmin =
  groups.some((groupId) =>
    adminGroups.includes(groupId)
  );

const hasAccess =
  isAdmin ||
  groups.some((groupId) =>
    accessGroups.includes(groupId)
  );

      if (!hasAccess) {
  setLoadError(
    "You do not have permission to access Resource Booking."
  );

  try {
    await instance.logoutPopup();
  } catch (e) {
    console.error(e);
  }

  return;
}

      if (!entraId || !email) {
        console.error("Microsoft account did not return the required identity values.");
        return;
      }

      const existingUser = users.find(
        (user) =>
          user.entraId === entraId ||
          user.email?.trim().toLowerCase() === email
      );

      const syncedUser = {
  id: existingUser?.id || crypto.randomUUID(),
  entraId,
  name,
  email,
  role: isAdmin ? "admin" : "user",
};

      try {
        await api.upsertUserRow(syncedUser);
        if (cancelled) return;

        setSessionUser(syncedUser);
        setUsers((previousUsers) => {
          const index = previousUsers.findIndex(
            (user) =>
              user.id === syncedUser.id ||
              user.entraId === entraId ||
              user.email?.trim().toLowerCase() === email
          );

          if (index === -1) return [...previousUsers, syncedUser];

          return previousUsers.map((user, userIndex) =>
            userIndex === index ? { ...user, ...syncedUser } : user
          );
        });
      } catch (error) {
        console.error("Failed to sync Microsoft user:", error);
        if (!cancelled) {
          setLoadError(
            "Microsoft sign-in succeeded, but the user account could not be synchronised."
          );
        }
      }
    }

    syncMicrosoftUser();
    return () => {
      cancelled = true;
    };
  }, [instance, isAuthenticated, loaded]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target)
      ) {
        setShowDatePicker(false);
      }
    }
  
    document.addEventListener(
      "mousedown",
      handleClickOutside
    );
  
    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  useEffect(() => {
    if (groups.length === 0) {
      setActiveGroupId(null);
      setEditingGroupId(null);
      setNewResourceGroupId(null);
      return;
    }
    const firstGroupId = groups[0].id;
    if (!groups.some((group) => group.id === activeGroupId)) setActiveGroupId(firstGroupId);
    if (!groups.some((group) => group.id === editingGroupId)) setEditingGroupId(firstGroupId);
    if (!groups.some((group) => group.id === newResourceGroupId)) setNewResourceGroupId(firstGroupId);
  }, [groups, activeGroupId, editingGroupId, newResourceGroupId]);

  async function runPersist(fn) {
    setSaveState("saving");
    try {
      await fn();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1000);
    } catch (e) {
      console.error("Supabase write failed:", e);
      setSaveState("idle");
    }
  }

  function periodsFor(groupId) {
    if (!groupId) return [];
    const groupPeriods = periodsByGroup[groupId];
    return Array.isArray(groupPeriods) ? groupPeriods : [];
  }

  const dateKey = toISODate(selectedDate);
  const currentTerm = getCurrentTerm(selectedDate, terms);
  const isAdmin = sessionUser?.role === "admin";
  const pendingBookings = bookings.filter((b) => b.status === "pending").sort((a, b) => (a.date + (a.periodId || "")).localeCompare(b.date + (b.periodId || "")));
  const myNotifications = sessionUser ? notifications.filter((n) => n.userId === sessionUser.id) : [];

  const periods = periodsFor(activeGroupId);

  const groupResources = resources.filter((r) => r.groupId === activeGroupId);
  const pinnedResources = resources.filter((r) => pinnedIds.includes(r.id) && r.groupId !== activeGroupId);
  const visibleResources = [...groupResources, ...pinnedResources];

  const searchMatches = searchText.trim()
    ? resources.filter((r) => r.name.toLowerCase().includes(searchText.trim().toLowerCase()) && !visibleResources.some((v) => v.id === r.id)).slice(0, 6)
    : [];

  function bookingsFor(resourceId, periodId, date) {
    return bookings.filter((b) => b.resourceId === resourceId && b.date === date && (b.allDay || b.periodId === periodId));
  }

  async function signIn() {
    try {
      await instance.loginPopup(loginRequest);
    } catch (error) {
      console.error("Login failed:", error);
    }
  }
  
  async function signOut() {
    await instance.logoutPopup();
  }

  function openCreateModal(resourceId, periodId) {
    setForm({
  resourceId,
  periodId,
  title: "",
  repeat: "none",
  repeatEndType: "term",
  repeatEndDate: "",
  allDay: false
});
    setFormError("");
    setCreateResult(null);
    setModal({ mode: "create" });
  }
  function openViewModal(resourceId, periodId) { setModal({ mode: "view", resourceId, periodId }); }
  function closeModal() { setModal(null); setFormError(""); setCsvResult(null); setCreateResult(null); }

  function pushNotification(userId, type, message) {
    const n = { id: uid(), userId, type, message, createdAt: Date.now() };
    setNotifications((prev) => [n, ...prev].slice(0, 200));
    runPersist(() => api.insertNotificationRow(n));
  }
  function dismissNotification(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    runPersist(() => api.deleteNotificationRow(id));
  }
  function clearMyNotifications() {
    setNotifications((prev) => prev.filter((n) => n.userId !== sessionUser.id));
    runPersist(() => api.deleteNotificationsByUserRow(sessionUser.id));
  }

  function computeRecurringDates(
  startDate,
  repeat,
  endDate
) {
  const dates = [];

  const step =
    repeat === "weekly"
      ? 7
      : 1;

  let current =
    new Date(startDate);

  while (current <= endDate) {
    dates.push(
      new Date(current)
    );

    current = addDays(
      current,
      step
    );
  }

  return dates;
}

  function submitBooking() {
    const { resourceId, periodId, title, allDay } = form;
    if (!title || !title.trim()) { setFormError("Enter a title for this booking."); return; }
    if (!resourceId) { setFormError("Choose a resource."); return; }
    const resource = resources.find((r) => r.id === resourceId);
    if (!resource) { setFormError("Choose a resource."); return; }
    if (!allDay && !periodId) { setFormError("Choose a period."); return; }
    const bookingGroupId = activeGroupId;

    const repeat = form.repeat || "none";
    let dates;

if (repeat === "none") {
  dates = [selectedDate];
} else {
  let repeatEndDate;

  if (
    form.repeatEndType === "term"
  ) {
    repeatEndDate =
      new Date(
        currentTerm.end +
        "T00:00:00"
      );
  } else {
    repeatEndDate =
      new Date(
        form.repeatEndDate +
        "T00:00:00"
      );
  }

  dates =
    computeRecurringDates(
      selectedDate,
      repeat,
      repeatEndDate
    );
}
    const recurrenceId = repeat === "none" ? null : uid();
    const pending = !!resource.requiresApproval && !isAdmin;
    const status = pending ? "pending" : "confirmed";

    const created = [];
    let skipped = 0;
    for (const d of dates) {
      const dk = toISODate(d);
      if (allDay) {
        const fits = periods.length === 0 || periods.every((p) => bookingsFor(resourceId, p.id, dk).length < (resource.slots || 1));
        if (!fits) { skipped++; continue; }
        created.push({
          id: uid(), resourceId, periodId: null, allDay: true, date: dk, title: title.trim(),
          bookedById: sessionUser.id, bookedBy: sessionUser.name, status, recurrenceId, groupId: bookingGroupId,
        });
      } else {
        const existing = bookingsFor(resourceId, periodId, dk);
        if (existing.length >= (resource.slots || 1)) { skipped++; continue; }
        created.push({
          id: uid(), resourceId, periodId, allDay: false, date: dk, title: title.trim(),
          bookedById: sessionUser.id, bookedBy: sessionUser.name, status, recurrenceId, groupId: bookingGroupId,
        });
      }
    }

    if (created.length === 0) {
      setFormError(dates.length > 1 ? "Every occurrence conflicted with an existing booking." : "No bookings left for this resource in that period.");
      return;
    }

    setBookings((prev) => [...prev, ...created]);
    runPersist(async () => {
      await api.insertBookings(created);
      await Promise.all(created.map((b) =>
        api.logEvent(b.id, "created", sessionUser.name, sessionUser.id, {
          resource: resource.name, date: b.date, allDay: b.allDay, status: b.status,
        })
      ));
    });

    const needsSummary = pending || skipped > 0 || repeat !== "none";
    if (needsSummary) {
      setCreateResult({ created: created.length, skipped, pending, recurring: repeat !== "none" });
    } else {
      closeModal();
    }
  }

  function cancelBooking(id) {
    const booking = bookings.find((b) => b.id === id);
    setBookings((prev) => prev.filter((b) => b.id !== id));
    runPersist(async () => {
      await api.deleteBookingRow(id);
      if (booking) await api.logEvent(id, "cancelled", sessionUser.name, sessionUser.id, { title: booking.title, date: booking.date });
    });
  }
  function cancelSeries(recurrenceId) {
    const group = bookings.filter((b) => b.recurrenceId === recurrenceId);
    setBookings((prev) => prev.filter((b) => b.recurrenceId !== recurrenceId));
    runPersist(async () => {
      await api.deleteBookingsByRecurrenceRow(recurrenceId);
      const first = group[0];
      if (first) await api.logEvent(first.id, "series_cancelled", sessionUser.name, sessionUser.id, { title: first.title, count: group.length });
    });
    closeModal();
  }

  function approveBooking(id) {
    const booking = bookings.find((b) => b.id === id);
    if (!booking || booking.status !== "pending") return;
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "confirmed" } : b));
    const resource = resources.find((r) => r.id === booking.resourceId);
    const period = periodsFor(booking.groupId || resource?.groupId).find((p) => p.id === booking.periodId);
    const when = booking.allDay ? "all day" : period ? period.label : "";
    pushNotification(booking.bookedById, "approved", `Approved: "${booking.title}" for ${resource?.name || "a resource"} on ${formatDateShort(booking.date)}${when ? ` (${when})` : ""}.`);
    runPersist(async () => {
      await api.updateBookingStatusRow(id, "confirmed");
      await api.logEvent(id, "approved", sessionUser.name, sessionUser.id, { resource: resource?.name, date: booking.date });
    });
  }
  function rejectBooking(id) {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    setBookings((prev) => prev.filter((b) => b.id !== id));
    const resource = resources.find((r) => r.id === booking.resourceId);
    const period = periodsFor(booking.groupId || resource?.groupId).find((p) => p.id === booking.periodId);
    const when = booking.allDay ? "all day" : period ? period.label : "";
    pushNotification(booking.bookedById, "rejected", `Declined: "${booking.title}" for ${resource?.name || "a resource"} on ${formatDateShort(booking.date)}${when ? ` (${when})` : ""}.`);
    runPersist(async () => {
      await api.deleteBookingRow(id);
      await api.logEvent(id, "rejected", sessionUser.name, sessionUser.id, { resource: resource?.name, date: booking.date });
    });
  }
  function approveSeries(recurrenceId) {
    const group = bookings.filter((b) => b.recurrenceId === recurrenceId && b.status === "pending");
    if (!group.length) return;
    setBookings((prev) => prev.map((b) => (b.recurrenceId === recurrenceId && b.status === "pending") ? { ...b, status: "confirmed" } : b));
    const first = group[0];
    const resource = resources.find((r) => r.id === first.resourceId);
    pushNotification(first.bookedById, "approved", `Approved: "${first.title}" for ${resource?.name || "a resource"} — ${group.length} occurrence${group.length === 1 ? "" : "s"}.`);
    runPersist(async () => {
      await api.updateBookingStatusForRecurrence(recurrenceId, "confirmed");
      await api.logEvent(first.id, "series_approved", sessionUser.name, sessionUser.id, { resource: resource?.name, count: group.length });
    });
  }
  function rejectSeries(recurrenceId) {
    const group = bookings.filter((b) => b.recurrenceId === recurrenceId && b.status === "pending");
    if (!group.length) return;
    setBookings((prev) => prev.filter((b) => !(b.recurrenceId === recurrenceId && b.status === "pending")));
    const first = group[0];
    const resource = resources.find((r) => r.id === first.resourceId);
    pushNotification(first.bookedById, "rejected", `Declined: "${first.title}" for ${resource?.name || "a resource"} — ${group.length} occurrence${group.length === 1 ? "" : "s"}.`);
    runPersist(async () => {
      await api.deletePendingByRecurrenceRow(recurrenceId);
      await api.logEvent(first.id, "series_rejected", sessionUser.name, sessionUser.id, { resource: resource?.name, count: group.length });
    });
  }

  function submitNewResource() {
    if (!newResourceName.trim()) { setResourcePanelError("Enter a resource name."); return; }
    if (!newResourceGroupId) { setResourcePanelError("Choose a group."); return; }
    const nr = {
      id: uid(), name: newResourceName.trim(), groupId: newResourceGroupId,
      slots: Math.max(1, Number(newResourceSlots) || 1),
      capacity: newResourceCapacity === "" ? null : Math.max(0, Number(newResourceCapacity) || 0),
      requiresApproval: !!newResourceApproval,
    };
    setResources((prev) => [...prev, nr]);
    runPersist(() => api.upsertResource(nr));
    setNewResourceName("");
    setNewResourceSlots(1);
    setNewResourceCapacity("");
    setNewResourceApproval(false);
    setResourcePanelError("");
  }
  function updateResource(id, field, value) {
    let updated = null;
    setResources((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      if (field === "slots") updated = { ...r, slots: Math.max(1, Number(value) || 1) };
      else if (field === "capacity") updated = { ...r, capacity: value === "" ? null : Math.max(0, Number(value) || 0) };
      else if (field === "requiresApproval") updated = { ...r, requiresApproval: !!value };
      else updated = { ...r, [field]: value };
      return updated;
    }));
    if (updated) runPersist(() => api.upsertResource(updated));
  }
  function deleteResource(id) {
    setResources((prev) => prev.filter((r) => r.id !== id));
    setBookings((prev) => prev.filter((b) => b.resourceId !== id));
    setPinnedIds((prev) => prev.filter((x) => x !== id));
    // resources → bookings cascades server-side via the foreign key in schema.sql
    runPersist(() => api.deleteResourceRow(id));
  }

  function addGroup() {
    const name = newGroupName.trim();
    if (!name) { setResourcePanelError("Enter a group name."); return; }
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      setResourcePanelError("A group with that name already exists.");
      return;
    }
    const newGroup = { id: uid(), name };
    setGroups((prev) => [...prev, newGroup]);
    setPeriodsByGroup((prev) => ({ ...prev, [newGroup.id]: [] }));
    if (!activeGroupId) setActiveGroupId(newGroup.id);
    setEditingGroupId(newGroup.id);
    setNewResourceGroupId(newGroup.id);
    runPersist(() => api.upsertGroup(newGroup));
    setNewGroupName("");
    setResourcePanelError("");
  }
  function updateGroupName(id, name) {
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, name } : g));
    runPersist(() => api.upsertGroup({ id, name }));
  }
  function removeGroup(id) {
    if (groups.length <= 1) { setResourcePanelError("At least one resource group must remain."); return; }
    const count = resources.filter((r) => r.groupId === id).length;
    const group = groups.find((g) => g.id === id);
    const proceed = count === 0 || window.confirm(`"${group?.name}" has ${count} resource${count === 1 ? "" : "s"}. Deleting the group will also delete ${count === 1 ? "it" : "them"} and any of their bookings. Continue?`);
    if (!proceed) return;
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setPeriodsByGroup((prev) => { const next = { ...prev }; delete next[id]; return next; });
    const resourceIdsInGroup = resources.filter((r) => r.groupId === id).map((r) => r.id);
    setResources((prev) => prev.filter((r) => r.groupId !== id));
    setBookings((prev) => prev.filter((b) => !resourceIdsInGroup.includes(b.resourceId)));
    setPinnedIds((prev) => prev.filter((x) => !resourceIdsInGroup.includes(x)));
    if (activeGroupId === id) {
      const remaining = groups.filter((g) => g.id !== id);
      setActiveGroupId(remaining[0]?.id);
    }
    if (editingGroupId === id) {
      const remaining = groups.filter((g) => g.id !== id);
      setEditingGroupId(remaining[0]?.id);
    }
    // periods, resources, and bookings for this group all cascade server-side via schema.sql foreign keys
    runPersist(() => api.deleteGroupRow(id));
    setResourcePanelError("");
  }

  function updateGroupPeriods(groupId, updater) {
    setPeriodsByGroup((prev) => {
      const next = updater(prev[groupId] || []);
      runPersist(() => api.replaceGroupPeriods(groupId, next));
      return { ...prev, [groupId]: next };
    });
  }
  function updatePeriod(groupId, id, field, value) {
    updateGroupPeriods(groupId, (arr) => arr.map((p) => p.id === id ? { ...p, [field]: value } : p));
  }
  function movePeriod(groupId, index, dir) {
    updateGroupPeriods(groupId, (arr) => {
      const a = [...arr];
      const ni = index + dir;
      if (ni < 0 || ni >= a.length) return arr;
      [a[index], a[ni]] = [a[ni], a[index]];
      return a;
    });
  }
  function blankPeriod() {
    return { id: uid(), label: "New block", type: "period", start: "09:00", end: "09:50" };
  }
  function addPeriod(groupId) {
    updateGroupPeriods(groupId, (arr) => [...arr, blankPeriod()]);
  }
  function insertPeriodAt(groupId, index) {
    updateGroupPeriods(groupId, (arr) => {
      const a = [...arr];
      a.splice(index + 1, 0, blankPeriod());
      return a;
    });
  }
  function removePeriod(groupId, id) {
    updateGroupPeriods(groupId, (arr) => arr.filter((p) => p.id !== id));
    setBookings((prev) => prev.filter((b) => b.periodId !== id));
    runPersist(() => api.deleteBookingsByPeriodRow(id));
  }

  function updateTerm(id, field, value) {
  setTerms((prev) =>
    prev.map((term) =>
      term.id === id
        ? {
            ...term,
            [field]: value,
          }
        : term
    )
  );

  // TODO - persist to Supabase later
}

  const canCancel = (b) => isAdmin || b.bookedById === sessionUser?.id;
  const detailed = viewMode === "Detailed";
  const rowH =
    window.innerWidth > 1600
      ? (detailed ? 52 : 38)
      : (detailed ? 68 : 44);

  if (!loaded) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", background: C.page, minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, color: C.inkSoft, borderRadius: 10, border: `1px solid ${C.border}` }}>
        <style>{FONT_IMPORT}</style>
        <Loader2 size={16} className="rb-spin" /> Loading schedule…
        <style>{".rb-spin { animation: rbspin 1s linear infinite; } @keyframes rbspin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.page, boxSizing: "border-box" }}>
        <style>{FONT_IMPORT}</style>
        <div style={{ width: 460, maxWidth: "100%", padding: 20, background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: 8 }}>
          <div style={{ color: C.danger, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Unable to load Resource Booking</div>
          <div style={{ color: C.danger, fontSize: 13, lineHeight: 1.6 }}>{loadError}</div>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 14, width: "100%", padding: "9px 12px", border: "none", borderRadius: 6, background: C.purpleBright, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Try again</button>
        </div>
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", background: C.page, minHeight: 460, borderRadius: 10, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{FONT_IMPORT}</style>
        <div style={{ width: 320, maxWidth: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.ink }}>Resource Booking</div>
            <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 3 }}>Sign in to view the booking calendar</div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
            <button
              onClick={signIn}
              style={{
                width: "100%",
                background: C.purpleBright,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "10px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Sign in with Microsoft 365
            </button>
            <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 10, lineHeight: 1.5 }}>
              Contact IT if you require access.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.page, boxSizing: "border-box" }}>
        <style>{FONT_IMPORT}</style>
        <div style={{ width: 440, maxWidth: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>Resource Booking has no setup data</div>
          <div style={{ marginTop: 8, color: C.inkSoft, fontSize: 13, lineHeight: 1.6 }}>Supabase connected successfully, but no resource groups or application users were returned.</div>
        </div>
      </div>
    );
  }


  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: C.page, color: C.ink, minHeight: "100vh", height: "100vh", borderRadius: 10, overflow: "hidden", position: "relative", border: `1px solid ${C.border}` }}>
      <style>{FONT_IMPORT}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: `1px solid ${C.border}`, background: "#fff", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 19, fontWeight: 700 }}>Resource Booking</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10.5, color: C.inkSoft, fontFamily: "'Inter', sans-serif", minWidth: 40, textAlign: "right" }}>
            {saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : ""}
          </span>
          {isAdmin && (
            <>
              <button onClick={() => { setEditingGroupId(activeGroupId); setModal({ mode: "timetable" }); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", color: C.ink }}>
                <Clock size={13} /> Edit timetable
              </button>
              <button onClick={() => { setResourcePanelError(""); setModal({ mode: "resources" }); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", color: C.ink }}>
                <Boxes size={13} /> Manage resources
              </button>
              <button onClick={() => setModal({ mode: "approvals" })} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", color: C.ink }}>
                <Inbox size={13} /> Approvals
                {pendingBookings.length > 0 && (
                  <span style={{ position: "absolute", top: -6, right: -6, background: C.danger, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 20, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                    {pendingBookings.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setModal({ mode: "terms" })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: "7px 10px",
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  color: C.ink
                }}
              >
                <Calendar size={13} />
                Term Dates
              </button>
            </>
          )}
          <button aria-label="Notifications" onClick={() => setModal({ mode: "notifications" })} style={{ position: "relative", ...iconBtnStyle() }}>
            <Bell size={14} />
            {myNotifications.length > 0 && (
              <span style={{ position: "absolute", top: -5, right: -5, background: C.danger, color: "#fff", fontSize: 9.5, fontWeight: 700, borderRadius: 20, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                {myNotifications.length}
              </span>
            )}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                {isAdmin && <ShieldCheck size={12} color="#966A1E" />} {sessionUser.name}
              </div>
              <div style={{ fontSize: 10, color: C.inkSoft }}>{isAdmin ? "Admin" : "Member"}</div>
            </div>
            <button aria-label="Switch user" onClick={signOut} style={iconBtnStyle()}><LogOut size={14} /></button>
          </div>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "clamp(180px, 15vw, 260px) minmax(0, 1fr)",
        height: "calc(100vh - 70px)",
        minHeight: 0,
      }}>
        <div style={{ width: "clamp(180px, 15vw, 260px)", borderRight: `1px solid ${C.border}`, background: "#fff", flexShrink: 0, paddingBottom: 16 }}>
          <button onClick={() => setGroupsOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderBottom: `1px solid ${C.border}`, cursor: "pointer", padding: "14px 16px", fontSize: 13, fontWeight: 600, color: C.ink }}>
            Resource groups {groupsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {groupsOpen && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {groups.map((g) => {
                const active = g.id === activeGroupId;
                return (
                  <button key={g.id} onClick={() => setActiveGroupId(g.id)} style={{ textAlign: "left", padding: "10px 16px", border: "none", cursor: "pointer", background: active ? C.purpleBright : "transparent", color: active ? "#fff" : C.ink, fontSize: 13, fontWeight: active ? 600 : 400 }}>
                    {g.name}
                  </button>
                );
              })}
              {isAdmin && (
                <button onClick={() => { setResourcePanelError(""); setModal({ mode: "resources" }); }} style={{ display: "flex", alignItems: "center", gap: 6, textAlign: "left", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 12.5, color: C.purple }}>
                  <Plus size={13} /> Add / manage resources
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: C.toolbar, borderBottom: `1px solid ${C.border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 15.5, fontWeight: 600 }}>
              Daily booking view for {groups.find((g) => g.id === activeGroupId)?.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
              <button aria-label="Previous day" onClick={() => setSelectedDate((d) => addDays(d, -1))} style={{ ...toolBtn(), padding: "7px 9px" }}><ChevronLeft size={14} /></button>
              <div
  ref={datePickerRef}
  style={{
    position: "relative"
  }}
>
  <button
    type="button"
    onClick={() =>
      setShowDatePicker(
        (prev) => !prev
      )
    }
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      border: `1px solid ${C.purple}`,
      borderRadius: 6,
      padding: "7px 12px",
      fontSize: 13,
      fontWeight: 500,
      color: C.purple,
      background: "#fff",
      cursor: "pointer"
    }}
  >
    <Calendar size={14} />
{formatDate(selectedDate)}

{currentTerm && (
  <span
    style={{
      marginLeft: 6,
      padding: "2px 8px",
      borderRadius: 12,
      background: C.lavender,
      color: C.purpleDeep,
      fontSize: 11,
      fontWeight: 600,
    }}
  >
    {currentTerm.name}
  </span>
)}
  </button>

  {showDatePicker && (
    <div
      style={{
        position: "absolute",
        top: "110%",
        left: 0,
        zIndex: 100,
        background: "#fff",
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 12,
        minWidth: 220,
        boxShadow:
          "0 8px 24px rgba(31,36,48,0.12)"
      }}
    >
      <input
        type="date"
        value={toDateInputValue(
          selectedDate
        )}
        onChange={(e) => {
          setSelectedDate(
            new Date(
              e.target.value +
              "T00:00:00"
            )
          );

          setShowDatePicker(false);
        }}
        style={fieldStyle()}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginTop: 10
        }}
      >
        <button
          onClick={() => {
            setSelectedDate(
              new Date()
            );
            setShowDatePicker(false);
          }}
          style={toolBtn()}
        >
          Today
        </button>

        <button
          onClick={() => {
            setSelectedDate(
              addDays(new Date(), 1)
            );
            setShowDatePicker(false);
          }}
          style={toolBtn()}
        >
          Tomorrow
        </button>

        <button
          onClick={() => {
            setSelectedDate(
              addDays(new Date(), 7)
            );
            setShowDatePicker(false);
          }}
          style={toolBtn()}
        >
          Next Week
        </button>
      </div>
    </div>
  )}
</div>
              <button aria-label="Next day" onClick={() => setSelectedDate((d) => addDays(d, 1))} style={{ ...toolBtn(), padding: "7px 9px" }}><ChevronRight size={14} /></button>
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.purple}`, borderRadius: 6, padding: "7px 12px", background: "#fff" }}>
                  <Search size={13} color={C.purple} />
                  <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search for resource" style={{ border: "none", outline: "none", fontSize: 13, color: C.purple, width: "clamp(150px, 20vw, 320px)", background: "transparent" }} />
                </div>
                {searchMatches.length > 0 && (
                  <div style={{ position: "absolute", top: "110%", left: 0, right: 0, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6, boxShadow: "0 8px 20px rgba(31,36,48,0.12)", zIndex: 10, overflow: "hidden" }}>
                    {searchMatches.map((r) => (
                      <button key={r.id} onClick={() => { setPinnedIds((prev) => [...prev, r.id]); setSearchText(""); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 13, border: "none", background: "none", cursor: "pointer", color: C.ink }}>
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setPinnedIds([])} style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEEDF1", border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 13, fontWeight: 500, color: C.ink, cursor: "pointer" }}>
                <RotateCcw size={13} /> Deselect all
              </button>
              <button onClick={() => openCreateModal(visibleResources[0]?.id, periods[0]?.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: C.purpleBright, border: "none", borderRadius: 6, padding: "8px 13px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                <CalendarPlus size={14} /> Create booking
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "10px 20px", borderBottom: `1px solid ${C.border}` }}>
            <Info size={15} color={C.inkSoft} />
            <div style={{ display: "flex", border: `1px solid ${C.purple}`, borderRadius: 6, overflow: "hidden" }}>
              <button onClick={() => setViewMode("Compact")} style={{ padding: "6px 14px", fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer", background: viewMode === "Compact" ? C.purpleBright : "#fff", color: viewMode === "Compact" ? "#fff" : C.purple }}>Compact</button>
              <button onClick={() => setViewMode("Detailed")} style={{ padding: "6px 14px", fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer", background: viewMode === "Detailed" ? C.purpleBright : "#fff", color: viewMode === "Detailed" ? "#fff" : C.purple }}>Detailed</button>
            </div>
          </div>

          <div style={{ overflow: "auto", height: "calc(100vh - 220px)", minHeight: 0 }}>
            {visibleResources.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: C.inkSoft, fontSize: 13 }}>
                No resources selected. Search above to add one, or choose a group on the left.
              </div>
            ) : (
              <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", minWidth: Math.max(640, 150 + visibleResources.length * 140) }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", top: 0, left: 0, zIndex: 30, background: "#fff", width: 150, borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }} />
                    {visibleResources.map((r) => (
                      <th key={r.id} style={{ position: "sticky", top: 0, zIndex: 20, background: "#fff", borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, padding: "12px 14px", textAlign: "center", minWidth: 140, verticalAlign: "top" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.name}</span>
                          {isAdmin && (
                            <button aria-label={`Remove ${r.name}`} onClick={() => deleteResource(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        {detailed && !!r.capacity && (
                          <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 2 }}>Fits up to {r.capacity} people</div>
                        )}
                        {detailed && r.requiresApproval && (
                          <div style={{ fontSize: 10, color: C.pendingText, marginTop: 2, fontWeight: 600 }}>Requires approval</div>
                        )}
                        <button onClick={() => setModal({ mode: "week", resourceId: r.id })} style={{ background: "none", border: "none", cursor: "pointer", color: C.purple, fontSize: 11.5, textDecoration: "underline", marginTop: 4, padding: 0 }}>
                          View week
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <td style={{ position: "sticky", left: 0, zIndex: 10, borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: "0 14px", height: rowH, background: periodColors(p).bg, color: periodColors(p).text, verticalAlign: "middle" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.label}</div>
                        <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 1 }}>
                          {formatTime12(p.start)} – {formatTime12(p.end)}
                        </div>
                      </td>
                      {visibleResources.map((r) => {
                        const cellBookings = bookingsFor(r.id, p.id, dateKey);
                        const remaining = (r.slots || 1) - cellBookings.length;
                        return (
                          <td key={r.id + p.id} onClick={() => { if (remaining > 0) openCreateModal(r.id, p.id); }} style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, padding: 6, height: rowH, verticalAlign: "top", cursor: remaining > 0 ? "pointer" : "default" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, height: "100%" }}>
                              {cellBookings.map((b) => {
                                const isPending = b.status === "pending";
                                return (
                                  <div key={b.id} onClick={(e) => { e.stopPropagation(); openViewModal(r.id, p.id); }} style={{
                                    background: isPending ? C.pendingBg : C.lavender,
                                    borderLeft: `3px solid ${isPending ? C.pendingBorder : C.purpleDeep}`,
                                    borderRadius: "0 4px 4px 0", padding: "4px 8px", cursor: "pointer",
                                  }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: isPending ? C.pendingText : C.purpleDeep, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.bookedBy}</div>
                                    {detailed && b.title && b.title !== b.bookedBy && (
                                      <div style={{ fontSize: 10.5, color: isPending ? C.pendingText : C.purple, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</div>
                                    )}
                                    {(isPending || b.allDay) && (
                                      <div style={{ display: "flex", gap: 5, marginTop: 1 }}>
                                        {b.allDay && <span style={{ fontSize: 9.5, fontWeight: 700, color: isPending ? C.pendingText : C.purpleDeep, textTransform: "uppercase", letterSpacing: "0.03em" }}>All day</span>}
                                        {isPending && <span style={{ fontSize: 9.5, fontWeight: 700, color: C.pendingText, textTransform: "uppercase", letterSpacing: "0.03em" }}>Pending</span>}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {detailed && <div style={{ fontSize: 10, color: C.inkSoft, padding: "0 4px" }}>{remaining} booking{remaining === 1 ? "" : "s"} left</div>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modal?.mode === "create" && (() => {
        const selectedResource = resources.find((r) => r.id === form.resourceId);
        const showApprovalNote = selectedResource?.requiresApproval && !isAdmin;
        return (
          <Modal onClose={closeModal} title="Create booking">
            {createResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13.5, background: C.successBg, color: C.successText, borderRadius: 6, padding: "10px 12px", lineHeight: 1.5 }}>
                  Created {createResult.created} booking{createResult.created === 1 ? "" : "s"}
                  {createResult.recurring ? " in the series" : ""}.
                  {createResult.skipped > 0 && ` ${createResult.skipped} occurrence${createResult.skipped === 1 ? "" : "s"} skipped due to conflicts.`}
                  {createResult.pending && " Awaiting admin approval — you'll get a notification once it's reviewed."}
                </div>
                <button onClick={closeModal} style={{ background: C.purpleBright, color: "#fff", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Done</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle()}>Resource</label>
                  <select value={form.resourceId} onChange={(e) => setForm((f) => ({ ...f, resourceId: e.target.value }))} style={fieldStyle()}>
                    {resources.map((r) => <option key={r.id} value={r.id}>{r.name}{r.capacity ? ` — fits ${r.capacity}` : ""}{r.requiresApproval ? " (needs approval)" : ""}</option>)}
                  </select>
                </div>
                {showApprovalNote && (
                  <div style={{ fontSize: 12, background: C.pendingBg, color: C.pendingText, borderRadius: 6, padding: "8px 10px", lineHeight: 1.5 }}>
                    This resource requires admin approval. Your booking will be held as pending until it's reviewed.
                  </div>
                )}
                {selectedResource && selectedResource.groupId !== activeGroupId && (
                  <div style={{ fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
                    This resource belongs to another group — it'll be booked using {groups.find((g) => g.id === activeGroupId)?.name}'s timetable shown here.
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: C.ink, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!form.allDay} onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))} style={{ width: 15, height: 15, cursor: "pointer" }} />
                  All day (blocks every period on this date)
                </label>
                {!form.allDay && (
                  <div>
                    <label style={labelStyle()}>Period</label>
                    <select value={form.periodId} onChange={(e) => setForm((f) => ({ ...f, periodId: e.target.value }))} style={fieldStyle()}>
                      {periods.map((p) => <option key={p.id} value={p.id}>{p.label} ({formatTime12(p.start)} – {formatTime12(p.end)})</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={labelStyle()}>Title</label>
                  <input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. 11MSA / 11MSB" style={fieldStyle()} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle()}>Repeat</label>
                    <select value={form.repeat || "none"} onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))} style={fieldStyle()}>
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  {form.repeat !== "none" && (
  <div style={{ flex: 1 }}>
    <label style={labelStyle()}>
      Repeat Until
    </label>

    <select
      value={form.repeatEndType}
      onChange={(e) =>
        setForm((f) => ({
          ...f,
          repeatEndType: e.target.value,
        }))
      }
      style={fieldStyle()}
    >
      <option value="term">
        End of {currentTerm?.name || "Current Term"}
      </option>

      <option value="date">
        Specific Date
      </option>
    </select>
  </div>
)}
                </div>
                {form.repeatEndType === "date" &&
 form.repeat !== "none" && (
  <div>
    <label style={labelStyle()}>
      End Date
    </label>

    <input
      type="date"
      value={form.repeatEndDate}
      onChange={(e) =>
        setForm((f) => ({
          ...f,
          repeatEndDate: e.target.value,
        }))
      }
      style={fieldStyle()}
    />
  </div>
)}
                {form.repeatEndType === "term" &&
 currentTerm &&
 form.repeat !== "none" && (
  <div
    style={{
      fontSize: 11,
      color: C.inkSoft,
    }}
  >
    Repeats until the end of
    {" "}
    {currentTerm.name}
    {" "}
    ({formatDateShort(currentTerm.end)})
  </div>
)}
                {form.repeat && form.repeat !== "none" && (
                  <div style={{ fontSize: 11, color: C.inkSoft }}>
                    <RepeatIcon size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                    Creates {Math.min(52, Math.max(2, Number(form.occurrences) || 2))} bookings, one every {form.repeat === "weekly" ? "week" : "day"}, starting {formatDate(selectedDate)}.
                  </div>
                )}
                <div style={{ fontSize: 12, color: C.inkSoft }}>
                  Booking as {sessionUser.name} · {formatDate(selectedDate)}
                </div>
                {formError && <div style={{ fontSize: 12.5, color: C.danger, background: C.dangerBg, padding: "8px 10px", borderRadius: 5 }}>{formError}</div>}
                <button onClick={submitBooking} style={{ marginTop: 4, background: C.purpleBright, color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                  {form.repeat && form.repeat !== "none" ? "Create recurring booking" : "Confirm booking"}
                </button>
              </div>
            )}
          </Modal>
        );
      })()}

      {modal?.mode === "view" && (() => {
        const list = bookingsFor(modal.resourceId, modal.periodId, dateKey);
        const resource = resources.find((r) => r.id === modal.resourceId);
        const period = periods.find((p) => p.id === modal.periodId);
        return (
          <Modal onClose={closeModal} title={`${resource?.name} · ${period?.label}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11.5, color: C.inkSoft }}>
                {formatTime12(period?.start)} – {formatTime12(period?.end)}
              </div>
              {list.map((b) => {
                const isPending = b.status === "pending";
                const seriesCount = b.recurrenceId ? bookings.filter((x) => x.recurrenceId === b.recurrenceId).length : 1;
                return (
                  <div key={b.id} style={{ border: `1px solid ${isPending ? C.pendingBorder : C.border}`, borderRadius: 6, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{b.title}</div>
                      {b.allDay && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: C.purpleDeep, background: C.lavender, borderRadius: 20, padding: "2px 7px" }}>
                          All day
                        </span>
                      )}
                      {isPending && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: C.pendingText, background: C.pendingBg, borderRadius: 20, padding: "2px 7px" }}>
                          Pending approval
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>Booked by {b.bookedBy}</div>
                    {b.recurrenceId && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Part of a recurring booking ({seriesCount} occurrence{seriesCount === 1 ? "" : "s"}).</div>}

                    {isAdmin && isPending && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button onClick={() => approveBooking(b.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.successBg, color: C.successText, border: "none", borderRadius: 6, padding: "7px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                          <Check size={13} /> Approve
                        </button>
                        <button onClick={() => rejectBooking(b.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.dangerBg, color: C.danger, border: "none", borderRadius: 6, padding: "7px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                          <X size={13} /> Reject
                        </button>
                      </div>
                    )}

                    {canCancel(b) ? (
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button onClick={() => cancelBooking(b.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.dangerBg, color: C.danger, border: "none", borderRadius: 6, padding: "7px 10px", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
                          <Trash2 size={13} /> Cancel this booking
                        </button>
                        {b.recurrenceId && (
                          <button onClick={() => cancelSeries(b.recurrenceId)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", color: C.ink }}>
                            Cancel entire series
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>Only {b.bookedBy} or an admin can cancel this booking.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Modal>
        );
      })()}

      {modal?.mode === "week" && (() => {
        const resource = resources.find((r) => r.id === modal.resourceId);
        const weekPeriods = periodsFor(resource?.groupId || activeGroupId);
        const weekStart = getWeekStart(selectedDate);
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        return (
          <Modal onClose={closeModal} title={`Week view · ${resource?.name}`} width={720}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 660 }}>
                <thead>
                  <tr>
                    <th style={{ width: 110, borderBottom: `1px solid ${C.border}` }} />
                    {days.map((d) => (
                      <th key={toISODate(d)} style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, padding: "6px 8px", fontSize: 11.5, fontWeight: 600 }}>{formatShort(d)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekPeriods.map((p) => (
                    <tr key={p.id}>
                      <td style={{ borderBottom: `1px solid ${C.border}`, padding: "6px 8px", background: periodColors(p).bg, color: periodColors(p).text }}>
                        <div style={{ fontSize: 11.5, fontWeight: 500 }}>{p.label}</div>
                        <div style={{ fontSize: 10, opacity: 0.85 }}>{formatTime12(p.start)}–{formatTime12(p.end)}</div>
                      </td>
                      {days.map((d) => {
                        const iso = toISODate(d);
                        const items = bookings.filter((b) => b.resourceId === modal.resourceId && b.date === iso && (b.allDay || b.periodId === p.id));
                        return (
                          <td key={iso} style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, padding: 4, fontSize: 10.5, verticalAlign: "top" }}>
                            {items.map((b) => (
                              <div key={b.id} style={{ background: b.status === "pending" ? C.pendingBg : C.lavender, color: b.status === "pending" ? C.pendingText : C.purpleDeep, borderRadius: 4, padding: "2px 5px", marginBottom: 2, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {b.allDay ? "All day: " : ""}{b.title}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modal>
        );
      })()}

      {modal?.mode === "timetable" && isAdmin && (() => {
        const editPeriods = periodsFor(editingGroupId);

        return (
          <Modal onClose={closeModal} title="Edit timetable" width={780}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1fr) auto",
                  gap: 12,
                  alignItems: "end",
                }}
              >
                <div>
                  <label style={labelStyle()}>Resource group</label>
                  <select
                    value={editingGroupId || ""}
                    onChange={(e) => setEditingGroupId(e.target.value)}
                    style={fieldStyle()}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    minWidth: 150,
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: C.toolbar,
                    border: `1px solid ${C.border}`,
                    color: C.inkSoft,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  {editPeriods.length} block{editPeriods.length === 1 ? "" : "s"}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  maxHeight: "58vh",
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {editPeriods.map((p, i) => {
                  const isBreak = p.type === "break";

                  return (
                    <React.Fragment key={p.id}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "34px minmax(180px, 1fr) 110px 112px 20px 112px 34px",
                          gap: 8,
                          alignItems: "center",
                          padding: 10,
                          borderRadius: 8,
                          background: isBreak ? "#FFF8E8" : "#FFFFFF",
                          border: `1px solid ${isBreak ? C.break : C.border}`,
                          boxShadow: "0 1px 2px rgba(31,36,48,0.04)",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <button
                            type="button"
                            aria-label={`Move ${p.label} up`}
                            title="Move up"
                            disabled={i === 0}
                            onClick={() => movePeriod(editingGroupId, i, -1)}
                            style={{
                              ...iconBtnStyle(),
                              width: 30,
                              height: 26,
                              opacity: i === 0 ? 0.35 : 1,
                              cursor: i === 0 ? "default" : "pointer",
                            }}
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${p.label} down`}
                            title="Move down"
                            disabled={i === editPeriods.length - 1}
                            onClick={() => movePeriod(editingGroupId, i, 1)}
                            style={{
                              ...iconBtnStyle(),
                              width: 30,
                              height: 26,
                              opacity: i === editPeriods.length - 1 ? 0.35 : 1,
                              cursor: i === editPeriods.length - 1 ? "default" : "pointer",
                            }}
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>

                        <div>
                          <label style={labelStyle()}>Label</label>
                          <input
                            value={p.label}
                            onChange={(e) => updatePeriod(editingGroupId, p.id, "label", e.target.value)}
                            style={fieldStyle()}
                          />
                        </div>

                        <div>
                          <label style={labelStyle()}>Type</label>
                          <select
                            value={p.type}
                            onChange={(e) => updatePeriod(editingGroupId, p.id, "type", e.target.value)}
                            style={fieldStyle()}
                          >
                            <option value="period">Period</option>
                            <option value="break">Break</option>
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle()}>Start</label>
                          <input
                            type="time"
                            value={p.start}
                            onChange={(e) => updatePeriod(editingGroupId, p.id, "start", e.target.value)}
                            style={fieldStyle()}
                          />
                        </div>

                        <div
                          aria-hidden="true"
                          style={{
                            marginTop: 19,
                            textAlign: "center",
                            color: C.inkSoft,
                            fontSize: 14,
                          }}
                        >
                          →
                        </div>

                        <div>
                          <label style={labelStyle()}>End</label>
                          <input
                            type="time"
                            value={p.end}
                            onChange={(e) => updatePeriod(editingGroupId, p.id, "end", e.target.value)}
                            style={fieldStyle()}
                          />
                        </div>

                        <button
                          type="button"
                          aria-label={`Remove ${p.label}`}
                          title="Remove block"
                          onClick={() => removePeriod(editingGroupId, p.id)}
                          style={{
                            ...iconBtnStyle(),
                            marginTop: 19,
                            color: C.danger,
                            borderColor: "transparent",
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => insertPeriodAt(editingGroupId, i)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          width: "100%",
                          minHeight: 30,
                          marginTop: -4,
                          background: "#FCFAFE",
                          border: `1px dashed ${C.lavenderBorder}`,
                          borderRadius: 6,
                          color: C.purple,
                          fontSize: 11.5,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={12} /> Add block here
                      </button>
                    </React.Fragment>
                  );
                })}

                {editPeriods.length === 0 && (
                  <div
                    style={{
                      padding: "28px 18px",
                      border: `1px dashed ${C.lavenderBorder}`,
                      borderRadius: 8,
                      background: "#FCFAFE",
                      textAlign: "center",
                      color: C.inkSoft,
                      fontSize: 12.5,
                    }}
                  >
                    No timetable blocks have been created for this resource group.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => addPeriod(editingGroupId)}
                disabled={!editingGroupId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  width: "100%",
                  padding: "10px 14px",
                  background: C.purpleBright,
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: editingGroupId ? "pointer" : "default",
                  opacity: editingGroupId ? 1 : 0.5,
                }}
              >
                <Plus size={14} /> Add block at end
              </button>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  background: C.toolbar,
                  color: C.inkSoft,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                Periods use a white row and breaks use an amber row. Changes are saved automatically and apply to everyone using this resource group.
              </div>
            </div>
          </Modal>
        );
      })()}

      {modal?.mode === "resources" && isAdmin && (
        <Modal onClose={closeModal} title="Manage resources & groups" width={560}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={labelStyle()}>Resource groups</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {groups.map((g) => {
                  const count = resources.filter((r) => r.groupId === g.id).length;
                  return (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input value={g.name} onChange={(e) => updateGroupName(g.id, e.target.value)} style={{ ...fieldStyle(), flex: 1, fontSize: 13 }} />
                      <span style={{ fontSize: 11, color: C.inkSoft, minWidth: 70, textAlign: "right" }}>{count} resource{count === 1 ? "" : "s"}</span>
                      <button aria-label={`Delete ${g.name}`} onClick={() => removeGroup(g.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: 4 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="New group name" style={{ ...fieldStyle(), flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") addGroup(); }} />
                <button onClick={addGroup} style={{ background: C.purpleBright, color: "#fff", border: "none", borderRadius: 6, padding: "0 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Add</button>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <label style={labelStyle()}>Resources</label>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 540 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 46px 56px 74px 26px", gap: 6, fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.03em", padding: "0 2px 4px" }}>
                    <span>Name</span>
                    <span>Group</span>
                    <span title="Concurrent bookings per period">Slots</span>
                    <span title="How many people it fits">Capacity</span>
                    <span title="Requires admin approval before it's confirmed">Approval</span>
                    <span />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                    {resources.map((r) => (
                      <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 110px 46px 56px 74px 26px", gap: 6, alignItems: "center" }}>
                        <input value={r.name} onChange={(e) => updateResource(r.id, "name", e.target.value)} style={{ ...fieldStyle(), fontSize: 12.5, padding: "6px 8px" }} />
                        <select value={r.groupId} onChange={(e) => updateResource(r.id, "groupId", e.target.value)} style={{ ...fieldStyle(), fontSize: 12, padding: "6px 6px" }}>
                          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <input type="number" min={1} value={r.slots || 1} onChange={(e) => updateResource(r.id, "slots", e.target.value)} title="Concurrent bookings per period" style={{ ...fieldStyle(), fontSize: 12, padding: "6px 4px" }} />
                        <input type="number" min={0} value={r.capacity ?? ""} onChange={(e) => updateResource(r.id, "capacity", e.target.value)} placeholder="—" title="How many people it fits" style={{ ...fieldStyle(), fontSize: 12, padding: "6px 4px" }} />
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <input type="checkbox" checked={!!r.requiresApproval} onChange={(e) => updateResource(r.id, "requiresApproval", e.target.checked)} title="Requires admin approval before it's confirmed" style={{ width: 16, height: 16, cursor: "pointer" }} />
                        </div>
                        <button aria-label={`Delete ${r.name}`} onClick={() => deleteResource(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 46px 56px 74px 26px", gap: 6, marginTop: 10 }}>
                    <input value={newResourceName} onChange={(e) => setNewResourceName(e.target.value)} placeholder="New resource name" style={{ ...fieldStyle(), fontSize: 12.5, padding: "6px 8px" }} onKeyDown={(e) => { if (e.key === "Enter") submitNewResource(); }} />
                    <select value={newResourceGroupId} onChange={(e) => setNewResourceGroupId(e.target.value)} style={{ ...fieldStyle(), fontSize: 12, padding: "6px 6px" }}>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <input type="number" min={1} value={newResourceSlots} onChange={(e) => setNewResourceSlots(e.target.value)} title="Concurrent bookings per period" style={{ ...fieldStyle(), fontSize: 12, padding: "6px 4px" }} />
                    <input type="number" min={0} value={newResourceCapacity} onChange={(e) => setNewResourceCapacity(e.target.value)} placeholder="—" title="How many people it fits" style={{ ...fieldStyle(), fontSize: 12, padding: "6px 4px" }} />
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <input type="checkbox" checked={newResourceApproval} onChange={(e) => setNewResourceApproval(e.target.checked)} title="Requires admin approval before it's confirmed" style={{ width: 16, height: 16, cursor: "pointer" }} />
                    </div>
                    <div />
                  </div>
                </div>
              </div>
              <button onClick={submitNewResource} style={{ marginTop: 8, width: "100%", background: C.purpleBright, color: "#fff", border: "none", borderRadius: 6, padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Add resource
              </button>
              <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 6 }}>Slots set how many concurrent bookings a resource allows per period. Approval-required resources hold bookings from members as "pending" until an admin confirms them.</div>
            </div>

            {resourcePanelError && <div style={{ fontSize: 12, color: C.danger, background: C.dangerBg, borderRadius: 5, padding: "8px 10px" }}>{resourcePanelError}</div>}
          </div>
        </Modal>
      )}

      {modal?.mode === "terms" && isAdmin && (
  <Modal
    onClose={closeModal}
    title="Manage Term Dates"
    width={600}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {terms.map((term) => (
        <div
          key={term.id}
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            {term.name}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <label style={labelStyle()}>
                Start Date
              </label>

              <input
                type="date"
                value={term.start}
                onChange={(e) =>
                  updateTerm(
                    term.id,
                    "start",
                    e.target.value
                  )
                }
                style={fieldStyle()}
              />
            </div>

            <div>
              <label style={labelStyle()}>
                End Date
              </label>

              <input
                type="date"
                value={term.end}
                onChange={(e) =>
                  updateTerm(
                    term.id,
                    "end",
                    e.target.value
                  )
                }
                style={fieldStyle()}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  </Modal>
)}

      {modal?.mode === "approvals" && isAdmin && (() => {
        const groupedIds = new Set();
        const rows = [];
        for (const b of pendingBookings) {
          if (b.recurrenceId) {
            if (groupedIds.has(b.recurrenceId)) continue;
            groupedIds.add(b.recurrenceId);
            const group = pendingBookings.filter((x) => x.recurrenceId === b.recurrenceId);
            rows.push({ type: "group", recurrenceId: b.recurrenceId, items: group });
          } else {
            rows.push({ type: "single", item: b });
          }
        }
        return (
          <Modal onClose={closeModal} title="Pending approvals" width={520}>
            {rows.length === 0 ? (
              <div style={{ fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "20px 0" }}>Nothing waiting on approval.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map((row) => {
                  const items = row.type === "group" ? row.items : [row.item];
                  return (
                    <div key={row.type === "group" ? row.recurrenceId : row.item.id} style={{ border: `1px solid ${C.pendingBorder}`, borderRadius: 6, overflow: "hidden" }}>
                      {row.type === "group" && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: C.pendingBg }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: C.pendingText }}>Recurring series — {items.length} occurrence{items.length === 1 ? "" : "s"}</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => approveSeries(row.recurrenceId)} style={{ display: "flex", alignItems: "center", gap: 4, background: C.successBg, color: C.successText, border: "none", borderRadius: 5, padding: "4px 9px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                              <Check size={12} /> Approve all
                            </button>
                            <button onClick={() => rejectSeries(row.recurrenceId)} style={{ display: "flex", alignItems: "center", gap: 4, background: C.dangerBg, color: C.danger, border: "none", borderRadius: 5, padding: "4px 9px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                              <X size={12} /> Reject all
                            </button>
                          </div>
                        </div>
                      )}
                      {items.map((b) => {
                        const resource = resources.find((r) => r.id === b.resourceId);
                        const period = periodsFor(b.groupId || resource?.groupId).find((p) => p.id === b.periodId);
                        return (
                          <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 10px", borderTop: row.type === "group" ? `1px solid ${C.border}` : "none" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</div>
                              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 1 }}>
                                {resource?.name} · {formatDateShort(b.date)} · {b.allDay ? "All day" : period?.label} · requested by {b.bookedBy}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              <button aria-label="Approve" onClick={() => approveBooking(b.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: C.successBg, color: C.successText, border: "none", borderRadius: 6, cursor: "pointer" }}>
                                <Check size={14} />
                              </button>
                              <button aria-label="Reject" onClick={() => rejectBooking(b.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: C.dangerBg, color: C.danger, border: "none", borderRadius: 6, cursor: "pointer" }}>
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </Modal>
        );
      })()}

      {modal?.mode === "notifications" && (
        <Modal onClose={closeModal} title="Notifications" width={400}>
          {myNotifications.length === 0 ? (
            <div style={{ fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "20px 0" }}>Nothing new.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={clearMyNotifications} style={{ alignSelf: "flex-end", background: "none", border: "none", color: C.purple, fontSize: 11.5, cursor: "pointer", padding: 0 }}>Clear all</button>
              {myNotifications.map((n) => (
                <div key={n.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 10px", borderRadius: 6,
                  background: n.type === "approved" ? C.successBg : C.dangerBg,
                }}>
                  {n.type === "approved" ? <Check size={14} color={C.successText} style={{ marginTop: 1, flexShrink: 0 }} /> : <X size={14} color={C.danger} style={{ marginTop: 1, flexShrink: 0 }} />}
                  <div style={{ flex: 1, fontSize: 12.5, color: n.type === "approved" ? C.successText : C.danger, lineHeight: 1.4 }}>{n.message}</div>
                  <button aria-label="Dismiss" onClick={() => dismissNotification(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.6, flexShrink: 0, padding: 0 }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
