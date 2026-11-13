const cfg = window.TRACEPROV_PORTAL_CONFIG || {};
const state = { account: null, data: null, caseIndex: 0, family: "overview", question: null, current: null, drafts: {}, cy: null };
const $ = (id) => document.getElementById(id);
const valueText = (value) => value === true || value === "True" ? "Yes" : value === false || value === "False" ? "No" : Array.isArray(value) ? (value.length ? value.join(", ") : "No event identified") : String(value ?? "No event identified").replaceAll("_", " ");
const currentCase = () => state.current.case;
const annotation = () => state.drafts[currentCase().case_id] || (state.drafts[currentCase().case_id] = { questions: {} });
const answer = (id) => annotation().questions[id] || { verdict: "", correction: "", evidence: [] };
const activeQuestions = () => currentCase().questions.filter((q) => q.family === state.family);
const completeCount = () => currentCase().questions.filter((q) => answer(q.id).verdict).length;
const labels = { overview:"Propagation overview", entry:"Entry and source", exposure:"Model exposure", influence:"Harmful influence", action:"Action or near miss", impact:"Impact or containment", authorization:"Authorization", evidence:"Evidence subgraph" };

async function sha256(value) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join(""); }
function saveDrafts() { sessionStorage.setItem(`traceprov-drafts:${state.account.username}`, JSON.stringify(state.drafts)); }
function familyDone(family) { return currentCase().questions.filter((q) => q.family === family).every((q) => answer(q.id).verdict); }
function render() { renderCases(); renderTabs(); renderCards(); renderGraph(); renderStatus(); }

function renderCases() { $("caseSelect").innerHTML = state.account.assigned_cases.map((id, index) => `<option value="${index}">${id}</option>`).join(""); $("caseSelect").value = state.caseIndex; }
function renderTabs() {
  $("tabs").innerHTML = Object.entries(labels).map(([id, name]) => `<button class="tab ${id === state.family ? "active" : ""}" data-family="${id}">${name}<span class="done">${familyDone(id) ? "Done" : ""}</span></button>`).join("");
  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => { state.family = button.dataset.family; state.question = activeQuestions()[0]?.id; render(); }));
  $("familyName").textContent = labels[state.family]; $("caseTitle").textContent = currentCase().case_id;
}
function renderCards() {
  const questions = activeQuestions(); if (!questions.some((q) => q.id === state.question)) state.question = questions[0]?.id;
  $("cards").innerHTML = questions.map((q) => { const a = answer(q.id); const cited = q.highlight_edges.map((edge) => `<span class="pill">${edge}</span>`).join("") || "No algorithm-cited event"; return `<article class="card ${q.id === state.question ? "active" : ""}" data-question="${q.id}"><h2>${q.prompt}</h2><div class="answer"><b>TraceProv answer</b>${valueText(q.algorithm_answer)}</div><div class="verdicts">${[["supported","Supported"],["unsupported","Unsupported"],["insufficient","Insufficient evidence"],["unsure","Unsure"]].map(([value,label]) => `<label><input type="radio" name="${q.id}" value="${value}" ${a.verdict === value ? "checked" : ""}>${label}</label>`).join("")}</div><p class="note">Algorithm evidence: ${cited}</p><textarea data-question="${q.id}" placeholder="Optional correction or rationale">${a.correction || ""}</textarea><p class="note">Reviewer evidence: ${(a.evidence || []).map((id) => `<span class="pill">${id}</span>`).join("") || "Click graph edges to add evidence."}</p></article>`; }).join("");
  document.querySelectorAll(".card").forEach((card) => card.addEventListener("click", (event) => { if (event.target.closest("input,textarea,label")) return; state.question = card.dataset.question; renderCards(); renderGraph(); }));
  document.querySelectorAll(".card input").forEach((input) => input.addEventListener("change", () => { annotation().questions[input.name] = { ...answer(input.name), verdict: input.value }; saveDrafts(); renderTabs(); renderStatus(); }));
  document.querySelectorAll("textarea[data-question]").forEach((area) => area.addEventListener("input", () => { annotation().questions[area.dataset.question] = { ...answer(area.dataset.question), correction: area.value }; saveDrafts(); }));
}
function renderGraph() {
  const graph = state.current.graph; const question = currentCase().questions.find((q) => q.id === state.question); const selected = new Set([...(question?.highlight_edges || []), ...(answer(question?.id || "").evidence || [])]);
  $("hint").textContent = `Evidence for ${question?.id || "question"}. Click an edge to add or remove reviewer evidence.`; if (state.cy) state.cy.destroy();
  const elements = [...graph.nodes.map((node) => ({ data:{ id:node.node_id,label:node.component_name || node.tool_name || node.node_type || node.node_id,kind:node.node_type } })), ...graph.edges.map((edge) => ({ data:{ id:edge.edge_id,source:edge.src_node_id,target:edge.dst_node_id,label:edge.edge_id,detail:edge,selected:selected.has(edge.edge_id),cited:question?.highlight_edges.includes(edge.edge_id) } }))];
  state.cy = cytoscape({ container:$("graph"), elements, layout:{name:"dagre",rankDir:"LR",padding:24,nodeSep:34,rankSep:55}, wheelSensitivity:.18, style:[{selector:"node",style:{label:"data(label)","font-size":10,"text-wrap":"wrap","text-max-width":"85px",color:"#10233d","background-color":"#dbeafe","border-width":1,"border-color":"#78a5dd",width:42,height:42}},{selector:"node[kind = 'Tool']",style:{"background-color":"#d1fae5","border-color":"#40a67b"}},{selector:"edge",style:{label:"data(label)",width:1.5,"line-color":"#9aa9ba","target-arrow-color":"#9aa9ba","target-arrow-shape":"triangle","curve-style":"bezier","font-size":8,color:"#66768a","text-background-color":"#fff","text-background-opacity":1}},{selector:"edge[cited]",style:{"line-color":"#1468d4","target-arrow-color":"#1468d4"}},{selector:"edge[selected]",style:{width:4,"line-color":"#e07800","target-arrow-color":"#e07800",color:"#9b5700","font-weight":"bold"}}] });
  state.cy.on("tap", "edge", (event) => { const edge = event.target.data("detail"), a = answer(state.question), evidence = new Set(a.evidence || []); evidence.has(edge.edge_id) ? evidence.delete(edge.edge_id) : evidence.add(edge.edge_id); annotation().questions[state.question] = { ...a, evidence:[...evidence] }; $("detail").textContent = JSON.stringify(edge, null, 2); saveDrafts(); renderCards(); renderGraph(); });
  state.cy.on("tap", "node", (event) => { $("detail").textContent = JSON.stringify(event.target.data(), null, 2); });
}
function renderStatus() { const count = completeCount(); $("progress").textContent = `${count}/16 reviewed`; $("caseStatus").textContent = count === 16 ? "All 16 answers are ready to submit." : `${16 - count} questions remain.`; $("submit").disabled = count !== 16; }
async function loadCase(index) { state.caseIndex = index; const caseId = state.account.assigned_cases[index]; const payload = state.data.cases.find((item) => item.case_id === caseId); const graph = await fetch(payload.graph_file).then((response) => response.json()); state.current = { case:payload, graph }; state.family = "overview"; state.question = null; render(); }
async function login(event) {
  event.preventDefault(); $("loginError").textContent = ""; const username = $("username").value.trim().toLowerCase(); const account = (window.TRACEPROV_STUDY_ACCOUNTS || []).find((item) => item.username === username);
  if (!account || await sha256($("password").value) !== account.password_sha256) { $("loginError").textContent = "Invalid study username or password."; return; }
  state.account = account; state.drafts = JSON.parse(sessionStorage.getItem(`traceprov-drafts:${username}`) || "{}"); state.data = await fetch("data/cases.json").then((response) => response.json()); $("userName").textContent = username; $("loginView").hidden = true; $("appView").hidden = false; await loadCase(0);
}
function submitToGoogleForm() {
  const fields = cfg.googleFormFields || {}; const endpoint = cfg.googleFormResponseUrl || "";
  if (!endpoint.includes("/formResponse") || !fields.reviewer || !fields.case || !fields.submittedAt || !fields.annotationJson) { alert("Google Form collection has not been configured yet."); return; }
  const payload = { study:"TraceProv Human Validation", study_version:"1.0", reviewer_id:state.account.username, case_id:currentCase().case_id, submitted_at:new Date().toISOString(), questions:annotation().questions };
  const form = new URLSearchParams(); form.set(fields.reviewer, payload.reviewer_id); form.set(fields.case, payload.case_id); form.set(fields.submittedAt, payload.submitted_at); form.set(fields.annotationJson, JSON.stringify(payload));
  fetch(endpoint, { method:"POST", mode:"no-cors", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, body:form.toString() }).then(() => { alert("Submitted to the study response sheet. Thank you."); }).catch(() => { alert("The browser could not submit the response. Check your network and try again."); });
}
$("loginForm").addEventListener("submit", login); $("caseSelect").addEventListener("change", (event) => loadCase(Number(event.target.value))); $("acceptFamily").addEventListener("click", () => { activeQuestions().forEach((q) => { annotation().questions[q.id] = { ...answer(q.id), verdict:"supported" }; }); saveDrafts(); render(); }); $("fit").addEventListener("click", () => state.cy?.fit(undefined,35)); $("submit").addEventListener("click", submitToGoogleForm); $("logout").addEventListener("click", () => location.reload());
