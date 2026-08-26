import fs from "node:fs";

const file = process.argv[2] || "src/App.jsx";
let source = fs.readFileSync(file, "utf8");
const original = source;

function replaceOnce(label, find, replacement) {
  const count = source.split(find).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(find, replacement);
}

// 1. Add template/generator state only. Authentication and admin state are untouched.
replaceOnce(
  "state insertion",
  '  const [saveState, setSaveState] = useState("idle");',
  `  const [saveState, setSaveState] = useState("idle");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [generatorStartTime, setGeneratorStartTime] = useState("08:40");
  const [generatorBlockLength, setGeneratorBlockLength] = useState(50);
  const [generatorBreakLength, setGeneratorBreakLength] = useState(20);
  const [generatorPeriods, setGeneratorPeriods] = useState(6);
  const [autoInsertBreaks, setAutoInsertBreaks] = useState(true);`
);

// 2. Load templates alongside existing startup data, without changing users/admin logic.
replaceOnce(
  "startup load",
  "        const data = await api.loadAll();",
  `        const [data, templateData] = await Promise.all([
          api.loadAll(),
          api.loadTemplates(),
        ]);`
);
replaceOnce(
  "template state load",
  "        setNotifications(data.notifications ?? []);",
  `        setNotifications(data.notifications ?? []);
        setTemplates(templateData ?? []);`
);

// 3. Add template/generator helpers immediately before canCancel.
replaceOnce(
  "helper insertion",
  '  const canCancel = (b) => isAdmin || b.bookedById === sessionUser?.id;',
  `  function formatGeneratorTime(date) {
    return \`${"${String(date.getHours()).padStart(2, \"0\")}:${String(date.getMinutes()).padStart(2, \"0\")}"}\`;
  }

  function saveCurrentAsTemplate() {
    const name = newTemplateName.trim();
    const currentPeriods = periodsFor(editingGroupId);

    if (!name) {
      setResourcePanelError("Enter a template name.");
      return;
    }

    if (!editingGroupId) {
      setResourcePanelError("Choose a resource group.");
      return;
    }

    if (currentPeriods.length === 0) {
      setResourcePanelError("Add at least one timetable block before saving a template.");
      return;
    }

    const template = {
      id: uid(),
      name,
      blocks: currentPeriods.map(({ label, type, start, end }) => ({
        label,
        type,
        start,
        end,
      })),
    };

    setTemplates((prev) => [...prev, template]);
    setSelectedTemplateId(template.id);
    setNewTemplateName("");
    setResourcePanelError("");
    runPersist(() => api.upsertTemplate(template));
  }

  function applyTemplate(id) {
    const template = templates.find((item) => item.id === id);

    if (!template) {
      setResourcePanelError("Choose a timetable template.");
      return;
    }

    if (!editingGroupId) {
      setResourcePanelError("Choose a resource group.");
      return;
    }

    updateGroupPeriods(editingGroupId, () =>
      template.blocks.map((block) => ({ ...block, id: uid() }))
    );
    setResourcePanelError("");
  }

  function deleteTemplate(id) {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    if (!window.confirm(\`Delete the "${"${template.name}"}" timetable template?\`)) return;

    setTemplates((prev) => prev.filter((item) => item.id !== id));
    setSelectedTemplateId("");
    setResourcePanelError("");
    runPersist(() => api.deleteTemplate(id));
  }

  function generateTimetable() {
    if (!editingGroupId) {
      setResourcePanelError("Choose a resource group.");
      return;
    }

    if (
      periodsFor(editingGroupId).length > 0 &&
      !window.confirm("Generating a timetable will replace all current blocks for this resource group. Continue?")
    ) return;

    let current = new Date(\`2000-01-01T${"${generatorStartTime}"}:00\`);
    const blocks = [];

    for (let i = 1; i <= generatorPeriods; i += 1) {
      const end = new Date(current);
      end.setMinutes(end.getMinutes() + generatorBlockLength);

      blocks.push({
        id: uid(),
        label: \`Period ${"${i}"}\`,
        type: "period",
        start: formatGeneratorTime(current),
        end: formatGeneratorTime(end),
      });
      current = end;

      if (autoInsertBreaks && (i === 2 || i === 4)) {
        const breakEnd = new Date(current);
        breakEnd.setMinutes(
          breakEnd.getMinutes() + (i === 2 ? generatorBreakLength : 40)
        );
        blocks.push({
          id: uid(),
          label: i === 2 ? "Recess" : "Lunch",
          type: "break",
          start: formatGeneratorTime(current),
          end: formatGeneratorTime(breakEnd),
        });
        current = breakEnd;
      }
    }

    setResourcePanelError("");
    updateGroupPeriods(editingGroupId, () => blocks);
  }

  const canCancel = (b) => isAdmin || b.bookedById === sessionUser?.id;`
);

// 4. Replace only the existing timetable modal. All other modals and admin logic stay intact.
const modalStart = '      {modal?.mode === "timetable" && isAdmin && (() => {';
const modalEnd = '      {modal?.mode === "users" && isAdmin && (';
const startIndex = source.indexOf(modalStart);
const endIndex = source.indexOf(modalEnd, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error("Could not locate the existing timetable modal.");

const timetableModal = `      {modal?.mode === "timetable" && isAdmin && (() => {
        const editPeriods = periodsFor(editingGroupId);
        return (
          <Modal onClose={closeModal} title="Edit timetable" width={780}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) auto", gap: 12, alignItems: "end" }}>
                <div>
                  <label style={labelStyle()}>Resource group</label>
                  <select
                    value={editingGroupId || ""}
                    onChange={(e) => {
                      setEditingGroupId(e.target.value);
                      setResourcePanelError("");
                    }}
                    style={fieldStyle()}
                  >
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: 140, padding: "8px 12px", border: \`1px solid ${"${C.border}"}\`, borderRadius: 6, background: C.toolbar, color: C.inkSoft, fontSize: 12, textAlign: "center" }}>
                  {editPeriods.length} block{editPeriods.length === 1 ? "" : "s"}
                </div>
              </div>

              <div style={{ border: \`1px solid ${"${C.border}"}\`, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Timetable templates</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 8, alignItems: "end" }}>
                  <div>
                    <label style={labelStyle()}>Saved template</label>
                    <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} style={fieldStyle()}>
                      <option value="">Select a template</option>
                      {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                    </select>
                  </div>
                  <button type="button" disabled={!selectedTemplateId} onClick={() => applyTemplate(selectedTemplateId)} style={{ ...toolBtn(), opacity: selectedTemplateId ? 1 : 0.45 }}>Apply</button>
                  <button type="button" disabled={!selectedTemplateId} onClick={() => deleteTemplate(selectedTemplateId)} style={{ ...toolBtn(), borderColor: C.danger, color: C.danger, opacity: selectedTemplateId ? 1 : 0.45 }}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "end", marginTop: 10 }}>
                  <div>
                    <label style={labelStyle()}>Save current timetable as</label>
                    <input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveCurrentAsTemplate(); }}
                      placeholder="Template name"
                      style={fieldStyle()}
                    />
                  </div>
                  <button type="button" onClick={saveCurrentAsTemplate} style={toolBtn()}>Save template</button>
                </div>
              </div>

              <div style={{ border: \`1px solid ${"${C.border}"}\`, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Generate timetable</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                  <div><label style={labelStyle()}>Start time</label><input type="time" value={generatorStartTime} onChange={(e) => setGeneratorStartTime(e.target.value)} style={fieldStyle()} /></div>
                  <div><label style={labelStyle()}>Period length</label><input type="number" min={1} value={generatorBlockLength} onChange={(e) => setGeneratorBlockLength(Math.max(1, Number(e.target.value) || 1))} style={fieldStyle()} /></div>
                  <div><label style={labelStyle()}>Periods</label><input type="number" min={1} max={20} value={generatorPeriods} onChange={(e) => setGeneratorPeriods(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} style={fieldStyle()} /></div>
                  <div><label style={labelStyle()}>Recess length</label><input type="number" min={1} value={generatorBreakLength} onChange={(e) => setGeneratorBreakLength(Math.max(1, Number(e.target.value) || 1))} style={fieldStyle()} /></div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={autoInsertBreaks} onChange={(e) => setAutoInsertBreaks(e.target.checked)} />
                  Automatically insert recess after Period 2 and lunch after Period 4
                </label>
                <button type="button" onClick={generateTimetable} style={{ ...toolBtn(), width: "100%", marginTop: 10, background: C.purpleBright, borderColor: C.purpleBright, color: "#fff", justifyContent: "center" }}>
                  <Plus size={13} /> Generate and replace timetable
                </button>
              </div>

              {resourcePanelError && <div style={{ fontSize: 12, color: C.danger, background: C.dangerBg, borderRadius: 5, padding: "8px 10px" }}>{resourcePanelError}</div>}

              <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 92px 84px 84px 26px", gap: 6, fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.03em", padding: "0 2px" }}>
                <span /><span>Label</span><span>Type</span><span>Start</span><span>End</span><span />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: "42vh", overflowY: "auto" }}>
                {editPeriods.map((p, i) => (
                  <div key={p.id}>
                    <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 92px 84px 84px 26px", gap: 6, alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <button aria-label="Move up" disabled={i === 0} onClick={() => movePeriod(editingGroupId, i, -1)} style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? C.border : C.inkSoft, padding: 0 }}><ArrowUp size={12} /></button>
                        <button aria-label="Move down" disabled={i === editPeriods.length - 1} onClick={() => movePeriod(editingGroupId, i, 1)} style={{ background: "none", border: "none", cursor: i === editPeriods.length - 1 ? "default" : "pointer", color: i === editPeriods.length - 1 ? C.border : C.inkSoft, padding: 0 }}><ArrowDown size={12} /></button>
                      </div>
                      <input value={p.label} onChange={(e) => updatePeriod(editingGroupId, p.id, "label", e.target.value)} style={{ ...fieldStyle(), padding: "6px 8px", fontSize: 12.5 }} />
                      <select value={p.type} onChange={(e) => updatePeriod(editingGroupId, p.id, "type", e.target.value)} style={{ ...fieldStyle(), padding: "6px 4px", fontSize: 12 }}><option value="period">Period</option><option value="break">Break</option></select>
                      <input type="time" value={p.start} onChange={(e) => updatePeriod(editingGroupId, p.id, "start", e.target.value)} style={{ ...fieldStyle(), padding: "6px 4px", fontSize: 11.5 }} />
                      <input type="time" value={p.end} onChange={(e) => updatePeriod(editingGroupId, p.id, "end", e.target.value)} style={{ ...fieldStyle(), padding: "6px 4px", fontSize: 11.5 }} />
                      <button aria-label={\`Remove ${"${p.label}"}\`} onClick={() => removePeriod(editingGroupId, p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}><Trash2 size={13} /></button>
                    </div>
                    <button onClick={() => insertPeriodAt(editingGroupId, i)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, width: "100%", background: "none", border: "none", cursor: "pointer", color: C.lavenderBorder, padding: "3px 0", fontSize: 10, marginTop: 1 }}>
                      <Plus size={11} /> Insert block here
                    </button>
                  </div>
                ))}
              </div>
              {editPeriods.length === 0 && <div style={{ fontSize: 12, color: C.inkSoft, textAlign: "center", padding: "10px 0" }}>No blocks yet. Add one below or generate a timetable.</div>}
              <button onClick={() => addPeriod(editingGroupId)} style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: \`1px dashed ${"${C.lavenderBorder}"}\`, borderRadius: 6, padding: "8px 0", fontSize: 12.5, color: C.purple, cursor: "pointer" }}>
                <Plus size={13} /> Add block at end
              </button>
            </div>
          </Modal>
        );
      })()}
`;

source = source.slice(0, startIndex) + timetableModal + source.slice(endIndex);

if (source === original) throw new Error("No changes were applied.");
const backup = `${file}.before-templates`;
fs.copyFileSync(file, backup);
fs.writeFileSync(file, source);
console.log(`Updated ${file}`);
console.log(`Backup saved as ${backup}`);
