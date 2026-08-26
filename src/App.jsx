import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Bell, Boxes, Calendar, CalendarPlus, Check, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, Clock, Inbox, Info, Loader2, LogOut,
  Plus, Repeat as RepeatIcon, RotateCcw, Search, ShieldCheck, Trash2, X,
} from "lucide-react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import * as api from "./lib/api";
import { loginRequest } from "./authConfig";

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');";
const C = {
  purple: "#5B2A86", purpleDeep: "#4C1D78", purpleBright: "#7C2FC9",
  lavender: "#F3E9FB", lavenderBorder: "#D9C3EF", ink: "#1F2430",
  inkSoft: "#68707E", border: "#E4E3EA", toolbar: "#F7F6FA", page: "#FFFFFF",
  break: "#F6DDAE", breakText: "#8A6A2E", danger: "#B0402E", dangerBg: "#FBEAE6",
  successBg: "#E9F5EC", successText: "#276B3E", pendingBg: "#FDF3E1",
  pendingBorder: "#C99A3C", pendingText: "#8A6A2E",
};
const DEFAULT_TERMS = [1, 2, 3, 4].map((n) => ({ id: `term${n}`, name: `Term ${n}`, start: "", end: "" }));

function pad(n) { return String(n).padStart(2, "0"); }
function uid() { return crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10); }
function addDays(date, count) { const next = new Date(date); next.setDate(next.getDate() + count); return next; }
function toISODate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function toDateInputValue(date) { return toISODate(date); }
function formatDate(date) { return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
function formatShort(date) { return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); }
function formatDateShort(iso) { return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
function formatTime12(value) {
  if (!value?.includes(":")) return "";
  const [hours, minutes] = value.split(":");
  const hour = Number(hours);
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}
function formatTime(date) { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function getWeekStart(date) { const result = new Date(date); result.setDate(result.getDate() + (result.getDay() === 0 ? -6 : 1 - result.getDay())); return result; }
function getGroupList(value) { return (value || "").split(",").map((item) => item.trim()).filter(Boolean); }
function getCurrentTerm(date, terms) {
  const iso = toISODate(date);
  return terms.find((term) => term.start && term.end && iso >= term.start && iso <= term.end);
}
function periodColours(period) { return period.type === "break" ? { bg: C.break, text: C.breakText } : { bg: "#fff", text: C.ink }; }
function fieldStyle() { return { width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "'Inter',sans-serif", color: C.ink, background: "#FCFCFD", boxSizing: "border-box", outline: "none" }; }
function labelStyle() { return { display: "block", marginBottom: 5, color: C.inkSoft, fontSize: 11, fontWeight: 600, letterSpacing: ".03em", textTransform: "uppercase" }; }
function toolBtn() { return { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 11px", border: `1px solid ${C.purple}`, borderRadius: 6, background: "#fff", color: C.purple, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }; }
function iconBtnStyle() { return { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}`, borderRadius: 6, background: "#fff", color: C.ink, cursor: "pointer" }; }

function Modal({ children, onClose, title, width = 440 }) {
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(31,36,48,.45)" }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: `min(${width}px,94vw)`, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 8, background: C.page, boxShadow: "0 16px 40px rgba(31,36,48,.3)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: `1px solid ${C.border}` }}>
        <strong style={{ fontSize: 15 }}>{title}</strong>
        <button onClick={onClose} style={{ ...iconBtnStyle(), border: "none" }}><X size={17} /></button>
      </div>
      <div style={{ padding: 18, overflowY: "auto" }}>{children}</div>
    </div>
  </div>;
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
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [templates, setTemplates] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sessionUser, setSessionUser] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState("Detailed");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: "", repeat: "none", repeatEndType: "term", repeatEndDate: "" });
  const [formError, setFormError] = useState("");
  const [createResult, setCreateResult] = useState(null);
  const [resourcePanelError, setResourcePanelError] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [generatorStartTime, setGeneratorStartTime] = useState("08:40");
  const [generatorBlockLength, setGeneratorBlockLength] = useState(50);
  const [generatorBreakLength, setGeneratorBreakLength] = useState(20);
  const [generatorPeriods, setGeneratorPeriods] = useState(6);
  const [autoInsertBreaks, setAutoInsertBreaks] = useState(true);
  const datePickerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [data, termData, templateData] = await Promise.all([api.loadAll(), api.loadTerms(), api.loadTemplates()]);
        if (cancelled) return;
        const loadedGroups = data.groups ?? [];
        const firstGroupId = loadedGroups[0]?.id ?? null;
        setGroups(loadedGroups); setResources(data.resources ?? []); setBookings(data.bookings ?? []);
        setPeriodsByGroup(data.periodsByGroup ?? {}); setUsers(data.users ?? []); setNotifications(data.notifications ?? []);
        if (termData?.length) setTerms(termData.map((term) => ({ id: term.id, name: term.name, start: term.start_date || "", end: term.end_date || "" })));
        setTemplates(templateData ?? []); setActiveGroupId(firstGroupId); setEditingGroupId(firstGroupId);
      } catch (error) {
        console.error(error); if (!cancelled) setLoadError(error?.message || "Unable to load data from Supabase.");
      } finally { if (!cancelled) setLoaded(true); }
    }
    load(); return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function syncUser() {
      if (!loaded) return;
      if (!isAuthenticated) { if (!cancelled) setSessionUser(null); return; }
      const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
      if (!account) return;
      const entraId = account.localAccountId;
      const email = account.username?.trim().toLowerCase();
      const name = account.name?.trim() || email;
      const userGroups = account.idTokenClaims?.groups || [];
      const accessGroups = getGroupList(import.meta.env.VITE_BOOKING_ACCESS_GROUPS);
      const adminGroups = getGroupList(import.meta.env.VITE_BOOKING_ADMIN_GROUPS);
      const admin = userGroups.some((id) => adminGroups.includes(id));
      const allowed = admin || userGroups.some((id) => accessGroups.includes(id));
      if (!allowed) { setLoadError("You do not have permission to access Resource Booking."); return; }
      if (!entraId || !email) return;
      const existing = users.find((user) => user.entraId === entraId || user.email?.toLowerCase() === email);
      const synced = { id: existing?.id || uid(), entraId, name, email, role: admin ? "admin" : "user" };
      try {
        await api.upsertUserRow(synced); if (cancelled) return;
        setSessionUser(synced);
        setUsers((previous) => previous.some((user) => user.id === synced.id) ? previous.map((user) => user.id === synced.id ? synced : user) : [...previous, synced]);
      } catch (error) { console.error(error); setLoadError("Microsoft sign-in succeeded, but the user account could not be synchronised."); }
    }
    syncUser(); return () => { cancelled = true; };
  }, [instance, isAuthenticated, loaded]);

  useEffect(() => {
    function outside(event) { if (datePickerRef.current && !datePickerRef.current.contains(event.target)) setShowDatePicker(false); }
    document.addEventListener("mousedown", outside); return () => document.removeEventListener("mousedown", outside);
  }, []);

  async function runPersist(action) {
    setSaveState("saving");
    try { await action(); setSaveState("saved"); setTimeout(() => setSaveState("idle"), 1000); }
    catch (error) { console.error("Supabase write failed:", error); setSaveState("error"); setResourcePanelError(error?.message || "The change could not be saved."); }
  }
  function periodsFor(groupId) { return Array.isArray(periodsByGroup[groupId]) ? periodsByGroup[groupId] : []; }
  function updateGroupPeriods(groupId, updater) {
    setPeriodsByGroup((previous) => {
      const next = updater(previous[groupId] || []);
      runPersist(() => api.replaceGroupPeriods(groupId, next));
      return { ...previous, [groupId]: next };
    });
  }
  function blankPeriod() { return { id: uid(), label: "New block", type: "period", start: "09:00", end: "09:50" }; }
  function updatePeriod(groupId, id, field, value) { updateGroupPeriods(groupId, (items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item)); }
  function movePeriod(groupId, index, direction) { updateGroupPeriods(groupId, (items) => { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  function addPeriod(groupId) { updateGroupPeriods(groupId, (items) => [...items, blankPeriod()]); }
  function insertPeriodAt(groupId, index) { updateGroupPeriods(groupId, (items) => { const next = [...items]; next.splice(index + 1, 0, blankPeriod()); return next; }); }
  function removePeriod(groupId, id) { updateGroupPeriods(groupId, (items) => items.filter((item) => item.id !== id)); runPersist(() => api.deleteBookingsByPeriodRow(id)); }

  function updateTerm(id, field, value) {
    setTerms((previous) => {
      const next = previous.map((term) => term.id === id ? { ...term, [field]: value } : term);
      const changed = next.find((term) => term.id === id);
      if (changed) runPersist(() => api.upsertTerm(changed));
      return next;
    });
  }
  function saveCurrentAsTemplate() {
    const name = newTemplateName.trim(); const blocks = periodsFor(editingGroupId);
    if (!name) return setResourcePanelError("Enter a template name.");
    if (!blocks.length) return setResourcePanelError("Add at least one timetable block before saving a template.");
    const template = { id: uid(), name, blocks: blocks.map(({ label, type, start, end }) => ({ label, type, start, end })) };
    setTemplates((previous) => [...previous, template]); setSelectedTemplateId(template.id); setNewTemplateName("");
    runPersist(() => api.upsertTemplate(template));
  }
  function applyTemplate(id) {
    const template = templates.find((item) => item.id === id);
    if (!template) return setResourcePanelError("Choose a timetable template.");
    updateGroupPeriods(editingGroupId, () => template.blocks.map((block) => ({ ...block, id: uid() })));
  }
  function deleteTemplate(id) {
    const template = templates.find((item) => item.id === id); if (!template) return;
    if (!window.confirm(`Delete the "${template.name}" timetable template?`)) return;
    setTemplates((previous) => previous.filter((item) => item.id !== id)); setSelectedTemplateId("");
    runPersist(() => api.deleteTemplate(id));
  }
  function generateTimetable() {
    if (!editingGroupId) return setResourcePanelError("Choose a resource group.");
    if (periodsFor(editingGroupId).length && !window.confirm("Generating a timetable will replace all current blocks for this resource group. Continue?")) return;
    let current = new Date(`2000-01-01T${generatorStartTime}:00`); const blocks = [];
    for (let index = 1; index <= generatorPeriods; index += 1) {
      const end = new Date(current); end.setMinutes(end.getMinutes() + generatorBlockLength);
      blocks.push({ id: uid(), label: `Period ${index}`, type: "period", start: formatTime(current), end: formatTime(end) });
      current = end;
      if (autoInsertBreaks && (index === 2 || index === 4)) {
        const breakEnd = new Date(current); breakEnd.setMinutes(breakEnd.getMinutes() + (index === 2 ? generatorBreakLength : 40));
        blocks.push({ id: uid(), label: index === 2 ? "Recess" : "Lunch", type: "break", start: formatTime(current), end: formatTime(breakEnd) });
        current = breakEnd;
      }
    }
    updateGroupPeriods(editingGroupId, () => blocks);
  }

  const currentTerm = getCurrentTerm(selectedDate, terms);
  const isAdmin = sessionUser?.role === "admin";
  const periods = periodsFor(activeGroupId);
  const dateKey = toISODate(selectedDate);
  const visibleResources = [...resources.filter((r) => r.groupId === activeGroupId), ...resources.filter((r) => pinnedIds.includes(r.id) && r.groupId !== activeGroupId)];
  const searchMatches = searchText.trim() ? resources.filter((r) => r.name.toLowerCase().includes(searchText.toLowerCase()) && !visibleResources.some((v) => v.id === r.id)).slice(0, 6) : [];
  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const myNotifications = sessionUser ? notifications.filter((n) => n.userId === sessionUser.id) : [];
  const detailed = viewMode === "Detailed";
  const rowH = window.innerWidth > 1600 ? (detailed ? 52 : 38) : (detailed ? 68 : 44);
  const canCancel = (booking) => isAdmin || booking.bookedById === sessionUser?.id;
  function bookingsFor(resourceId, periodId, date) { return bookings.filter((b) => b.resourceId === resourceId && b.date === date && (b.allDay || b.periodId === periodId)); }

  function closeModal() { setModal(null); setFormError(""); setResourcePanelError(""); setCreateResult(null); }
  function openCreateModal(resourceId, periodId) {
    setForm({ resourceId: resourceId || visibleResources[0]?.id, periodId: periodId || periods[0]?.id, title: "", repeat: "none", repeatEndType: "term", repeatEndDate: "", allDay: false });
    setFormError(""); setCreateResult(null); setModal({ mode: "create" });
  }
  async function signIn() { try { await instance.loginPopup(loginRequest); } catch (error) { console.error(error); } }
  async function signOut() { await instance.logoutPopup(); }
  function computeRecurringDates(start, repeat, end) { const result = []; const step = repeat === "weekly" ? 7 : 1; for (let date = new Date(start); date <= end; date = addDays(date, step)) result.push(new Date(date)); return result; }
  function submitBooking() {
    const { resourceId, periodId, title, allDay } = form;
    if (!title?.trim()) return setFormError("Enter a title for this booking.");
    const resource = resources.find((item) => item.id === resourceId); if (!resource) return setFormError("Choose a resource.");
    if (!allDay && !periodId) return setFormError("Choose a period.");
    const repeat = form.repeat || "none";
    if (repeat !== "none" && form.repeatEndType === "term" && !currentTerm) return setFormError("The selected date is not within a configured school term.");
    if (repeat !== "none" && form.repeatEndType === "date" && !form.repeatEndDate) return setFormError("Choose an end date for the recurring booking.");
    if (repeat !== "none" && form.repeatEndType === "date" && form.repeatEndDate < toISODate(selectedDate)) return setFormError("The recurrence end date cannot be before the booking date.");
    const endDate = repeat === "none" ? selectedDate : new Date(`${form.repeatEndType === "term" ? currentTerm.end : form.repeatEndDate}T00:00:00`);
    const dates = repeat === "none" ? [selectedDate] : computeRecurringDates(selectedDate, repeat, endDate);
    const recurrenceId = repeat === "none" ? null : uid(); const pending = resource.requiresApproval && !isAdmin; const created = []; let skipped = 0;
    for (const date of dates) {
      const dateIso = toISODate(date); const existing = allDay ? periods.flatMap((p) => bookingsFor(resourceId, p.id, dateIso)) : bookingsFor(resourceId, periodId, dateIso);
      if (existing.length >= (resource.slots || 1)) { skipped += 1; continue; }
      created.push({ id: uid(), resourceId, periodId: allDay ? null : periodId, allDay, date: dateIso, title: title.trim(), bookedById: sessionUser.id, bookedBy: sessionUser.name, status: pending ? "pending" : "confirmed", recurrenceId, groupId: activeGroupId });
    }
    if (!created.length) return setFormError("Every requested occurrence conflicts with an existing booking.");
    setBookings((previous) => [...previous, ...created]); runPersist(() => api.insertBookings(created));
    if (pending || skipped || repeat !== "none") setCreateResult({ created: created.length, skipped, pending, recurring: repeat !== "none" }); else closeModal();
  }
  function cancelBooking(id) { setBookings((previous) => previous.filter((b) => b.id !== id)); runPersist(() => api.deleteBookingRow(id)); }
  function cancelSeries(id) { setBookings((previous) => previous.filter((b) => b.recurrenceId !== id)); runPersist(() => api.deleteBookingsByRecurrenceRow(id)); closeModal(); }
  function approveBooking(id) { const booking = bookings.find((b) => b.id === id); if (!booking) return; setBookings((previous) => previous.map((b) => b.id === id ? { ...b, status: "confirmed" } : b)); runPersist(() => api.updateBookingStatusRow(id, "confirmed")); }
  function rejectBooking(id) { setBookings((previous) => previous.filter((b) => b.id !== id)); runPersist(() => api.deleteBookingRow(id)); }

  if (!loaded) return <div style={{ minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'Inter',sans-serif" }}><Loader2 size={16} /> Loading schedule…</div>;
  if (loadError) return <div style={{ minHeight: 400, display: "grid", placeItems: "center", fontFamily: "'Inter',sans-serif" }}><div style={{ maxWidth: 520, padding: 20, borderRadius: 8, background: C.dangerBg, color: C.danger }}><strong>Unable to load Resource Booking</strong><div style={{ marginTop: 8 }}>{loadError}</div></div></div>;
  if (!sessionUser) return <div style={{ minHeight: 460, display: "grid", placeItems: "center", fontFamily: "'Inter',sans-serif" }}><button onClick={signIn} style={{ ...toolBtn(), background: C.purpleBright, color: "#fff" }}>Sign in with Microsoft 365</button></div>;

  return <div style={{ minHeight: "100vh", height: "100vh", overflow: "hidden", fontFamily: "'Inter',sans-serif", color: C.ink, background: C.page }}>
    <style>{FONT_IMPORT}</style>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 22px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
      <strong style={{ fontSize: 19 }}>Resource Booking</strong>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <small style={{ color: C.inkSoft }}>{saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : saveState === "error" ? "save failed" : ""}</small>
        {isAdmin && <>
          <button onClick={() => { setEditingGroupId(activeGroupId); setModal({ mode: "timetable" }); }} style={toolBtn()}><Clock size={13} /> Edit timetable</button>
          <button onClick={() => setModal({ mode: "terms" })} style={toolBtn()}><Calendar size={13} /> Term dates</button>
          <button onClick={() => setModal({ mode: "approvals" })} style={toolBtn()}><Inbox size={13} /> Approvals {pendingBookings.length ? `(${pendingBookings.length})` : ""}</button>
        </>}
        <button onClick={() => setModal({ mode: "notifications" })} style={iconBtnStyle()}><Bell size={14} /></button>
        <span style={{ fontSize: 12.5 }}>{isAdmin && <ShieldCheck size={12} />} {sessionUser.name}</span>
        <button onClick={signOut} style={iconBtnStyle()}><LogOut size={14} /></button>
      </div>
    </header>

    <div style={{ display: "grid", gridTemplateColumns: "clamp(180px,15vw,260px) minmax(0,1fr)", height: "calc(100vh - 70px)" }}>
      <aside style={{ borderRight: `1px solid ${C.border}` }}>
        <button onClick={() => setGroupsOpen((open) => !open)} style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: 14, border: 0, borderBottom: `1px solid ${C.border}`, background: "#fff", cursor: "pointer" }}>Resource groups {groupsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
        {groupsOpen && groups.map((group) => <button key={group.id} onClick={() => setActiveGroupId(group.id)} style={{ width: "100%", padding: "10px 16px", textAlign: "left", border: 0, background: group.id === activeGroupId ? C.purpleBright : "transparent", color: group.id === activeGroupId ? "#fff" : C.ink, cursor: "pointer" }}>{group.name}</button>)}
      </aside>
      <main style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 20px", background: C.toolbar, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
          <strong>Daily booking view for {groups.find((g) => g.id === activeGroupId)?.name}</strong>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setSelectedDate((d) => addDays(d, -1))} style={toolBtn()}><ChevronLeft size={14} /></button>
            <div ref={datePickerRef} style={{ position: "relative" }}>
              <button onClick={() => setShowDatePicker((open) => !open)} style={toolBtn()}><Calendar size={14} /> {formatDate(selectedDate)} {currentTerm && <span style={{ padding: "2px 7px", borderRadius: 12, background: C.lavender }}>{currentTerm.name}</span>}</button>
              {showDatePicker && <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 50, width: 220, padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", boxShadow: "0 8px 24px rgba(31,36,48,.12)" }}><input type="date" value={toDateInputValue(selectedDate)} onChange={(e) => { setSelectedDate(new Date(`${e.target.value}T00:00:00`)); setShowDatePicker(false); }} style={fieldStyle()} /></div>}
            </div>
            <button onClick={() => setSelectedDate((d) => addDays(d, 1))} style={toolBtn()}><ChevronRight size={14} /></button>
            <div style={{ position: "relative" }}><div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", border: `1px solid ${C.purple}`, borderRadius: 6, background: "#fff" }}><Search size={13} /><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search resources" style={{ border: 0, outline: 0 }} /></div>{searchMatches.length > 0 && <div style={{ position: "absolute", top: "110%", left: 0, right: 0, zIndex: 30, border: `1px solid ${C.border}`, background: "#fff" }}>{searchMatches.map((resource) => <button key={resource.id} onClick={() => { setPinnedIds((previous) => [...previous, resource.id]); setSearchText(""); }} style={{ width: "100%", padding: 8, border: 0, textAlign: "left", background: "#fff" }}>{resource.name}</button>)}</div>}</div>
            <button onClick={() => setPinnedIds([])} style={toolBtn()}><RotateCcw size={13} /> Deselect all</button>
            <button onClick={() => openCreateModal()} style={{ ...toolBtn(), background: C.purpleBright, color: "#fff", borderColor: C.purpleBright }}><CalendarPlus size={14} /> Create booking</button>
          </div>
        </div>
        <div style={{ overflow: "auto", height: "calc(100vh - 145px)" }}>
          <table style={{ width: "100%", minWidth: Math.max(650, 150 + visibleResources.length * 150), borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead><tr><th style={{ width: 150 }} />{visibleResources.map((resource) => <th key={resource.id} style={{ padding: 12, border: `1px solid ${C.border}` }}>{resource.name}</th>)}</tr></thead>
            <tbody>{periods.map((period) => <tr key={period.id}><td style={{ height: rowH, padding: "0 12px", border: `1px solid ${C.border}`, background: periodColours(period).bg, color: periodColours(period).text }}><strong style={{ fontSize: 12 }}>{period.label}</strong><div style={{ fontSize: 10 }}>{formatTime12(period.start)} – {formatTime12(period.end)}</div></td>{visibleResources.map((resource) => { const items = bookingsFor(resource.id, period.id, dateKey); const remaining = (resource.slots || 1) - items.length; return <td key={`${resource.id}-${period.id}`} onClick={() => remaining > 0 && openCreateModal(resource.id, period.id)} style={{ height: rowH, padding: 6, border: `1px solid ${C.border}`, verticalAlign: "top", cursor: remaining > 0 ? "pointer" : "default" }}>{items.map((booking) => <div key={booking.id} onClick={(e) => { e.stopPropagation(); setModal({ mode: "view", resourceId: resource.id, periodId: period.id }); }} style={{ marginBottom: 3, padding: "4px 7px", borderLeft: `3px solid ${booking.status === "pending" ? C.pendingBorder : C.purpleDeep}`, background: booking.status === "pending" ? C.pendingBg : C.lavender, fontSize: 11 }}>{booking.bookedBy}<div>{booking.title}</div></div>)}{detailed && <small>{remaining} booking{remaining === 1 ? "" : "s"} left</small>}</td>; })}</tr>)}</tbody>
          </table>
        </div>
      </main>
    </div>

    {modal?.mode === "create" && <Modal onClose={closeModal} title="Create booking">{createResult ? <><div style={{ padding: 10, background: C.successBg, color: C.successText }}>Created {createResult.created} booking{createResult.created === 1 ? "" : "s"}. {createResult.skipped ? `${createResult.skipped} skipped.` : ""}</div><button onClick={closeModal} style={{ ...toolBtn(), marginTop: 10 }}>Done</button></> : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><label style={labelStyle()}>Resource</label><select value={form.resourceId || ""} onChange={(e) => setForm((f) => ({ ...f, resourceId: e.target.value }))} style={fieldStyle()}>{resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      <label><input type="checkbox" checked={!!form.allDay} onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))} /> All day</label>
      {!form.allDay && <div><label style={labelStyle()}>Period</label><select value={form.periodId || ""} onChange={(e) => setForm((f) => ({ ...f, periodId: e.target.value }))} style={fieldStyle()}>{periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>}
      <div><label style={labelStyle()}>Title</label><input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={fieldStyle()} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><label style={labelStyle()}>Repeat</label><select value={form.repeat} onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))} style={fieldStyle()}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>{form.repeat !== "none" && <div><label style={labelStyle()}>Repeat until</label><select value={form.repeatEndType} onChange={(e) => setForm((f) => ({ ...f, repeatEndType: e.target.value }))} style={fieldStyle()}><option value="term">End of {currentTerm?.name || "current term"}</option><option value="date">Specific date</option></select></div>}</div>
      {form.repeat !== "none" && form.repeatEndType === "date" && <div><label style={labelStyle()}>End date</label><input type="date" value={form.repeatEndDate} onChange={(e) => setForm((f) => ({ ...f, repeatEndDate: e.target.value }))} style={fieldStyle()} /></div>}
      {form.repeat !== "none" && <small><RepeatIcon size={11} /> Recurring booking starting {formatDate(selectedDate)}</small>}
      {formError && <div style={{ padding: 8, background: C.dangerBg, color: C.danger }}>{formError}</div>}
      <button onClick={submitBooking} style={{ ...toolBtn(), background: C.purpleBright, color: "#fff" }}>{form.repeat === "none" ? "Confirm booking" : "Create recurring booking"}</button>
    </div>}</Modal>}

    {modal?.mode === "view" && (() => { const list = bookingsFor(modal.resourceId, modal.periodId, dateKey); return <Modal onClose={closeModal} title="Booking details"><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{list.map((booking) => <div key={booking.id} style={{ padding: 10, border: `1px solid ${C.border}` }}><strong>{booking.title}</strong><div>Booked by {booking.bookedBy}</div>{canCancel(booking) && <div style={{ display: "flex", gap: 6, marginTop: 8 }}><button onClick={() => cancelBooking(booking.id)} style={toolBtn()}><Trash2 size={13} /> Cancel</button>{booking.recurrenceId && <button onClick={() => cancelSeries(booking.recurrenceId)} style={toolBtn()}>Cancel series</button>}</div>}</div>)}</div></Modal>; })()}

    {modal?.mode === "timetable" && isAdmin && (() => { const editPeriods = periodsFor(editingGroupId); return <Modal onClose={closeModal} title="Edit timetable" width={820}><div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) auto", gap: 12, alignItems: "end" }}><div><label style={labelStyle()}>Resource group</label><select value={editingGroupId || ""} onChange={(e) => { setEditingGroupId(e.target.value); setResourcePanelError(""); }} style={fieldStyle()}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div><div style={{ minWidth: 140, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.toolbar, textAlign: "center" }}>{editPeriods.length} block{editPeriods.length === 1 ? "" : "s"}</div></div>
      <section style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 8 }}><strong>Timetable templates</strong><div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, marginTop: 10 }}><select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} style={fieldStyle()}><option value="">Select a template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select><button disabled={!selectedTemplateId} onClick={() => applyTemplate(selectedTemplateId)} style={toolBtn()}>Apply</button><button disabled={!selectedTemplateId} onClick={() => deleteTemplate(selectedTemplateId)} style={{ ...toolBtn(), color: C.danger, borderColor: C.danger }}><Trash2 size={13} /> Delete</button></div><div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 10 }}><input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Template name" style={fieldStyle()} /><button onClick={saveCurrentAsTemplate} style={toolBtn()}>Save template</button></div></section>
      <section style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 8 }}><strong>Generate timetable</strong><div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginTop: 10 }}><div><label style={labelStyle()}>Start time</label><input type="time" value={generatorStartTime} onChange={(e) => setGeneratorStartTime(e.target.value)} style={fieldStyle()} /></div><div><label style={labelStyle()}>Period length</label><input type="number" min="1" value={generatorBlockLength} onChange={(e) => setGeneratorBlockLength(Math.max(1, Number(e.target.value) || 1))} style={fieldStyle()} /></div><div><label style={labelStyle()}>Periods</label><input type="number" min="1" max="20" value={generatorPeriods} onChange={(e) => setGeneratorPeriods(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} style={fieldStyle()} /></div><div><label style={labelStyle()}>Recess length</label><input type="number" min="1" value={generatorBreakLength} onChange={(e) => setGeneratorBreakLength(Math.max(1, Number(e.target.value) || 1))} style={fieldStyle()} /></div></div><label style={{ display: "flex", gap: 8, marginTop: 10 }}><input type="checkbox" checked={autoInsertBreaks} onChange={(e) => setAutoInsertBreaks(e.target.checked)} /> Automatically insert recess after Period 2 and lunch after Period 4</label><button onClick={generateTimetable} style={{ ...toolBtn(), width: "100%", marginTop: 10, background: C.purpleBright, color: "#fff" }}><Plus size={13} /> Generate and replace timetable</button></section>
      {resourcePanelError && <div style={{ padding: 8, background: C.dangerBg, color: C.danger }}>{resourcePanelError}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "55vh", overflowY: "auto" }}>{editPeriods.map((period, index) => <React.Fragment key={period.id}><div style={{ display: "grid", gridTemplateColumns: "34px minmax(180px,1fr) 110px 112px 20px 112px 34px", gap: 8, padding: 10, alignItems: "center", border: `1px solid ${period.type === "break" ? C.break : C.border}`, borderRadius: 8, background: period.type === "break" ? "#FFF8E8" : "#fff" }}><div><button disabled={index === 0} onClick={() => movePeriod(editingGroupId, index, -1)} style={iconBtnStyle()}><ArrowUp size={13} /></button><button disabled={index === editPeriods.length - 1} onClick={() => movePeriod(editingGroupId, index, 1)} style={iconBtnStyle()}><ArrowDown size={13} /></button></div><input value={period.label} onChange={(e) => updatePeriod(editingGroupId, period.id, "label", e.target.value)} style={fieldStyle()} /><select value={period.type} onChange={(e) => updatePeriod(editingGroupId, period.id, "type", e.target.value)} style={fieldStyle()}><option value="period">Period</option><option value="break">Break</option></select><input type="time" value={period.start} onChange={(e) => updatePeriod(editingGroupId, period.id, "start", e.target.value)} style={fieldStyle()} /><span>→</span><input type="time" value={period.end} onChange={(e) => updatePeriod(editingGroupId, period.id, "end", e.target.value)} style={fieldStyle()} /><button onClick={() => removePeriod(editingGroupId, period.id)} style={{ ...iconBtnStyle(), color: C.danger }}><Trash2 size={14} /></button></div><button onClick={() => insertPeriodAt(editingGroupId, index)} style={{ ...toolBtn(), width: "100%", borderStyle: "dashed" }}><Plus size={12} /> Add block here</button></React.Fragment>)}</div>
      <button onClick={() => addPeriod(editingGroupId)} style={{ ...toolBtn(), width: "100%", background: C.purpleBright, color: "#fff" }}><Plus size={14} /> Add block at end</button>
    </div></Modal>; })()}

    {modal?.mode === "terms" && isAdmin && <Modal onClose={closeModal} title="Manage term dates" width={600}><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{terms.map((term) => <div key={term.id} style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 8 }}><strong>{term.name}</strong><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}><div><label style={labelStyle()}>Start date</label><input type="date" value={term.start} onChange={(e) => updateTerm(term.id, "start", e.target.value)} style={fieldStyle()} /></div><div><label style={labelStyle()}>End date</label><input type="date" value={term.end} onChange={(e) => updateTerm(term.id, "end", e.target.value)} style={fieldStyle()} /></div></div></div>)}</div></Modal>}

    {modal?.mode === "approvals" && isAdmin && <Modal onClose={closeModal} title="Pending approvals" width={560}><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{pendingBookings.length ? pendingBookings.map((booking) => <div key={booking.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: 10, border: `1px solid ${C.pendingBorder}` }}><div><strong>{booking.title}</strong><div>{booking.bookedBy} · {formatDateShort(booking.date)}</div></div><div style={{ display: "flex", gap: 6 }}><button onClick={() => approveBooking(booking.id)} style={iconBtnStyle()}><Check size={14} /></button><button onClick={() => rejectBooking(booking.id)} style={iconBtnStyle()}><X size={14} /></button></div></div>) : <div>Nothing waiting on approval.</div>}</div></Modal>}

    {modal?.mode === "notifications" && <Modal onClose={closeModal} title="Notifications"><div>{myNotifications.length ? myNotifications.map((notification) => <div key={notification.id} style={{ marginBottom: 8, padding: 8, background: notification.type === "approved" ? C.successBg : C.dangerBg }}>{notification.message}</div>) : "Nothing new."}</div></Modal>}
  </div>;
}
