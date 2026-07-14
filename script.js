const cases = [
  { id: "BJFC-2026-001", name: "章鱼", age: 43, org: "北京妇产医院", part: "卵巢", status: "待初审", progress: 65, diagnosis: "卵巢囊性包块复查", hidden: false },
  { id: "BJFC-2026-002", name: "陈土豆", age: 46, org: "北京妇产医院", part: "卵巢", status: "待初审", progress: 58, diagnosis: "卵巢占位性质待查", hidden: false },
  { id: "BJFC-2026-003", name: "彭定康", age: 52, org: "协作中心", part: "附件区", status: "初审中", progress: 72, diagnosis: "附件区囊实性包块", hidden: false },
  { id: "BJFC-2026-004", name: "麦当劳", age: 39, org: "区域分中心", part: "卵巢", status: "退审中", progress: 41, diagnosis: "影像资料待补充", hidden: false },
  { id: "BJFC-2026-005", name: "李华", age: 57, org: "北京妇产医院", part: "盆腔", status: "已入库", progress: 100, diagnosis: "术后病理结果复核", hidden: false },
];

cases.forEach((item) => {
  item.uploads = item.uploads || [];
});
const scanTypes = {
  gray: {
    title: "灰阶超声",
    note: "支持 JPEG、JPG、PNG、DICOM/DCM；DICOM/DCM 自动转换 JPG 预览。",
    empty: "暂无灰阶超声图像，请点击上传。",
  },
  color: {
    title: "彩色多普勒超声",
    note: "需保留血流显示区域，支持多张同类图像上传。",
    empty: "暂无彩色多普勒超声图像，请点击上传。",
  },
  spectrum: {
    title: "频谱多普勒超声",
    note: "建议上传包含测量值、采样门位置和速度曲线的图像。",
    empty: "暂无频谱多普勒图像，请点击上传。",
  },
  threeD: {
    title: "三维超声",
    note: "可上传三维超声及三维彩色多普勒超声图像。",
    empty: "暂无三维超声图像，请点击上传。",
  },
};

let selectedCase = cases[0];
let activeStatus = "待初审";
let activeScan = "gray";
let uploadTarget = "超声图像";
let uploadCategory = "gray";
let caseCounter = 102;
let uploadCounter = 0;
const selectedIds = new Set();
const selectedUploadIds = new Set();

const rows = document.querySelector("#caseRows");
const statusCards = document.querySelectorAll(".status-card");
const fileInput = document.querySelector("#fileInput");
const imageGrid = document.querySelector("#imageGrid");
const uploadZone = document.querySelector("#uploadZone");
const uploadList = document.querySelector("#uploadList");
const reportAllFiles = document.querySelector("#reportAllFiles");
const reportFileContainers = {
  lab: document.querySelector("#labFiles"),
  pathology: document.querySelector("#pathologyFiles"),
  ct: document.querySelector("#ctFiles"),
  other: document.querySelector("#otherFiles"),
  followup: document.querySelector("#followupFiles"),
};
const uploadLibraryMeta = document.querySelector("#uploadLibraryMeta");
const selectedCount = document.querySelector("#selectedCount");
const selectAllCases = document.querySelector("#selectAllCases");
const partFilter = document.querySelector("#partFilter");
const orgFilter = document.querySelector("#orgFilter");
const hiddenFilter = document.querySelector("#hiddenFilter");
const keywordInput = document.querySelector("#keywordInput");
const queryButton = document.querySelector("#queryButton");
const resetButton = document.querySelector("#resetButton");
const querySummary = document.querySelector("#querySummary");
const modalBackdrop = document.querySelector("#modalBackdrop");
const modalTitle = document.querySelector("#modalTitle");
const modalBody = document.querySelector("#modalBody");
const authGate = document.querySelector("#authGate");
const authLoginForm = document.querySelector("#authLoginForm");
const authRegisterForm = document.querySelector("#authRegisterForm");
let queryApplied = false;
let activeQuery = "";
let authenticated = false;

function setAuthenticated(value) {
  authenticated = Boolean(value);
  if (authenticated) {
    document.body.classList.remove("app-locked");
    if (authGate) authGate.setAttribute("hidden", "");
  } else {
    document.body.classList.add("app-locked");
    if (authGate) authGate.removeAttribute("hidden");
  }
}

function initializeAuthGate() {
  const params = new URLSearchParams(window.location.search);
  const enterFromStandaloneLogin = params.get("authed") === "1";
  setAuthenticated(enterFromStandaloneLogin);
  if (enterFromStandaloneLogin && window.history?.replaceState) {
    window.history.replaceState(null, "", window.location.pathname);
  }
}

function toast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  window.setTimeout(() => node.classList.add("show"), 10);
  window.setTimeout(() => {
    node.classList.remove("show");
    window.setTimeout(() => node.remove(), 180);
  }, 2200);
}

function openModal(title, body) {
  modalTitle.textContent = title;
  modalBody.innerHTML = body;
  modalBackdrop.hidden = false;
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalBody.innerHTML = "";
}

function exportCases() {
  const header = ["编号", "患者", "年龄", "机构", "检查部位", "状态", "完整度", "诊断"];
  const lines = cases.map((item) => [item.id, item.name, item.age, item.org, item.part, item.status, `${item.progress}%`, item.diagnosis].join(","));
  const blob = new Blob([`\ufeff${[header.join(","), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "卵巢平台病例数据.csv";
  link.click();
  URL.revokeObjectURL(url);
  toast("病例数据已导出");
}

function downloadTextFile(filename, text) {
  const blob = new Blob([`\ufeff${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function createDicomJpgDataUrl(fileName) {
  const title = fileName.replace(/\.(dcm|dicom)$/i, ".jpg");
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 640, 480);
  gradient.addColorStop(0, "#fff8fa");
  gradient.addColorStop(1, "#f3fbff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 640, 480);

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#fb416b";
  ctx.lineWidth = 4;
  ctx.fillRect(52, 42, 536, 360);
  ctx.strokeRect(52, 42, 536, 360);

  ctx.strokeStyle = "#69777d";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(320, 220, 92, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#a9b7bd";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(320, 220, 46, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#d8305a";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(206, 220);
  ctx.lineTo(434, 220);
  ctx.moveTo(320, 106);
  ctx.lineTo(320, 334);
  ctx.stroke();

  ctx.fillStyle = "#d8305a";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DICOM 自动转换 JPG", 320, 430);
  ctx.fillStyle = "#75676d";
  ctx.font = "18px Arial, sans-serif";
  ctx.fillText(title, 320, 462);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function dataUrlToBlob(dataUrl) {
  const [meta, data] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);/)?.[1] || "application/octet-stream";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

async function downloadUrl(url, filename) {
  const objectUrl = url.startsWith("data:") ? URL.createObjectURL(dataUrlToBlob(url)) : url;
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (objectUrl !== url) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 500);
}

function downloadTemplate() {
  downloadTextFile(
    "卵巢平台上传模板.csv",
    [
      "病例编号,资料类型,超声分类,文件名,是否必填,备注",
      "BJFC-2026-001,基本信息,,case-info.jpg,是,医院编号/医院名称/检查时间/仪器品牌型号",
      "BJFC-2026-001,临床信息,,clinical.png,是,年龄/BMI/月经婚育史/家族史/既往治疗史",
      "BJFC-2026-001,超声图像,灰阶超声,example.dcm,是,至少2张",
      "BJFC-2026-001,超声图像,彩色多普勒超声,example.jpg,是,至少1张",
      "BJFC-2026-001,超声报告,O-RADS分级,ultrasound.png,是,O-RADS 0-5",
      "BJFC-2026-001,检验结果-肿瘤标志物,,tumor-marker.png,是,CA125/HE4/AFP/CEA/CA199/CA153/SCC",
      "BJFC-2026-001,病理报告,,pathology.jpg,是,支持JPEG/JPG/PNG/DICOM/DCM",
      "BJFC-2026-001,随访结果,,followup.dcm,否,病例提交后可再次编辑",
    ].join("\n"),
  );
  toast("上传模板已下载");
}

function downloadReportTemplate() {
  downloadTextFile(
    "卵巢平台报告模板.csv",
    [
      "病例编号,报告类型,报告日期,文件名,关键指标/结论,审核状态",
      "BJFC-2026-001,检验结果-肿瘤标志物,2026-07-09,tumor-marker.png,CA125/HE4/AFP/CEA/CA199/CA153/SCC,待初审",
      "BJFC-2026-001,病理报告,2026-07-09,pathology.jpg,病理诊断结论,待初审",
      "BJFC-2026-001,CT / MRI / 核医学,2026-07-09,ct.dcm,影像诊断结论,待初审",
      "BJFC-2026-001,随访结果,2026-07-09,followup.png,复查实验室和超声结果,待初审",
      "BJFC-2026-001,其他,2026-07-09,other.jpg,补充说明,待初审",
    ].join("\n"),
  );
  toast("报告模板已下载");
}

function exportLedger() {
  const rows = cases.map((item) => {
    const uploadCount = item.uploads.length;
    const storedCount = item.uploads.filter((file) => file.stored).length;
    return [item.id, item.name, item.org, item.status, uploadCount, storedCount, `${item.progress}%`, item.diagnosis].join(",");
  });
  downloadTextFile("卵巢平台完整性台账.csv", ["病例编号,患者,机构,状态,上传文件数,入库文件数,完整度,诊断", ...rows].join("\n"));
  toast("完整性台账已导出");
}

function openNewCaseModal() {
  openModal(
    "新建病例",
    `
      <form class="modal-form" id="newCaseForm">
        <label>患者姓名<input name="name" required placeholder="请输入患者姓名" /></label>
        <label>年龄<input name="age" required type="number" min="1" max="120" placeholder="请输入年龄" /></label>
        <label>上传机构<select name="org"><option>北京妇产医院</option><option>协作中心</option><option>区域分中心</option></select></label>
        <label>检查部位<select name="part"><option>卵巢</option><option>附件区</option><option>盆腔</option></select></label>
        <label class="full">临床诊断<input name="diagnosis" required placeholder="请输入初步诊断" /></label>
        <div class="modal-actions">
          <button class="ghost modal-cancel" type="button">取消</button>
          <button class="primary" type="submit">保存病例</button>
        </div>
      </form>
    `,
  );
}

function openMessagesModal() {
  openModal(
    "消息提醒",
    `
      <div class="message-list">
        <div><strong>退审提醒</strong><span>BJFC-2026-073 需补充病理报告。</span></div>
        <div><strong>上传完成</strong><span>灰阶超声 DICOM 已转换为 JPG 预览。</span></div>
        <div><strong>复审通知</strong><span>3 条病例已进入待复审队列。</span></div>
      </div>
    `,
  );
}

function showPanel(panelId) {
  document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.toggle("active", panel.id === panelId));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.panel === panelId));
}

function statusClass(status) {
  if (status === "退审中" || status === "不认可数据" || status === "作废数据") return "color: var(--red)";
  if (status === "已入库" || status === "已支付") return "color: var(--green)";
  if (status === "初审中" || status === "待复审") return "color: var(--amber)";
  return "color: var(--cyan)";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(value) {
  const safe = escapeHtml(value);
  if (!activeQuery) return safe;
  const pattern = new RegExp(`(${escapeRegExp(activeQuery)})`, "gi");
  return safe.replace(pattern, '<mark class="search-hit">$1</mark>');
}

function getFilteredCases() {
  const part = partFilter?.value || "全部";
  const org = orgFilter?.value || "全部";
  const hidden = hiddenFilter?.value || "全部";
  const keyword = activeQuery.toLowerCase();
  return cases.filter((item) => {
    if (item.status !== activeStatus) return false;
    if (queryApplied && part !== "全部" && item.part !== part) return false;
    if (queryApplied && org !== "全部" && item.org !== org) return false;
    if (queryApplied && hidden === "未隐藏" && item.hidden) return false;
    if (queryApplied && hidden === "已隐藏" && !item.hidden) return false;
    if (!keyword) return true;
    const haystack = [item.id, item.name, item.age, item.org, item.part, item.status, item.diagnosis].join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
}

function updateQuerySummary(total) {
  if (!querySummary) return;
  if (!queryApplied && !activeQuery) {
    querySummary.hidden = true;
    querySummary.textContent = "";
    return;
  }
  const bits = [`状态：${activeStatus}`];
  if (partFilter?.value && partFilter.value !== "全部") bits.push(`检查部位：${partFilter.value}`);
  if (orgFilter?.value && orgFilter.value !== "全部") bits.push(`上传机构：${orgFilter.value}`);
  if (hiddenFilter?.value && hiddenFilter.value !== "全部") bits.push(`隐藏状态：${hiddenFilter.value}`);
  if (activeQuery) bits.push(`关键词：${activeQuery}`);
  querySummary.hidden = false;
  querySummary.innerHTML = `查询结果 ${total} 条<span>${bits.map(escapeHtml).join(" / ")}</span>`;
}

function updateStatusCounts() {
  const counts = cases.reduce((result, item) => {
    result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, {});
  statusCards.forEach((card) => {
    const countNode = card.querySelector("strong");
    if (countNode) countNode.textContent = counts[card.dataset.status] || 0;
  });
}

function renderRows() {
  updateStatusCounts();
  const list = getFilteredCases();
  if (!list.length) {
    rows.innerHTML = '<tr><td class="empty-row" colspan="10">未查询到符合条件的数据，请调整筛选条件后重试。</td></tr>';
    updateSelectedCount();
    updateQuerySummary(0);
    return;
  }
  rows.innerHTML = list
    .map(
      (item) => `
        <tr class="${item.id === selectedCase.id ? "selected" : ""}" data-id="${item.id}">
          <td><input class="case-check" type="checkbox" data-id="${item.id}" ${selectedIds.has(item.id) ? "checked" : ""} aria-label="选择 ${item.id}" /></td>
          <td>${highlightText(item.id)}</td>
          <td>${highlightText(item.name)}</td>
          <td>${item.age}</td>
          <td>${highlightText(item.org)}</td>
          <td>${highlightText(item.part)}</td>
          <td>${highlightText(item.diagnosis)}</td>
          <td><div class="progress" aria-label="完整度 ${item.progress}%"><span style="width:${item.progress}%"></span></div></td>
          <td style="${statusClass(item.status)}">${item.status}</td>
          <td><button class="row-action" type="button" data-id="${item.id}">查看</button></td>
        </tr>
      `,
    )
    .join("");
  updateSelectedCount();
  updateQuerySummary(list.length);
}

function createDeleteButton() {
  const button = document.createElement("button");
  button.className = "delete-file";
  button.type = "button";
  button.textContent = "删除";
  return button;
}

function updateDetail(item) {
  selectedCase = item;
  document.querySelector("#detailTitle").textContent = item.id;
  document.querySelector("#detailMeta").textContent = `${item.org} · ${item.part} · ${item.status}`;
  document.querySelector("#patientName").textContent = item.name;
  document.querySelector("#patientAge").textContent = item.age;
  document.querySelector("#patientDiagnosis").textContent = item.diagnosis;
  document.querySelector("#patientProgress").textContent = `${item.progress}%`;
  if (uploadLibraryMeta) uploadLibraryMeta.textContent = `${item.id} · ${item.name} · ${item.uploads.length} 份资料`;
  renderUploadViews();
}

function setCaseTab(tabId) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabId));
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.toggle("active", content.id === tabId));
}

function setScan(scanId) {
  activeScan = scanId;
  const scan = scanTypes[scanId];
  document.querySelectorAll(".mini-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.scan === scanId));
  document.querySelector("#scanTitle").textContent = scan.title;
  document.querySelector("#scanNote").textContent = scan.note;

  renderUploadViews();
}

function isAcceptedUpload(file) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".dcm") ||
    name.endsWith(".dicom") ||
    type === "image/jpeg" ||
    type === "image/png" ||
    type === "application/dicom"
  );
}

function isDicomFile(file) {
  const name = file.name.toLowerCase();
  return name.endsWith(".dcm") || name.endsWith(".dicom") || file.type.toLowerCase() === "application/dicom";
}

function addFiles(files) {
  const incoming = [...files];
  const accepted = incoming.filter(isAcceptedUpload);
  const rejected = incoming.length - accepted.length;
  if (!accepted.length) {
    toast("仅支持 JPEG、JPG、PNG、DICOM/DCM 格式");
    return;
  }
  accepted.forEach((file) => {
    uploadCounter += 1;
    const dicom = isDicomFile(file);
    const isImage = file.type.startsWith("image/") && !dicom;
    const category = uploadCategory || activeScan;
    const label = scanTypes[category]?.title || uploadTarget;
    const convertedSrc = dicom ? createDicomJpgDataUrl(file.name) : "";
    selectedCase.uploads.unshift({
      id: `upload-${Date.now()}-${uploadCounter}`,
      category,
      label,
      name: file.name,
      kind: dicom ? "dicom" : isImage ? "image" : "file",
      src: isImage ? URL.createObjectURL(file) : "",
      convertedSrc,
      convertedName: dicom ? file.name.replace(/\.(dcm|dicom)$/i, ".jpg") : "",
      stored: false,
      reviewStatus: "待初审",
      converted: dicom,
      uploadedAt: new Date().toLocaleString("zh-CN"),
    });
  });
  selectedCase.progress = Math.min(100, selectedCase.progress + accepted.length * 8);
  updateDetail(selectedCase);
  renderRows();
  toast(rejected ? `${uploadTarget}已加入上传列表，${rejected} 个非支持格式已忽略` : `${uploadTarget}已加入上传列表`);
}

function renderUploadViews() {
  if (!imageGrid || !selectedCase) return;
  const scan = scanTypes[activeScan];
  const currentScanUploads = selectedCase.uploads.filter((file) => file.category === activeScan);
  imageGrid.innerHTML = currentScanUploads.length
    ? currentScanUploads.map(renderUploadFigure).join("")
    : `<div class="empty-state scan-empty">${scan.empty}</div>`;

  if (uploadList) {
    uploadList.innerHTML = selectedCase.uploads.length
      ? selectedCase.uploads.map(renderUploadRow).join("")
      : '<div class="empty-state">当前病例暂无上传资料，请先选择资料类型并上传文件。</div>';
  }
  renderReportFiles();
  renderReportMatrix();
  if (uploadLibraryMeta) uploadLibraryMeta.textContent = `${selectedCase.id} · ${selectedCase.name} · ${selectedCase.uploads.length} 份资料`;
}

function renderUploadFigure(file) {
  const previewSrc = file.kind === "dicom" ? file.convertedSrc : file.src;
  const downloadLabel = file.converted ? "下载JPG" : "下载原图";
  const preview =
    file.kind === "image"
      ? `<button class="preview-button" data-preview-id="${file.id}" type="button" aria-label="放大预览 ${file.name}"><img src="${file.src}" alt="${file.name}" /></button>`
      : file.kind === "dicom"
        ? `<button class="dicom-preview preview-button" data-preview-id="${file.id}" type="button" aria-label="放大预览 ${file.convertedName}"><img src="${previewSrc}" alt="${file.convertedName}" /><span>DICOM/DCM 已自动转换为 JPG 预览</span></button>`
        : `<div class="empty-state">附件已上传</div>`;
  return `
    <figure class="${selectedUploadIds.has(file.id) ? "selected-upload" : ""}" data-upload-id="${file.id}" data-scan-card="${file.category}">
      <label class="upload-select"><input class="upload-check" type="checkbox" data-upload-id="${file.id}" ${selectedUploadIds.has(file.id) ? "checked" : ""} />选择</label>
      ${preview}
      <figcaption>${file.label} · ${file.name} · ${file.reviewStatus || (file.stored ? "已入库" : "待初审")}</figcaption>
      ${previewSrc ? `<button class="download-file" data-download-id="${file.id}" type="button">${downloadLabel}</button>` : ""}
      <button class="delete-file" data-upload-id="${file.id}" type="button">删除</button>
    </figure>
  `;
}

function renderUploadRow(file) {
  const status = file.converted ? "已自动转 JPG" : file.reviewStatus || (file.stored ? "已入库" : "待初审");
  const thumbSrc = file.converted ? file.convertedSrc : file.kind === "image" ? file.src : "";
  const downloadLabel = file.converted ? "下载JPG" : "下载原图";
  return `
    <div class="upload-row ${selectedUploadIds.has(file.id) ? "selected-upload" : ""}" data-upload-id="${file.id}">
      <input class="upload-check" type="checkbox" data-upload-id="${file.id}" ${selectedUploadIds.has(file.id) ? "checked" : ""} aria-label="选择 ${file.name}" />
      <span>${file.label}</span>
      <strong>${file.name}</strong>
      <em>${status}</em>
      ${thumbSrc ? `<button class="row-thumb" data-preview-id="${file.id}" type="button" aria-label="放大预览 ${file.convertedName || file.name}"><img src="${thumbSrc}" alt="${file.convertedName || file.name}" /></button>` : ""}
      ${thumbSrc ? `<button class="download-file inline" data-download-id="${file.id}" type="button">${downloadLabel}</button>` : ""}
      <button class="delete-file inline" data-upload-id="${file.id}" type="button">删除</button>
    </div>
  `;
}

function findUpload(uploadId) {
  return selectedCase.uploads.find((file) => file.id === uploadId);
}

function openPreview(uploadId) {
  const file = findUpload(uploadId);
  if (!file) return;
  const src = file.converted ? file.convertedSrc : file.src;
  if (!src) return;
  const name = file.converted ? file.convertedName : file.name;
  openModal(
    "JPG 图像预览",
    `
      <div class="preview-modal">
        <img src="${src}" alt="${name}" />
        <div class="modal-actions">
          <button class="ghost modal-cancel" type="button">关闭</button>
          <button class="primary download-file inline" data-download-id="${file.id}" type="button">${file.converted ? "下载JPG" : "下载原图"}</button>
        </div>
      </div>
    `,
  );
}

async function downloadUploadPreview(uploadId) {
  const file = findUpload(uploadId);
  if (!file) return;
  const src = file.converted ? file.convertedSrc : file.src;
  if (!src) return;
  const name = file.converted ? file.convertedName : file.name;
  await downloadUrl(src, name || "converted-preview.jpg");
  toast(`${name || "JPG图像"} 已开始下载`);
}

function renderReportFiles() {
  const reportCategories = ["lab", "pathology", "ct", "followup", "other"];
  reportCategories.forEach((category) => {
    const container = reportFileContainers[category];
    if (!container) return;
    const files = selectedCase.uploads.filter((file) => file.category === category);
    container.innerHTML = files.length ? files.map(renderUploadRow).join("") : '<div class="empty-state small">暂无报告文件</div>';
  });
  if (reportAllFiles) {
    const files = selectedCase.uploads.filter((file) => reportCategories.includes(file.category) || file.category === "history");
    reportAllFiles.innerHTML = files.length ? files.map(renderUploadRow).join("") : '<div class="empty-state">当前病例暂无报告文件。</div>';
  }
}

function renderReportMatrix() {
  const labels = { history: "病史", lab: "检验结果", pathology: "病理报告", ct: "CT / MRI / 核医学", followup: "随访结果", other: "其他" };
  Object.keys(labels).forEach((category) => {
    const files = selectedCase.uploads.filter((file) => file.category === category);
    const count = document.querySelector(`#${category}Count`);
    const status = document.querySelector(`#${category}Status`);
    if (count) count.textContent = `${files.length} 份`;
    if (status) {
      const allStored = files.length > 0 && files.every((file) => file.reviewStatus === "已入库");
      status.textContent = files.length ? (allStored ? "已入库" : "待审核") : "待补充";
      status.className = files.length ? (allStored ? "ok" : "warn") : "warn";
    }
  });
}

function deleteUpload(uploadId) {
  selectedCase.uploads = selectedCase.uploads.filter((file) => file.id !== uploadId);
  selectedUploadIds.delete(uploadId);
  selectedCase.progress = Math.max(0, selectedCase.progress - 5);
  updateDetail(selectedCase);
  renderRows();
  toast("文件已删除");
}

function storeCurrentCase() {
  const fileMode = selectedUploadIds.size > 0;
  const files = selectedUploadIds.size
    ? selectedCase.uploads.filter((file) => selectedUploadIds.has(file.id))
    : selectedCase.uploads;
  files.forEach((file) => {
    file.stored = true;
    file.reviewStatus = "已入库";
  });
  if (!fileMode) {
    selectedCase.status = "已入库";
    selectedCase.progress = 100;
    activeStatus = "已入库";
    statusCards.forEach((card) => card.classList.toggle("active", card.dataset.status === activeStatus));
  }
  selectedUploadIds.clear();
  updateDetail(selectedCase);
  renderRows();
  toast(fileMode ? "选中文件已入库" : `${selectedCase.id} 已入库保留`);
}

function updateSelectedCount() {
  if (selectedCount) selectedCount.textContent = `已选 ${selectedIds.size} 条`;
  if (selectAllCases) {
    const checks = [...document.querySelectorAll(".case-check")];
    selectAllCases.checked = checks.length > 0 && checks.every((input) => input.checked);
  }
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => showPanel(item.dataset.panel));
});

document.querySelectorAll(".flow-guide button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.panel) showPanel(button.dataset.panel);
    if (button.dataset.tabJump) setCaseTab(button.dataset.tabJump);
    if (button.dataset.action === "export-ledger") exportLedger();
  });
});

document.querySelectorAll(".site-nav button, .hero-actions button, .quick-grid button, .framework-grid button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.panel) showPanel(button.dataset.panel);
    if (button.dataset.tabJump) setCaseTab(button.dataset.tabJump);
  });
});

document.querySelectorAll(".auth-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.authView;
    document.querySelectorAll(".auth-switch button").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".auth-form").forEach((form) => form.classList.toggle("active", form.id.toLowerCase().includes(view)));
  });
});

if (authLoginForm) {
  authLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(authLoginForm);
    if (formData.get("username") !== "管理员" || formData.get("password") !== "12345678") {
      toast("账号或密码错误，请使用管理员 / 12345678");
      return;
    }
    setAuthenticated(true);
    toast("登录成功，已进入工作台");
  });
}

if (authRegisterForm) {
  authRegisterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    setAuthenticated(true);
    toast("注册成功，已进入工作台");
  });
}

imageGrid.addEventListener("click", async (event) => {
  const preview = event.target.closest("[data-preview-id]");
  if (preview) {
    openPreview(preview.dataset.previewId);
    return;
  }
  const download = event.target.closest("[data-download-id]");
  if (download) {
    await downloadUploadPreview(download.dataset.downloadId);
    return;
  }
  const check = event.target.closest(".upload-check");
  if (check) {
    if (check.checked) selectedUploadIds.add(check.dataset.uploadId);
    else selectedUploadIds.delete(check.dataset.uploadId);
    renderUploadViews();
    return;
  }
  const button = event.target.closest(".delete-file");
  if (!button) return;
  deleteUpload(button.dataset.uploadId);
});

if (uploadList) {
  uploadList.addEventListener("click", async (event) => {
    const preview = event.target.closest("[data-preview-id]");
    if (preview) {
      openPreview(preview.dataset.previewId);
      return;
    }
    const download = event.target.closest("[data-download-id]");
    if (download) {
      await downloadUploadPreview(download.dataset.downloadId);
      return;
    }
    const check = event.target.closest(".upload-check");
    if (check) {
      if (check.checked) selectedUploadIds.add(check.dataset.uploadId);
      else selectedUploadIds.delete(check.dataset.uploadId);
      renderUploadViews();
      return;
    }
    const button = event.target.closest(".delete-file");
    if (!button) return;
    deleteUpload(button.dataset.uploadId);
  });
}

document.querySelectorAll(".report-files, #reportAllFiles").forEach((container) => {
  container.addEventListener("click", async (event) => {
    const preview = event.target.closest("[data-preview-id]");
    if (preview) {
      openPreview(preview.dataset.previewId);
      return;
    }
    const download = event.target.closest("[data-download-id]");
    if (download) {
      await downloadUploadPreview(download.dataset.downloadId);
      return;
    }
    const check = event.target.closest(".upload-check");
    if (check) {
      if (check.checked) selectedUploadIds.add(check.dataset.uploadId);
      else selectedUploadIds.delete(check.dataset.uploadId);
      renderUploadViews();
      return;
    }
    const button = event.target.closest(".delete-file");
    if (!button) return;
    deleteUpload(button.dataset.uploadId);
  });
});

statusCards.forEach((card) => {
  card.addEventListener("click", () => {
    activeStatus = card.dataset.status;
    statusCards.forEach((item) => item.classList.remove("active"));
    card.classList.add("active");
    selectedIds.clear();
    renderRows();
  });
});

if (queryButton) {
  queryButton.addEventListener("click", () => {
    activeQuery = keywordInput?.value.trim() || "";
    queryApplied = true;
    selectedIds.clear();
    renderRows();
    toast("查询已完成，命中内容已在列表中标出");
  });
}

if (resetButton) {
  resetButton.addEventListener("click", () => {
    if (partFilter) partFilter.value = "全部";
    if (orgFilter) orgFilter.value = "全部";
    if (hiddenFilter) hiddenFilter.value = "全部";
    if (keywordInput) keywordInput.value = "";
    activeQuery = "";
    queryApplied = false;
    selectedIds.clear();
    renderRows();
    toast("筛选条件已重置");
  });
}

if (keywordInput) {
  keywordInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    queryButton?.click();
  });
}

rows.addEventListener("click", (event) => {
  const check = event.target.closest(".case-check");
  if (check) {
    if (check.checked) selectedIds.add(check.dataset.id);
    else selectedIds.delete(check.dataset.id);
    updateSelectedCount();
    return;
  }
  const target = event.target.closest("[data-id]");
  if (!target) return;
  const found = cases.find((item) => item.id === target.dataset.id);
  if (!found) return;
  updateDetail(found);
  renderRows();
  showPanel("casePanel");
});

if (selectAllCases) {
  selectAllCases.addEventListener("change", () => {
    document.querySelectorAll(".case-check").forEach((input) => {
      input.checked = selectAllCases.checked;
      if (input.checked) selectedIds.add(input.dataset.id);
      else selectedIds.delete(input.dataset.id);
    });
    updateSelectedCount();
  });
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setCaseTab(tab.dataset.tab));
});

document.querySelectorAll(".mini-tab").forEach((tab) => {
  tab.addEventListener("click", () => setScan(tab.dataset.scan));
});

document.querySelectorAll(".upload-button").forEach((button) => {
  button.addEventListener("click", () => {
    uploadTarget = button.dataset.upload || button.textContent.trim();
    uploadCategory = button.dataset.scan || button.dataset.category || "report";
    if (button.dataset.scan) setScan(button.dataset.scan);
    if (fileInput) {
      fileInput.value = "";
      fileInput.click();
    }
    toast(`准备上传：${uploadTarget}`);
  });
});

document.querySelector("#pickFiles").addEventListener("click", () => {
  uploadTarget = scanTypes[activeScan].title;
  uploadCategory = activeScan;
  fileInput.value = "";
  fileInput.click();
});

fileInput.addEventListener("change", () => addFiles(fileInput.files));

["dragenter", "dragover"].forEach((type) => {
  uploadZone.addEventListener(type, (event) => {
    event.preventDefault();
    uploadZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((type) => {
  uploadZone.addEventListener(type, (event) => {
    event.preventDefault();
    uploadZone.classList.remove("dragging");
  });
});

uploadZone.addEventListener("drop", (event) => {
  uploadTarget = scanTypes[activeScan].title;
  uploadCategory = activeScan;
  addFiles(event.dataTransfer.files);
});

document.querySelectorAll(".top-actions button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.action === "new-case") openNewCaseModal();
    if (button.dataset.action === "messages") openMessagesModal();
    if (button.dataset.action === "export") exportCases();
    if (button.dataset.action === "logout") {
      setAuthenticated(false);
      toast("已退出登录");
    }
  });
});

document.querySelectorAll(".panel-head button, .review-bar button").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "download-template") downloadTemplate();
    else if (action === "download-report-template") downloadReportTemplate();
    else if (action === "export-ledger") exportLedger();
    else if (action === "batch-export") exportSelectedCases();
    else if (action === "batch-store") batchStore();
    else if (action === "store-current") storeCurrentCase();
    else if (button.dataset.review) reviewCurrentCase(button.dataset.review);
    else if (button.textContent.includes("导出")) exportCases();
    else toast(`${button.textContent.trim()} 已响应`);
  });
});

modalBackdrop.addEventListener("click", async (event) => {
  const download = event.target.closest("[data-download-id]");
  if (download) {
    await downloadUploadPreview(download.dataset.downloadId);
    return;
  }
  if (event.target === modalBackdrop || event.target.closest(".modal-close") || event.target.closest(".modal-cancel")) closeModal();
});

modalBackdrop.addEventListener("submit", (event) => {
  const form = event.target.closest("#newCaseForm");
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  caseCounter += 1;
  const item = {
    id: `BJFC-2026-${caseCounter}`,
    name: data.get("name"),
    age: Number(data.get("age")),
    org: data.get("org"),
    part: data.get("part"),
    status: "待初审",
    progress: 20,
    diagnosis: data.get("diagnosis"),
    hidden: false,
    uploads: [],
  };
  cases.unshift(item);
  selectedCase = item;
  activeStatus = "待初审";
  statusCards.forEach((card) => card.classList.toggle("active", card.dataset.status === activeStatus));
  renderRows();
  updateDetail(item);
  closeModal();
  toast("新病例已创建");
});

function exportSelectedCases() {
  const list = cases.filter((item) => selectedIds.has(item.id));
  if (!list.length) {
    toast("请先选择需要导出的病例");
    return;
  }
  const header = ["编号", "患者", "年龄", "机构", "检查部位", "状态", "完整度", "上传文件数"];
  const lines = list.map((item) => [item.id, item.name, item.age, item.org, item.part, item.status, `${item.progress}%`, item.uploads.length].join(","));
  downloadTextFile("卵巢平台选中病例.csv", [header.join(","), ...lines].join("\n"));
  toast(`已导出 ${list.length} 条选中病例`);
}

function batchStore() {
  const list = cases.filter((item) => selectedIds.has(item.id));
  if (!list.length) {
    toast("请先选择需要入库的数据");
    return;
  }
  list.forEach((item) => {
    item.status = "已入库";
    item.progress = 100;
    item.uploads.forEach((file) => {
      file.stored = true;
      file.reviewStatus = "已入库";
    });
  });
  activeStatus = "已入库";
  statusCards.forEach((card) => card.classList.toggle("active", card.dataset.status === activeStatus));
  selectedIds.clear();
  renderRows();
  if (list.some((item) => item.id === selectedCase.id)) updateDetail(selectedCase);
  toast(`已入库 ${list.length} 条数据`);
}

function reviewCurrentCase(status) {
  if (selectedUploadIds.size) {
    selectedCase.uploads.forEach((file) => {
      if (!selectedUploadIds.has(file.id)) return;
      file.reviewStatus = status;
      file.stored = status === "已入库";
    });
    selectedUploadIds.clear();
    updateDetail(selectedCase);
    renderRows();
    toast(`选中文件已更新为：${status}`);
    return;
  }
  selectedCase.status = status;
  if (status === "已入库") {
    selectedCase.progress = 100;
    selectedCase.uploads.forEach((file) => {
      file.stored = true;
      file.reviewStatus = "已入库";
    });
  }
  activeStatus = status;
  statusCards.forEach((card) => card.classList.toggle("active", card.dataset.status === activeStatus));
  updateDetail(selectedCase);
  renderRows();
  toast(`${selectedCase.id} 已更新为：${status}`);
}

initializeAuthGate();
renderRows();
updateDetail(selectedCase);
setScan(activeScan);
