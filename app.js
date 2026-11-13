const cfg = window.TRACEPROV_PORTAL_CONFIG || {};
const state = { token: sessionStorage.getItem("traceprov-token"), me: null, caseIndex: 0, activeFamily: "overview", activeQuestion: null, current: null, draft: {}, cy: null };
const el = (id) => document.getElementById(id);
const valueText = (value) => value === true || value === "True" ? "Yes" : value === false || value === "False" ? "No" : Array.isArray(value) ? (value.length ? value.join(", ") : "No event identified") : String(value ?? "No event identified").replaceAll("_", " ");
const currentCase = () => state.current?.case;
const annotation = () => state.draft[currentCase().case_id] || (state.draft[currentCase().case_id] = { questions: {} });
const questionAnnotation = (id) => annotation().questions[id] || { verdict: "", correction: "", evidence: [] };

async function api(path, options = {}) {
  const response = await fetch(`${cfg.apiBaseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || "Request failed"); error.status = response.status; throw error; }
  return data;
}
function activeQuestions() { return currentCase().questions.filter((q) => q.family === state.activeFamily); }
function isFamilyDone(family) { return currentCase().questions.filter((q) => q.family === family).every((q) => questionAnnotation(q.id).verdict); }
function completeCount() { return currentCase().questions.filter((q) => questionAnnotation(q.id).verdict).length; }
function render() { renderCases(); renderTabs(); renderCards(); renderGraph(); renderStatus(); }
function renderCases() {
  el("caseSelect").innerHTML = state.me.assigned_cases.map((id, index) => `<option value="${index}">${id}${state.me.completed_cases.includes(id) ? " - submitted" : ""}</option>`).join("");
  el("caseSelect").value = String(state.caseIndex);
}
function renderTabs() {
  const families = ["overview", "entry", "exposure", "influence", "action", "impact", "authorization", "evidence"];
  const labels = { overview:"Propagation overview", entry:"Entry and source", exposure:"Model exposure", influence:"Harmful influence", action:"Action or near miss", impact:"Impact or containment", authorization:"Authorization", evidence:"Evidence subgraph" };
  el("tabs").innerHTML = families.map((family) => `<button class="tab ${family === state.activeFamily ? "active" : ""}" data-family="${family}">${labels[family]}<span class="done">${isFamilyDone(family) ? "Done" : ""}</span></button>`).join("");
  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => { state.activeFamily = button.dataset.family; state.activeQuestion = activeQuestions()[0]?.id; render(); }));
  el("familyName").textContent = labels[state.activeFamily]; el("caseTitle").textContent = currentCase().case_id;
}
function renderCards() {
  const questions = activeQuestions(); if (!questions.some((q) => q.id === state.activeQuestion)) state.activeQuestion = questions[0]?.id;
  el("cards").innerHTML = questions.map((q) => {
    const a = questionAnnotation(q.id); const cited = q.highlight_edges.map((edge) => `<span class="pill">${edge}</span>`).join("") || "No algorithm-cited event";
    return `<article class="card ${q.id === state.activeQuestion ? "active" : ""}" data-question="${q.id}"><h2>${q.prompt}</h2><div class="answer"><b>TraceProv answer</b>${valueText(q.algorithm_answer)}</div><div class="verdicts">${[["supported","Supported"],["unsupported","Unsupported"],["insufficient","Insufficient evidence"],["unsure","Unsure"]].map(([value,label]) => `<label><input type="radio" name="${q.id}" value="${value}" ${a.verdict === value ? "checked" : ""}>${label}</label>`).join("")}</div><p class="note">Algorithm evidence: ${cited}</p><textarea data-question="${q.id}" placeholder="Optional correction or rationale">${a.correction || ""}</textarea><p class="note">Reviewer evidence: ${(a.evidence || []).map((id) => `<span class="pill">${id}</span>`).join("") || "click graph events to add evidence"}</p></article>`;
  }).join("");
  document.querySelectorAll(".card").forEach((card) => card.addEventListener("click", (event) => { if (event.target.closest("input,textarea,label")) return; state.activeQuestion = card.dataset.question; renderCards(); renderGraph(); }));
  document.querySelectorAll(".card input").forEach((input) => input.addEventListener("change", () => { annotation().questions[input.name] = { ...questionAnnotation(input.name), verdict: input.value }; renderTabs(); renderStatus(); }));
  document.querySelectorAll("textarea[data-question]").forEach((area) => area.addEventListener("input", () => { const id = area.dataset.question; annotation().questions[id] = { ...questionAnnotation(id), correction: area.value }; }));
}
function renderGraph() {
  const graph = state.current.graph; const question = currentCase().questions.find((q) => q.id === state.activeQuestion); const chosen = new Set([...(question?.highlight_edges || []), ...(questionAnnotation(question?.id || "").evidence || [])]);
  el("hint").textContent = `Evidence for ${question?.id || "question"}. Click an edge to add or remove reviewer evidence.`;
  if (state.cy) state.cy.destroy();
  const elements = [
    ...graph.nodes.map((node) => ({ data: { id: node.node_id, label: node.component_name || node.tool_name || node.node_type || node.node_id, kind: node.node_type } })),
    ...graph.edges.map((edge) => ({ data: { id: edge.edge_id, source: edge.src_node_id, target: edge.dst_node_id, label: edge.edge_id, detail: edge, highlighted: chosen.has(edge.edge_id), cited: question?.highlight_edges.includes(edge.edge_id) } }))
  ];
  state.cy = cytoscape({ container: el("graph"), elements, layout: { name:"dagre", rankDir:"LR", padding:24, nodeSep:34, rankSep:55 }, wheelSensitivity:.18, style:[
    { selector:"node", style:{ label:"data(label)", "font-size":10, "text-wrap":"wrap", "text-max-width":"85px", color:"#10233d", "background-color":"#dbeafe", "border-width":1, "border-color":"#78a5dd", width:42, height:42 } },
    { selector:"node[kind = 'Tool']", style:{ "background-color":"#d1fae5", "border-color":"#40a67b" } },
    { selector:"edge", style:{ label:"data(label)", width:1.5, "line-color":"#9aa9ba", "target-arrow-color":"#9aa9ba", "target-arrow-shape":"triangle", "curve-style":"bezier", "font-size":8, color:"#66768a", "text-background-color":"#fff", "text-background-opacity":1 } },
    { selector:"edge[cited]", style:{ "line-color":"#1468d4", "target-arrow-color":"#1468d4" } },
    { selector:"edge[highlighted]", style:{ width:4, "line-color":"#e07800", "target-arrow-color":"#e07800", color:"#9b5700", "font-weight":"bold" } }
  ]});
  state.cy.on("tap", "edge", (event) => { const edge = event.target.data("detail"); const a = questionAnnotation(state.activeQuestion); const ids = new Set(a.evidence || []); ids.has(edge.edge_id) ? ids.delete(edge.edge_id) : ids.add(edge.edge_id); annotation().questions[state.activeQuestion] = { ...a, evidence:[...ids] }; el("detail").textContent = JSON.stringify(edge, null, 2); renderCards(); renderGraph(); });
  state.cy.on("tap", "node", (event) => { el("detail").textContent = JSON.stringify(event.target.data(), null, 2); });
}
function renderStatus() { const count = completeCount(); el("progress").textContent = `${count}/16 reviewed`; el("caseStatus").textContent = count === 16 ? "All 16 answers are ready to submit." : `${16 - count} questions remain.`; el("submit").disabled = count !== 16 || state.me.completed_cases.includes(currentCase().case_id); }
async function loadCase(index) { state.caseIndex = index; const id = state.me.assigned_cases[index]; state.current = await api(`/cases/${id}`); state.activeFamily = "overview"; state.activeQuestion = null; render(); }
async function login(event) { event.preventDefault(); el("loginError").textContent = ""; try { const result = await api("/auth/login", { method:"POST", body:JSON.stringify({ username:el("username").value, password:el("password").value }) }); state.token = result.token; sessionStorage.setItem("traceprov-token", state.token); await start(); } catch (error) { el("loginError").textContent = error.message; } }
async function start() { try { state.me = await api("/me"); el("userName").textContent = state.me.username; el("loginView").hidden = true; el("appView").hidden = false; await loadCase(0); } catch (_) { sessionStorage.removeItem("traceprov-token"); state.token = null; el("loginView").hidden = false; el("appView").hidden = true; } }
async function submit() { try { await api(`/cases/${currentCase().case_id}/annotation`, { method:"POST", body:JSON.stringify(annotation()) }); state.me.completed_cases.push(currentCase().case_id); render(); alert("Submitted. Thank you for validating this case."); } catch (error) { alert(error.message); } }
el("loginForm").addEventListener("submit", login); el("caseSelect").addEventListener("change", (event) => loadCase(Number(event.target.value))); el("acceptFamily").addEventListener("click", () => { activeQuestions().forEach((q) => { annotation().questions[q.id] = { ...questionAnnotation(q.id), verdict:"supported" }; }); render(); }); el("fit").addEventListener("click", () => state.cy?.fit(undefined, 35)); el("submit").addEventListener("click", submit); el("logout").addEventListener("click", async () => { try { await api("/auth/logout", { method:"POST" }); } catch (_) {} sessionStorage.removeItem("traceprov-token"); location.reload(); });
if (!cfg.apiBaseUrl || cfg.apiBaseUrl.includes("REPLACE_")) el("loginError").textContent = "The study API has not been configured yet."; else if (state.token) start();
