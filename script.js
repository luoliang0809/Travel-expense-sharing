const APP_INFO = {
  name: "旅行分账",
  title: "朋友出游自动分账 H5",
  description: "免注册、不用登录、点开即用的旅行分账工具。"
};

const KEYWORDS = {
  create: ["创建旅行", "旅行账本", "房间码加入", "微信分享加入", "免注册", "点开即用"],
  bill: ["记一笔", "随手记一笔", "AA均摊", "付款人", "参与人", "自定义金额"],
  overview: ["账目总览", "总消费金额", "人均消费", "分类占比", "明细账单列表", "谁欠我"],
  settlement: ["一键结算", "最少转账笔数", "谁转给谁", "债务清零", "手动标记已转账"]
};

const STORE_KEY = "trip-split-h5-store-v3";
const CATEGORY_COLORS = {
  交通: "#ff7a52",
  住宿: "#5b8dff",
  餐饮: "#ff9a31",
  门票: "#33c979",
  购物: "#ffc531",
  娱乐: "#aa62ff",
  通讯: "#27c2b1",
  其他: "#98a0ad"
};

const els = {
  tags: Array.from(document.querySelectorAll("[data-keywords]")),
  structuredData: document.getElementById("structured-data"),
  metaKeywords: document.getElementById("metaKeywords"),
  tripName: document.getElementById("tripName"),
  tripStart: document.getElementById("tripStart"),
  tripEnd: document.getElementById("tripEnd"),
  currencySelect: document.getElementById("currencySelect"),
  memberInput: document.getElementById("memberNameInput"),
  addMemberBtn: document.getElementById("addMemberBtn"),
  memberList: document.getElementById("memberList"),
  memberCountLabel: document.getElementById("memberCountLabel"),
  createTripBtn: document.getElementById("createTripBtn"),
  resetTripBtn: document.getElementById("resetTripBtn"),
  roomCodeText: document.getElementById("roomCodeText"),
  shareLinkText: document.getElementById("shareLinkText"),
  invitePreviewText: document.getElementById("invitePreviewText"),
  copyInviteBtn: document.getElementById("copyInviteBtn"),
  nativeShareBtn: document.getElementById("nativeShareBtn"),
  categoryGrid: document.getElementById("categoryGrid"),
  billAmount: document.getElementById("billAmount"),
  billNote: document.getElementById("billNote"),
  paidBy: document.getElementById("paidBy"),
  participantChips: document.getElementById("participantChips"),
  customSplitWrap: document.getElementById("customSplitWrap"),
  billEditBanner: document.getElementById("billEditBanner"),
  billEditText: document.getElementById("billEditText"),
  cancelEditBillBtn: document.getElementById("cancelEditBillBtn"),
  billStatusText: document.getElementById("billStatusText"),
  saveBillBtn: document.getElementById("saveBillBtn"),
  overviewTripName: document.getElementById("overviewTripName"),
  overviewTripMeta: document.getElementById("overviewTripMeta"),
  overviewMembers: document.getElementById("overviewMembers"),
  totalExpense: document.getElementById("totalExpense"),
  avgExpense: document.getElementById("avgExpense"),
  billCountText: document.getElementById("billCountText"),
  donutChart: document.getElementById("donutChart"),
  categoryLegend: document.getElementById("categoryLegend"),
  expenseList: document.getElementById("expenseList"),
  settlePreview: document.getElementById("settlePreview"),
  settlementSummaryText: document.getElementById("settlementSummaryText"),
  settlementHeadlineAmount: document.getElementById("settlementHeadlineAmount"),
  settlementHeadlineNote: document.getElementById("settlementHeadlineNote"),
  settlementList: document.getElementById("settlementList"),
  settlementProgressText: document.getElementById("settlementProgressText"),
  settlementProgressBar: document.getElementById("settlementProgressBar"),
  groupSummaryText: document.getElementById("groupSummaryText"),
  copySettlementSummaryBtn: document.getElementById("copySettlementSummaryBtn"),
  shareSettlementBtn: document.getElementById("shareSettlementBtn")
};

const uiState = {
  selectedCategory: "交通",
  billType: "expense",
  splitMode: "equal",
  selectedParticipants: [],
  customShares: {},
  editingBillId: ""
};

function defaultState() {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 4);
  return {
    trip: {
      name: "",
      start: today.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      currency: "CNY",
      roomCode: "",
      createdAt: ""
    },
    members: [],
    bills: [],
    settledTransfers: {}
  };
}

function readState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      trip: { ...defaultState().trip, ...(parsed.trip || {}) },
      members: Array.isArray(parsed.members) ? parsed.members : [],
      bills: Array.isArray(parsed.bills) ? parsed.bills : [],
      settledTransfers: parsed.settledTransfers || {}
    };
  } catch {
    return defaultState();
  }
}

function writeState(nextState) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(nextState));
  } catch (error) {
    console.warn("Local storage unavailable, using in-memory state only.", error);
  }
}

let store = readState();

function page() {
  return document.body.dataset.page || "";
}

function symbol() {
  return { CNY: "¥", USD: "$", HKD: "HK$" }[store.trip.currency] || "¥";
}

function formatMoney(value) {
  return `${symbol()} ${Number(value || 0).toFixed(2)}`;
}

function renderTags() {
  els.tags.forEach((node) => {
    const items = KEYWORDS[node.dataset.keywords] || [];
    node.innerHTML = items.map((item) => `<span>${item}</span>`).join("");
  });
}

function injectSchema() {
  const allKeywords = Array.from(new Set(Object.values(KEYWORDS).flat()));
  if (els.metaKeywords) els.metaKeywords.content = allKeywords.join(",");
  if (!els.structuredData) return;
  els.structuredData.textContent = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `${APP_INFO.name} ${APP_INFO.title}`,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
      keywords: allKeywords.join(",")
    }
  ]);
}

function randomRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function tripReady() {
  return Boolean(store.trip.name && store.members.length);
}

function formatTripMeta() {
  if (!store.trip.name) return "先去创建旅行并记一笔";
  const start = store.trip.start || "--";
  const end = store.trip.end || "--";
  const days = store.trip.start && store.trip.end
    ? Math.max(1, Math.round((new Date(store.trip.end) - new Date(store.trip.start)) / 86400000) + 1)
    : "--";
  return `${start} - ${end} · 共 ${days} 天`;
}

function buildInviteText() {
  const current = new URL(window.location.href);
  const baseUrl = `${current.origin}${current.pathname.replace(/[^/]*$/, "index.html")}`;
  const shareUrl = `${baseUrl}?trip=${encodeURIComponent(store.trip.name || "旅行分账")}&room=${encodeURIComponent(store.trip.roomCode || "")}`;
  const members = store.members.length ? `当前成员：${store.members.join("、")}。` : "";
  return {
    shareUrl,
    text: `我创建了旅行账本《${store.trip.name || "旅行分账"}》，房间码：${store.trip.roomCode || "待生成"}。${members}点链接加入：${shareUrl}`
  };
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand("copy");
  document.body.removeChild(textarea);
  return success;
}

function renderMemberList() {
  if (!els.memberList) return;
  els.memberList.innerHTML = "";
  els.memberList.classList.toggle("empty", store.members.length === 0);
  if (!store.members.length) {
    els.memberList.innerHTML = `<p class="empty-text">还没有成员，先输入昵称再添加</p>`;
  } else {
    store.members.forEach((member) => {
      const chip = document.createElement("span");
      chip.className = "avatar-chip";
      chip.innerHTML = `<span>${member}</span><button type="button" data-remove-member="${member}" aria-label="删除 ${member}">×</button>`;
      els.memberList.appendChild(chip);
    });
  }
  if (els.memberCountLabel) {
    els.memberCountLabel.textContent = `旅行成员（${store.members.length}/20）`;
  }
}

function updateShareView(message) {
  if (els.roomCodeText) els.roomCodeText.textContent = store.trip.roomCode || "------";
  if (els.shareLinkText) els.shareLinkText.textContent = message;
  if (els.invitePreviewText) {
    els.invitePreviewText.textContent = tripReady()
      ? buildInviteText().text
      : "先创建旅行，再复制邀请文案或直接系统分享。";
  }
}

function hydrateCreatePage() {
  if (!els.tripName) return;
  els.tripName.value = store.trip.name;
  els.tripStart.value = store.trip.start;
  els.tripEnd.value = store.trip.end;
  els.currencySelect.value = store.trip.currency;
  renderMemberList();
  updateShareView("创建后可分享");
}

function bindCreatePage() {
  if (!els.tripName) return;

  const addMember = () => {
    const name = (els.memberInput?.value || "").trim().slice(0, 6);
    if (!name || store.members.length >= 20 || store.members.includes(name)) return;
    store.members.push(name);
    writeState(store);
    els.memberInput.value = "";
    renderMemberList();
    updateShareView("成员已更新，创建后可分享");
  };

  els.addMemberBtn?.addEventListener("click", addMember);
  els.memberInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addMember();
    }
  });

  els.memberList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-member]");
    if (!button) return;
    const member = button.dataset.removeMember;
    store.members = store.members.filter((item) => item !== member);
    store.bills = store.bills
      .map((bill) => ({
        ...bill,
        participants: bill.participants.filter((item) => item !== member),
        shares: Object.fromEntries(Object.entries(bill.shares || {}).filter(([key]) => key !== member))
      }))
      .filter((bill) => bill.paidBy !== member && bill.participants.length);
    writeState(store);
    renderMemberList();
    updateShareView("成员已删除，相关账单已同步更新");
  });

  els.tripName.addEventListener("input", () => {
    store.trip.name = els.tripName.value.trim();
    writeState(store);
    updateShareView("行程名称已更新，创建后可分享");
  });

  els.tripStart?.addEventListener("change", () => {
    store.trip.start = els.tripStart.value;
    writeState(store);
  });

  els.tripEnd?.addEventListener("change", () => {
    store.trip.end = els.tripEnd.value;
    writeState(store);
  });

  els.currencySelect?.addEventListener("change", () => {
    store.trip.currency = els.currencySelect.value;
    writeState(store);
  });

  els.createTripBtn?.addEventListener("click", () => {
    store.trip.name = els.tripName.value.trim();
    store.trip.start = els.tripStart.value;
    store.trip.end = els.tripEnd.value;
    if (store.trip.end < store.trip.start) {
      els.tripEnd.value = store.trip.start;
      store.trip.end = store.trip.start;
    }
    store.trip.currency = els.currencySelect.value;
    store.trip.roomCode = randomRoomCode();
    store.trip.createdAt = new Date().toISOString();
    writeState(store);
    updateShareView(`${store.trip.name || "旅行"} 已创建，可复制分享`);
  });

  els.resetTripBtn?.addEventListener("click", () => {
    if (!window.confirm("这会清空当前旅行、成员和账单，确定继续吗？")) return;
    store = defaultState();
    writeState(store);
    hydrateCreatePage();
    updateShareView("当前旅行已重置");
  });

  els.copyInviteBtn?.addEventListener("click", async () => {
    if (!tripReady()) {
      updateShareView("先填旅行名称并添加成员");
      return;
    }
    await copyText(buildInviteText().text);
    updateShareView(window.location.protocol === "file:" ? "已复制邀请内容；本地链接仅适合预览，正式分享需要上线地址。" : "邀请内容已复制，可直接发给朋友");
  });

  els.nativeShareBtn?.addEventListener("click", async () => {
    if (!tripReady()) {
      updateShareView("先填旅行名称并添加成员");
      return;
    }
    const payload = buildInviteText();
    if (navigator.share) {
      try {
        await navigator.share({ title: APP_INFO.name, text: payload.text, url: payload.shareUrl });
        updateShareView("已调起系统分享");
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          updateShareView("你取消了分享");
          return;
        }
      }
    }
    await copyText(payload.text);
    updateShareView("当前环境不支持系统分享，已自动复制邀请内容");
  });
}

function bindToggleGroups() {
  document.querySelectorAll("[data-toggle-group]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      group.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      if (group.dataset.toggleGroup === "billType") uiState.billType = button.dataset.billType || "expense";
      if (group.dataset.toggleGroup === "splitMode") {
        uiState.splitMode = button.dataset.splitMode || "equal";
        renderCustomSplitInputs();
      }
    });
  });
}

function hydrateBillPage() {
  if (!els.paidBy) return;
  const members = store.members.length ? store.members : ["你"];
  uiState.selectedParticipants = [...members];
  uiState.customShares = {};
  uiState.editingBillId = "";
  els.paidBy.innerHTML = members.map((member) => `<option value="${member}">${member}</option>`).join("");
  renderParticipantChips();
  renderCustomSplitInputs();
  hydrateEditBill();
}

function renderParticipantChips() {
  if (!els.participantChips) return;
  const members = store.members.length ? store.members : ["你"];
  els.participantChips.innerHTML = members.map((member) => {
    const active = uiState.selectedParticipants.includes(member) ? "active" : "";
    return `<button class="chip ${active}" data-member="${member}" type="button">${member}</button>`;
  }).join("");
}

function renderCustomSplitInputs() {
  if (!els.customSplitWrap) return;
  const show = uiState.splitMode === "custom" && uiState.selectedParticipants.length > 0;
  els.customSplitWrap.classList.toggle("hidden", !show);
  if (!show) {
    els.customSplitWrap.innerHTML = "";
    return;
  }
  els.customSplitWrap.innerHTML = uiState.selectedParticipants.map((member) => `
    <label class="split-row-item">
      <span>${member}</span>
      <input data-share-member="${member}" type="number" step="0.01" min="0" placeholder="0.00" value="${uiState.customShares[member] ?? ""}">
    </label>
  `).join("");
}

function setBillEditUi(bill) {
  if (els.billEditBanner) els.billEditBanner.classList.toggle("hidden", !bill);
  if (els.billEditText && bill) {
    els.billEditText.textContent = `正在编辑：${bill.category}${bill.note ? ` · ${bill.note}` : ""}`;
  }
  if (els.saveBillBtn) {
    els.saveBillBtn.textContent = bill ? "保存修改" : "保存";
  }
}

function clearBillForm(resetStatus = true) {
  uiState.editingBillId = "";
  uiState.selectedCategory = "交通";
  uiState.billType = "expense";
  uiState.splitMode = "equal";
  uiState.customShares = {};
  uiState.selectedParticipants = store.members.length ? [...store.members] : ["你"];
  if (els.billAmount) els.billAmount.value = "";
  if (els.billNote) els.billNote.value = "";
  if (els.paidBy) els.paidBy.selectedIndex = 0;
  document.querySelectorAll('[data-toggle-group="billType"] button').forEach((btn, index) => btn.classList.toggle("active", index === 0));
  document.querySelectorAll('[data-toggle-group="splitMode"] button').forEach((btn, index) => btn.classList.toggle("active", index === 0));
  els.categoryGrid?.querySelectorAll(".category-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.category === "交通"));
  renderParticipantChips();
  renderCustomSplitInputs();
  setBillEditUi(null);
  if (resetStatus && els.billStatusText) {
    els.billStatusText.textContent = "30 秒记完，不打断旅行节奏。";
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("edit");
  window.history.replaceState({}, "", url.toString());
}

function hydrateEditBill() {
  const editId = new URLSearchParams(window.location.search).get("edit");
  if (!editId) {
    setBillEditUi(null);
    return;
  }
  const bill = store.bills.find((item) => item.id === editId);
  if (!bill) return;
  uiState.editingBillId = bill.id;
  uiState.selectedCategory = bill.category;
  uiState.billType = bill.type;
  uiState.splitMode = bill.splitMode || "equal";
  uiState.selectedParticipants = [...bill.participants];
  uiState.customShares = { ...(bill.shares || {}) };
  if (els.billAmount) els.billAmount.value = bill.amount;
  if (els.billNote) els.billNote.value = bill.note || "";
  if (els.paidBy) els.paidBy.value = bill.paidBy;
  document.querySelectorAll('[data-toggle-group="billType"] button').forEach((btn) => btn.classList.toggle("active", btn.dataset.billType === bill.type));
  document.querySelectorAll('[data-toggle-group="splitMode"] button').forEach((btn) => btn.classList.toggle("active", btn.dataset.splitMode === uiState.splitMode));
  els.categoryGrid?.querySelectorAll(".category-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.category === bill.category));
  renderParticipantChips();
  renderCustomSplitInputs();
  setBillEditUi(bill);
}

function bindBillPage() {
  if (!els.participantChips) return;

  els.categoryGrid?.addEventListener("click", (event) => {
    const button = event.target.closest(".category-btn");
    if (!button) return;
    uiState.selectedCategory = button.dataset.category || "交通";
    els.categoryGrid.querySelectorAll(".category-btn").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });

  els.participantChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-member]");
    if (!button) return;
    const member = button.dataset.member;
    if (uiState.selectedParticipants.includes(member)) {
      if (uiState.selectedParticipants.length === 1) return;
      uiState.selectedParticipants = uiState.selectedParticipants.filter((item) => item !== member);
    } else {
      uiState.selectedParticipants.push(member);
    }
    renderParticipantChips();
    renderCustomSplitInputs();
  });

  els.customSplitWrap?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-share-member]");
    if (!input) return;
    uiState.customShares[input.dataset.shareMember] = Number(input.value || 0);
  });

  els.cancelEditBillBtn?.addEventListener("click", () => {
    clearBillForm();
  });

  els.saveBillBtn?.addEventListener("click", () => {
    if (!tripReady()) {
      els.billStatusText.textContent = "先去创建旅行并添加成员，再来记账。";
      return;
    }
    const amount = Number(els.billAmount.value || 0);
    if (!(amount > 0)) {
      els.billStatusText.textContent = "请先输入正确金额。";
      return;
    }
    const participants = [...uiState.selectedParticipants];
    if (!participants.length) {
      els.billStatusText.textContent = "至少要选一个参与人。";
      return;
    }

    let shares = {};
    if (uiState.splitMode === "custom") {
      shares = participants.reduce((result, member) => {
        result[member] = Number(uiState.customShares[member] || 0);
        return result;
      }, {});
      const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - amount) > 0.01) {
        els.billStatusText.textContent = "自定义分摊金额之和要等于总金额。";
        return;
      }
    }

    const bill = {
      id: uiState.editingBillId || `bill_${Date.now()}`,
      type: uiState.billType,
      category: uiState.selectedCategory,
      amount,
      note: els.billNote.value.trim(),
      paidBy: els.paidBy.value,
      participants,
      splitMode: uiState.splitMode,
      shares,
      createdAt: new Date().toISOString()
    };

    if (uiState.editingBillId) {
      store.bills = store.bills.map((item) => item.id === uiState.editingBillId ? bill : item);
    } else {
      store.bills.unshift(bill);
    }
    writeState(store);
    const edited = Boolean(uiState.editingBillId);
    clearBillForm(false);
    els.billStatusText.textContent = edited
      ? "账单已更新，账目总览和一键结算已同步刷新。"
      : "这笔消费已经保存，账目总览和一键结算会自动更新。";
  });
}

function computeStats() {
  const expenseBills = store.bills.filter((bill) => bill.type === "expense");
  const totalExpense = expenseBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
  const avgExpense = totalExpense / (store.members.length || 1);
  const categoryTotals = {};
  expenseBills.forEach((bill) => {
    categoryTotals[bill.category] = (categoryTotals[bill.category] || 0) + Number(bill.amount || 0);
  });
  return { totalExpense, avgExpense, categoryTotals, expenseBills };
}

function computeBalances() {
  const balances = {};
  store.members.forEach((member) => { balances[member] = 0; });

  store.bills.forEach((bill) => {
    const amount = Number(bill.amount || 0);
    if (!(amount > 0)) return;
    const sign = bill.type === "income" ? -1 : 1;
    if (!balances[bill.paidBy]) balances[bill.paidBy] = 0;
    balances[bill.paidBy] += amount * sign;
    const participants = bill.participants.length ? bill.participants : [bill.paidBy];
    if (bill.splitMode === "custom" && bill.shares && Object.keys(bill.shares).length) {
      participants.forEach((member) => {
        if (!balances[member]) balances[member] = 0;
        balances[member] -= Number(bill.shares[member] || 0) * sign;
      });
    } else {
      const share = amount / participants.length;
      participants.forEach((member) => {
        if (!balances[member]) balances[member] = 0;
        balances[member] -= share * sign;
      });
    }
  });

  return balances;
}

function computeTransfers() {
  const balances = computeBalances();
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([member, value]) => {
    const rounded = Math.round(value * 100) / 100;
    if (rounded > 0.009) creditors.push({ member, amount: rounded });
    if (rounded < -0.009) debtors.push({ member, amount: Math.abs(rounded) });
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.round(Math.min(debtors[i].amount, creditors[j].amount) * 100) / 100;
    const key = `${debtors[i].member}->${creditors[j].member}:${amount.toFixed(2)}`;
    transfers.push({
      key,
      from: debtors[i].member,
      to: creditors[j].member,
      amount,
      done: Boolean(store.settledTransfers[key])
    });
    debtors[i].amount = Math.round((debtors[i].amount - amount) * 100) / 100;
    creditors[j].amount = Math.round((creditors[j].amount - amount) * 100) / 100;
    if (debtors[i].amount <= 0.009) i += 1;
    if (creditors[j].amount <= 0.009) j += 1;
  }
  return { balances, transfers };
}

function hydrateOverviewPage() {
  if (!els.overviewTripName) return;
  const stats = computeStats();
  const { balances } = computeTransfers();
  els.overviewTripName.textContent = store.trip.name || "还没有旅行";
  els.overviewTripMeta.textContent = formatTripMeta();
  els.totalExpense.textContent = formatMoney(stats.totalExpense);
  els.avgExpense.textContent = formatMoney(stats.avgExpense);
  els.billCountText.textContent = `共 ${store.bills.length} 笔`;

  if (!store.members.length) {
    els.overviewMembers.innerHTML = `<p class="empty-text">还没有成员</p>`;
  } else {
    els.overviewMembers.innerHTML = store.members.map((member) => `<span class="member-dot">${member}</span>`).join("") + `<span class="member-dot manage">${store.members.length}人</span>`;
  }

  renderDonut(stats.categoryTotals, stats.totalExpense);
  renderExpenseList(store.bills);
  renderSettlePreview(balances);
}

function renderDonut(categoryTotals, totalExpense) {
  if (!els.donutChart || !els.categoryLegend) return;
  const entries = Object.entries(categoryTotals);
  if (!entries.length || totalExpense <= 0) {
    els.donutChart.style.background = "#f3f3f3";
    els.donutChart.innerHTML = `<span>还没记账</span>`;
    els.categoryLegend.innerHTML = `<p class="empty-text">记账后这里会显示分类占比。</p>`;
    return;
  }
  let cursor = 0;
  const slices = entries.map(([name, amount]) => {
    const percent = (amount / totalExpense) * 100;
    const start = cursor;
    cursor += percent;
    return `${CATEGORY_COLORS[name] || "#ccc"} ${start}% ${cursor}%`;
  });
  els.donutChart.style.background = `conic-gradient(${slices.join(", ")})`;
  els.donutChart.innerHTML = `<span>${formatMoney(totalExpense)}<br>总支出</span>`;
  els.categoryLegend.innerHTML = entries.sort((a, b) => b[1] - a[1]).map(([name, amount]) => {
    const percent = Math.round((amount / totalExpense) * 100);
    return `<div class="legend-item"><div class="legend-left"><span class="legend-dot" style="background:${CATEGORY_COLORS[name] || "#ccc"}"></span><span>${name}</span></div><strong>${formatMoney(amount)}</strong><span>${percent}%</span></div>`;
  }).join("");
}

function renderExpenseList(bills) {
  if (!els.expenseList) return;
  if (!bills.length) {
    els.expenseList.classList.add("empty-stack");
    els.expenseList.innerHTML = `<p class="empty-text">还没有账单，先去记一笔。</p>`;
    return;
  }
  els.expenseList.classList.remove("empty-stack");
  els.expenseList.innerHTML = bills.slice(0, 8).map((bill) => `
    <div class="list-item">
      <div class="item-meta">
        <strong>${bill.type === "income" ? "收入" : "支出"} · ${bill.category}${bill.note ? ` · ${bill.note}` : ""}</strong>
        <p>${bill.paidBy} 支付 · ${bill.participants.length} 人参与</p>
      </div>
      <div class="item-actions">
        <strong>${formatMoney(bill.amount)}</strong>
        <button type="button" data-edit-bill="${bill.id}">编辑</button>
        <button type="button" data-delete-bill="${bill.id}">删除</button>
      </div>
    </div>
  `).join("");
}

function renderSettlePreview(balances) {
  if (!els.settlePreview) return;
  const entries = Object.entries(balances).filter(([, value]) => Math.abs(value) > 0.009);
  if (!entries.length) {
    els.settlePreview.classList.add("empty-stack");
    els.settlePreview.innerHTML = `<p class="empty-text">先记账后才能看到谁该收、谁该付。</p>`;
    return;
  }
  els.settlePreview.classList.remove("empty-stack");
  els.settlePreview.innerHTML = entries.sort((a, b) => b[1] - a[1]).map(([member, value]) => {
    const label = value >= 0 ? "应收" : "应付";
    const cls = value >= 0 ? "positive" : "negative";
    return `<div class="preview-line"><span>${member}</span><strong class="${cls}">${label} ${formatMoney(Math.abs(value))}</strong></div>`;
  }).join("");
}

function bindOverviewPage() {
  els.expenseList?.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-bill]");
    if (edit) {
      window.location.href = `./add-bill.html?edit=${encodeURIComponent(edit.dataset.editBill)}`;
      return;
    }
    const del = event.target.closest("[data-delete-bill]");
    if (!del) return;
    if (!window.confirm("确定删除这笔账单吗？")) return;
    store.bills = store.bills.filter((bill) => bill.id !== del.dataset.deleteBill);
    writeState(store);
    hydrateOverviewPage();
  });
}

function hydrateSettlementPage() {
  if (!els.settlementList) return;
  const { transfers } = computeTransfers();
  const totalPending = transfers.reduce((sum, item) => sum + item.amount, 0);
  const doneCount = transfers.filter((item) => item.done).length;
  const summaryText = transfers.length
    ? `这是我们这次的最简转账方案：${transfers.map((item) => `${item.from} 转给 ${item.to} ${formatMoney(item.amount)}`).join("；")}。`
    : "旅行账目还没生成，等记完账后这里会自动给出结算摘要文案。";

  els.settlementSummaryText.textContent = transfers.length
    ? `系统已经帮你算出 ${transfers.length} 笔最简转账，尽量少走账、不绕路。`
    : "先去创建旅行并记账，系统才能自动算出谁转给谁。";
  els.settlementHeadlineAmount.textContent = formatMoney(totalPending);
  els.settlementHeadlineNote.textContent = transfers.length ? `共 ${transfers.length} 笔待处理转账` : "暂时还没有可结算的金额。";
  els.groupSummaryText.textContent = summaryText;
  els.copySettlementSummaryBtn.dataset.summary = summaryText;
  els.shareSettlementBtn.dataset.summary = summaryText;

  if (!transfers.length) {
    els.settlementList.classList.add("empty-stack");
    els.settlementList.innerHTML = `<p class="empty-text">还没有转账指令，先去记账。</p>`;
  } else {
    els.settlementList.classList.remove("empty-stack");
    els.settlementList.innerHTML = transfers.map((item) => `
      <div class="transfer-item ${item.done ? "done" : ""}" data-transfer-key="${item.key}">
        <div class="transfer-main">
          <strong>${item.from} → ${item.to}</strong>
          <p>${formatMoney(item.amount)}</p>
        </div>
        <button class="transfer-btn ${item.done ? "is-done" : ""}" type="button" data-transfer-toggle>${item.done ? "已转账" : "标记已转账"}</button>
      </div>
    `).join("");
  }
  updateSettlementProgress(doneCount, transfers.length);
}

function updateSettlementProgress(done, total) {
  if (!els.settlementProgressText || !els.settlementProgressBar) return;
  els.settlementProgressText.textContent = `已完成 ${done} / ${total}`;
  els.settlementProgressBar.style.width = total ? `${(done / total) * 100}%` : "0%";
}

function bindSettlementPage() {
  els.settlementList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-transfer-toggle]");
    if (!button) return;
    const item = button.closest("[data-transfer-key]");
    const key = item?.dataset.transferKey;
    if (!key) return;
    store.settledTransfers[key] = !store.settledTransfers[key];
    writeState(store);
    hydrateSettlementPage();
  });

  els.copySettlementSummaryBtn?.addEventListener("click", async () => {
    await copyText(els.copySettlementSummaryBtn.dataset.summary || "");
  });

  els.shareSettlementBtn?.addEventListener("click", async () => {
    const summary = els.shareSettlementBtn.dataset.summary || "";
    if (navigator.share && summary) {
      try {
        await navigator.share({ title: "旅行分账结算结果", text: summary });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    await copyText(summary);
  });
}

function init() {
  renderTags();
  injectSchema();
  bindToggleGroups();
  if (page() === "create") {
    hydrateCreatePage();
    bindCreatePage();
  }
  if (page() === "bill") {
    hydrateBillPage();
    bindBillPage();
  }
  if (page() === "overview") {
    hydrateOverviewPage();
    bindOverviewPage();
  }
  if (page() === "settlement") {
    hydrateSettlementPage();
    bindSettlementPage();
  }
}

init();
