// Estruturas básicas de dados do Finlann

export function createInitialState() {
  // Estado inicial vazio; usamos um helper separado para simulações de teste
  return {
    cards: [], // cartões de crédito
    expenses: [], // saídas (inclui despesas de cartão, com ou sem parcelamento)
    incomes: [], // entradas
    paidInvoices: [], // faturas quitadas: [{cardId, monthIndex, year}]
    invoicePayments: [], // pagamentos de fatura registrados no fluxo de caixa
  };
}

// Marca uma fatura (cartão + mês/ano) como paga
export function markInvoicePaid(state, cardId, monthIndex, year, paymentEntry = null) {
  const prev = state.paidInvoices || [];
  // evita duplicata
  const alreadyPaid = prev.some(
    (p) => p.cardId === cardId && p.monthIndex === monthIndex && p.year === year
  );
  if (alreadyPaid) return state;
  return {
    ...state,
    paidInvoices: [...prev, { cardId, monthIndex, year }],
    invoicePayments: paymentEntry
      ? [...(state.invoicePayments || []), paymentEntry]
      : state.invoicePayments || [],
  };
}

// Verifica se uma fatura de cartão foi marcada como paga
export function isInvoicePaid(state, cardId, monthIndex, year) {
  return (state.paidInvoices || []).some(
    (p) => p.cardId === cardId && p.monthIndex === monthIndex && p.year === year
  );
}

// Helper opcional para simular um mês movimentado de teste (sem login)
export function createDemoStateForMonth(year, monthIndex) {
  const month = monthIndex; // 0-11

  function iso(day, hour = 12) {
    return new Date(year, month, day, hour, 0, 0).toISOString();
  }

  const base = createInitialState();

  const cards = [
    {
      id: "card-visa",
      label: "Visa Gold",
      color: "linear-gradient(135deg, #1d4ed8, #0f172a)",
      closingDay: 5,
      dueDay: 12,
      createdAt: iso(1, 9),
      updatedAt: iso(1, 9),
    },
    {
      id: "card-nu",
      label: "Nubank",
      color: "linear-gradient(135deg, #a855f7, #581c87)",
      closingDay: 10,
      dueDay: 17,
      createdAt: iso(1, 9),
      updatedAt: iso(1, 9),
    },
  ];

  const incomes = [
    {
      id: "inc-salario",
      type: "salary",
      description: "Salário",
      origin: "Empresa X",
      amount: 8500,
      createdAt: iso(3, 10),
      updatedAt: iso(3, 10),
    },
    {
      id: "inc-freela1",
      type: "freela",
      description: "Freela design",
      origin: "Cliente A",
      amount: 1800,
      createdAt: iso(12, 15),
      updatedAt: iso(12, 15),
    },
    {
      id: "inc-pix-amigo",
      type: "pix",
      description: "Pix recebido",
      origin: "Amigo",
      amount: 250,
      createdAt: iso(18, 11),
      updatedAt: iso(18, 11),
    },
  ];

  const expenses = [
    // Compras à vista no crédito
    {
      id: "exp-mercado",
      method: "credit",
      cardId: "card-visa",
      description: "Supermercado",
      amount: 650,
      purchaseDate: iso(6, 19),
      createdAt: iso(6, 19),
      updatedAt: iso(6, 19),
      totalInstallments: 1,
      category: "alimentacao",
      paid: false,
    },
    {
      id: "exp-combustivel",
      method: "credit",
      cardId: "card-nu",
      description: "Combustível",
      amount: 280,
      purchaseDate: iso(9, 8),
      createdAt: iso(9, 8),
      updatedAt: iso(9, 8),
      totalInstallments: 1,
      category: "carro",
      paid: false,
    },

    // Parcelado 5x, estamos na 3ª de 5
    {
      id: "exp-notebook",
      method: "credit",
      cardId: "card-visa",
      description: "Notebook",
      amount: 7500, // total
      purchaseDate: new Date(year, month - 2, 15).toISOString(), // comprado 2 meses atrás
      createdAt: new Date(year, month - 2, 15).toISOString(),
      updatedAt: iso(2, 9),
      totalInstallments: 5,
      firstInvoiceMonthIndex: month - 2,
      firstInvoiceYear: year,
      category: "compras",
      paid: false,
    },

    // Parcelado 3x, estamos na 2ª de 3
    {
      id: "exp-sofa",
      method: "credit",
      cardId: "card-nu",
      description: "Sofá novo",
      amount: 3600,
      purchaseDate: new Date(year, month - 1, 10).toISOString(),
      createdAt: new Date(year, month - 1, 10).toISOString(),
      updatedAt: iso(5, 14),
      totalInstallments: 3,
      firstInvoiceMonthIndex: month - 1,
      firstInvoiceYear: year,
      category: "casa",
      paid: false,
    },

    // Parcelado 2x, estamos na 1ª de 2
    {
      id: "exp-celular",
      method: "credit",
      cardId: "card-nu",
      description: "Celular",
      amount: 2400,
      purchaseDate: iso(11, 16),
      createdAt: iso(11, 16),
      updatedAt: iso(11, 16),
      totalInstallments: 2,
      firstInvoiceMonthIndex: month,
      firstInvoiceYear: year,
      category: "compras",
      paid: false,
    },

    // Despesas menores no mês atual
    {
      id: "exp-ifood",
      method: "credit",
      cardId: "card-visa",
      description: "Delivery iFood",
      amount: 95,
      purchaseDate: iso(14, 21),
      createdAt: iso(14, 21),
      updatedAt: iso(14, 21),
      totalInstallments: 1,
      category: "alimentacao",
      paid: false,
    },
    {
      id: "exp-spotify",
      method: "credit",
      cardId: "card-nu",
      description: "Spotify",
      amount: 34.9,
      purchaseDate: iso(2, 7),
      createdAt: iso(2, 7),
      updatedAt: iso(2, 7),
      totalInstallments: 1,
      category: "lazer",
      paid: false,
    },
  ];

  return {
    ...base,
    cards,
    incomes,
    expenses,
  };
}

export function addExpense(state, expense) {
  return {
    ...state,
    expenses: [...state.expenses, expense],
  };
}

export function addCard(state, card) {
  return {
    ...state,
    cards: [...state.cards, card],
  };
}

export function updateCard(state, updatedCard) {
  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === updatedCard.id ? { ...card, ...updatedCard } : card
    ),
  };
}

export function deleteCard(state, cardId) {
  return {
    ...state,
    cards: state.cards.filter((card) => card.id !== cardId),
  };
}

export function addIncome(state, income) {
  return {
    ...state,
    incomes: [...state.incomes, income],
  };
}

export function removeIncomes(state, incomeIds) {
  const idSet = new Set(incomeIds);
  return {
    ...state,
    incomes: state.incomes.filter((i) => !idSet.has(i.id)),
  };
}

export function updateIncomes(state, updater) {
  return {
    ...state,
    incomes: state.incomes.map((i) => updater(i) || i),
  };
}

export function removeExpenses(state, expenseIds) {
  const idSet = new Set(expenseIds);
  return {
    ...state,
    expenses: state.expenses.filter((e) => !idSet.has(e.id)),
  };
}

export function updateExpenses(state, updater) {
  return {
    ...state,
    expenses: state.expenses.map((e) => updater(e) || e),
  };
}

function isSameMonthYear(isoDate, monthIndex, year) {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  return d.getMonth() === monthIndex && d.getFullYear() === year;
}

function monthsBetween(fromMonthIndex, fromYear, toMonthIndex, toYear) {
  return (toYear - fromYear) * 12 + (toMonthIndex - fromMonthIndex);
}

// Para uma compra parcelada em cartão, calcula o "slot" de fatura de cada parcela
// a partir da data da compra e do ciclo de fechamento (closingDay).
//
// Exemplo: compra em 10/02, closingDay=9 →
// - slot 0 → fatura que fecha em 09/03
// - slot 1 → fatura que fecha em 09/04
// - slot 2 → fatura que fecha em 09/05
// e assim por diante.
function getInvoiceSlotInfoForExpense(expense, card) {
  const closingDay = typeof card?.closingDay === "number" ? card.closingDay : null;
  const dueDay = typeof card?.dueDay === "number" ? card.dueDay : null;
  const purchaseDate = new Date(expense.purchaseDate || expense.createdAt);
  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth(); // 0-11
  const day = purchaseDate.getDate();

  if (!closingDay) {
    // Sem ciclo de fechamento configurado, caímos numa lógica mais simples:
    // a primeira parcela cai no mês da compra.
    return {
      firstInvoiceMonthIndex: month,
      firstInvoiceYear: year,
    };
  }

  // Se a compra foi após o fechamento daquele mês, a primeira fatura útil
  // será a do mês seguinte.
  if (typeof dueDay === "number" && closingDay < dueDay) {
    const referenceDate =
      day > closingDay
        ? new Date(year, month, 1)
        : new Date(year, month - 1, 1);
    return {
      firstInvoiceMonthIndex: referenceDate.getMonth(),
      firstInvoiceYear: referenceDate.getFullYear(),
    };
  }

  if (day > closingDay) {
    const firstInvoiceDate = new Date(year, month + 1, closingDay);
    return {
      firstInvoiceMonthIndex: firstInvoiceDate.getMonth(),
      firstInvoiceYear: firstInvoiceDate.getFullYear(),
    };
  }

  // Compra antes ou no dia do fechamento entra na fatura que fecha neste mês.
  const firstInvoiceDate = new Date(year, month, closingDay);
  return {
    firstInvoiceMonthIndex: firstInvoiceDate.getMonth(),
    firstInvoiceYear: firstInvoiceDate.getFullYear(),
  };
}

export function getFirstInvoiceReferenceForExpense(expense, card) {
  return getInvoiceSlotInfoForExpense(expense, card);
}

// Lógica única de fatura de cartão por mês/ano, baseada na mesma regra usada
// no CardStatementModal: respeita firstInvoiceMonthIndex/Year quando existir e
// distribui as parcelas mês a mês.
export function computeCardInvoiceItemsForMonth(expenses, monthIndex, year) {
  const items = [];
  let total = 0;

  function localMonthsBetween(fromMonthIndex, fromYear, toMonthIndex, toYear) {
    return (toYear - fromYear) * 12 + (toMonthIndex - fromMonthIndex);
  }

  for (const e of expenses) {
    const totalInstallments = e.totalInstallments || 1;

    const refDate = new Date(e.purchaseDate || e.createdAt);
    const firstMonth =
      typeof e.firstInvoiceMonthIndex === "number"
        ? e.firstInvoiceMonthIndex
        : refDate.getMonth();
    const firstYear = e.firstInvoiceYear || refDate.getFullYear();

    const diff = localMonthsBetween(firstMonth, firstYear, monthIndex, year);
    if (diff < 0 || diff >= totalInstallments) continue; // não entra nesta fatura

    const installmentNumber = totalInstallments === 1 ? 1 : diff + 1;
    const installmentAmount =
      totalInstallments === 1 ? e.amount : e.amount / totalInstallments;

    total += installmentAmount;
    items.push({
      ...e,
      installmentNumber,
      totalInstallments,
      installmentAmount,
    });
  }

  return { total, items };
}

// Retorna a fatura de um cartão em um mês/ano específicos, respeitando parcelado
// e o ciclo de fatura (closingDay/dueDay).
//
// Regra simplificada:
// - Se o cartão tiver closingDay configurado, consideramos que a fatura de
//   (monthIndex/year) contempla compras feitas entre o fechamento anterior e
//   este fechamento.
// - Se não tiver closingDay, caímos no comportamento antigo baseado em
//   firstInvoiceMonthIndex/firstInvoiceYear.
export function getCardInvoiceForMonth(state, cardId, monthIndex, year) {
  const card = state.cards.find((c) => c.id === cardId) || null;

  // Dia de fechamento efetivo para este cartão e para este mês/ano,
  // considerando possível override da fatura atual.
  let effectiveClosingDay = null;
  if (card) {
    if (
      typeof card.currentInvoiceYear === "number" &&
      typeof card.currentInvoiceMonthIndex === "number" &&
      card.currentInvoiceYear === year &&
      card.currentInvoiceMonthIndex === monthIndex &&
      typeof card.currentInvoiceClosingDay === "number"
    ) {
      effectiveClosingDay = card.currentInvoiceClosingDay;
    } else if (typeof card.closingDay === "number") {
      effectiveClosingDay = card.closingDay;
    }
  }

  const expensesForCard = state.expenses.filter(
    (e) => e.method === "credit" && e.cardId === cardId
  );

  const items = [];
  let total = 0;

  for (const e of expensesForCard) {
    const totalInstallments = e.totalInstallments || 1;

    // Se o cartão tiver dia de fechamento configurado, usamos janela de datas
    if (card && typeof effectiveClosingDay === "number") {
      // 1) Se a despesa já possui firstInvoiceMonthIndex/Year, usamos isso
      //    como ponto de partida para a primeira parcela (mais fiel ao demo
      //    e ao dado salvo).
      // 2) Caso contrário, calculamos a fatura inicial a partir da
      //    purchaseDate + closingDay (getInvoiceSlotInfoForExpense).
      let firstInvoiceMonthIndex;
      let firstInvoiceYear;

      if (typeof e.firstInvoiceMonthIndex === "number") {
        firstInvoiceMonthIndex = e.firstInvoiceMonthIndex;
        firstInvoiceYear =
          e.firstInvoiceYear || new Date(e.purchaseDate || e.createdAt).getFullYear();
      } else {
        // Para a distribuição inicial das parcelas, usamos o mesmo cálculo de
        // slot, porém com o dia de fechamento efetivo (override da fatura
        // atual quando existir).
        const info = getInvoiceSlotInfoForExpense(e, {
          ...card,
          closingDay: effectiveClosingDay,
        });
        firstInvoiceMonthIndex = info.firstInvoiceMonthIndex;
        firstInvoiceYear = info.firstInvoiceYear;
      }

      const diff = monthsBetween(
        firstInvoiceMonthIndex,
        firstInvoiceYear,
        monthIndex,
        year
      );

      if (diff < 0 || diff >= totalInstallments) continue; // não cai nesta fatura

      // Estamos na fatura correspondente à parcela diff (0-based)
      const installmentNumber = totalInstallments === 1 ? 1 : diff + 1;
      const perInstallmentAmount =
        totalInstallments === 1 ? e.amount : e.amount / totalInstallments;

      total += perInstallmentAmount;
      items.push({
        ...e,
        installmentNumber,
        totalInstallments,
        installmentAmount: perInstallmentAmount,
      });
    } else {
      // Fallback: comportamento antigo baseado em firstInvoiceMonthIndex/year
      const firstMonth =
        typeof e.firstInvoiceMonthIndex === "number"
          ? e.firstInvoiceMonthIndex
          : new Date(e.purchaseDate || e.createdAt).getMonth();
      const firstYear =
        e.firstInvoiceYear || new Date(e.purchaseDate || e.createdAt).getFullYear();

      const diff = monthsBetween(firstMonth, firstYear, monthIndex, year);

      if (diff < 0 || diff >= totalInstallments) continue; // não cai nesta fatura

      const installmentNumber = totalInstallments === 1 ? 1 : diff + 1;
      const perInstallmentAmount =
        totalInstallments === 1 ? e.amount : e.amount / totalInstallments;

      total += perInstallmentAmount;
      items.push({
        ...e,
        installmentNumber,
        totalInstallments,
        installmentAmount: perInstallmentAmount,
      });
    }
  }

  return { total, items };
}

export function getCardInvoiceItemsForMonth(state, cardId, monthIndex, year) {
  return getCardInvoiceForMonth(state, cardId, monthIndex, year).items;
}

export function getCardInvoiceCycleDates(card, monthIndex, year) {
  if (!card) {
    return { closingDate: null, dueDate: null, closingDay: null, dueDay: null };
  }

  let closingDay = null;
  if (
    typeof card.currentInvoiceYear === "number" &&
    typeof card.currentInvoiceMonthIndex === "number" &&
    card.currentInvoiceYear === year &&
    card.currentInvoiceMonthIndex === monthIndex &&
    typeof card.currentInvoiceClosingDay === "number"
  ) {
    closingDay = card.currentInvoiceClosingDay;
  } else if (typeof card.closingDay === "number") {
    closingDay = card.closingDay;
  }

  const dueDay = typeof card.dueDay === "number" ? card.dueDay : null;
  if (typeof closingDay !== "number") {
    return { closingDate: null, dueDate: null, closingDay: null, dueDay };
  }

  const closesNextMonth = typeof dueDay === "number" && closingDay < dueDay;
  const closingDate = closesNextMonth
    ? new Date(year, monthIndex + 1, closingDay)
    : new Date(year, monthIndex, closingDay);

  let dueDate = null;
  if (typeof dueDay === "number") {
    dueDate = closesNextMonth
      ? new Date(closingDate.getFullYear(), closingDate.getMonth(), dueDay)
      : new Date(closingDate.getFullYear(), closingDate.getMonth() + 1, dueDay);
  }

  return { closingDate, dueDate, closingDay, dueDay };
}

export function createInvoicePaymentEntry(state, cardId, monthIndex, year, paidAt = new Date().toISOString()) {
  const card = (state.cards || []).find((c) => c.id === cardId) || null;
  const { total } = getCardInvoiceForMonth(state, cardId, monthIndex, year);
  const amount = Number(total || 0);
  if (amount <= 0) return null;

  return {
    id: `invoice-payment-${cardId}-${year}-${monthIndex}-${Date.now()}`,
    cardId,
    monthIndex,
    year,
    amount,
    paidAt,
    createdAt: paidAt,
    description: `Pagamento fatura ${card?.label || "Cartão"}`,
    method: "invoice_payment",
  };
}

// Retorna, para um cartão e um mês/ano selecionados, as duas faturas relevantes
// para o resumo do dashboard:
// - previous: fatura imediatamente anterior (mês passado)
// - current: fatura do mês vigente (monthIndex/year)
//
// Cada uma contém { total, items } no mesmo formato de getCardInvoiceForMonth.
export function getCardDualInvoicesForMonth(state, cardId, monthIndex, year) {
  const previousMonthDate = new Date(year, monthIndex - 1, 1);
  const prevMonthIndex = previousMonthDate.getMonth();
  const prevYear = previousMonthDate.getFullYear();

  const current = getCardInvoiceForMonth(state, cardId, monthIndex, year);
  const previous = getCardInvoiceForMonth(state, cardId, prevMonthIndex, prevYear);

  return { previous, current };
}

function toMoneyNumber(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

// Resumo mensal para o dashboard.
//
// Regras importantes:
// - Entradas: só do mês selecionado.
// - Saídas:
//   - débito / pix / dinheiro: só do mês selecionado;
//   - crédito em cartão (method === "credit" && cardId): entra via fatura do
//     mês, respeitando parcelado.
export function getMonthlySummary(state, monthIndex, year) {
  const filteredIncomes = state.incomes.filter((i) =>
    isSameMonthYear(i.createdAt, monthIndex, year)
  );

  const totalIncomes = filteredIncomes.reduce(
    (acc, i) => acc + toMoneyNumber(i.amount),
    0
  );

  const incomesByType = filteredIncomes.reduce((acc, i) => {
    const key = i.type || "outros";
    const value = toMoneyNumber(i.amount);
    acc[key] = (acc[key] || 0) + value;
    return acc;
  }, {});

  // Para despesas, usamos a lógica de fatura por cartão, respeitando parcelado
  // e ciclo de fatura.
  const expensesByCard = {};

  for (const card of state.cards) {
    if (isInvoicePaid(state, card.id, monthIndex, year)) continue;
    const { total } = getCardInvoiceForMonth(state, card.id, monthIndex, year);
    if (total > 0) {
      expensesByCard[card.id] = total;
    }
  }

  // Além das faturas de cartão, também consideramos saídas que NÃO estão vinculadas
  // a um cartão de crédito (pix, dinheiro, débito ou crédito sem cardId) para o
  // total de "Saídas" do resumo do app.
  const extraExpensesTotal = state.expenses
    .filter((e) => {
      const createdAt = e.purchaseDate || e.createdAt;
      if (!isSameMonthYear(createdAt, monthIndex, year)) return false;
      // tudo que não for crédito em cartão, ou crédito sem cardId
      return e.method !== "credit" || !e.cardId;
    })
    .reduce((acc, e) => acc + toMoneyNumber(e.amount), 0);

  const invoicePaymentsTotal = (state.invoicePayments || [])
    .filter((payment) => isSameMonthYear(payment.paidAt || payment.createdAt, monthIndex, year))
    .reduce((acc, payment) => acc + toMoneyNumber(payment.amount), 0);

  const totalExpenses = Object.values(expensesByCard).reduce(
    (acc, v) => acc + v,
    0
  ) + extraExpensesTotal + invoicePaymentsTotal;

  // Dívida em aberto de cartão de crédito (independente do mês):
  // todas as despesas de cartão com cardId e que ainda não foram marcadas
  // como pagas. Útil para mostrar no dashboard quanto ainda está pendente
  // nos cartões, mesmo que parte disso pertença a faturas futuras.
  const openCreditDebt = state.expenses
    .filter((e) => e.method === "credit" && e.cardId && e.paid !== true)
    .reduce((acc, e) => acc + toMoneyNumber(e.amount), 0);

  // Parte da dívida de cartão que está em faturas em aberto (não pagas) e que
  // ainda não "virou" histórico fechado. Útil para somar no card de Saídas
  // enquanto ainda houver faturas em aberto.
  const today = new Date();
  const isCurrentMonth =
    monthIndex === today.getMonth() && year === today.getFullYear();

  let cardOpenInvoicesTotal = 0;

  if (isCurrentMonth) {
    for (const card of state.cards) {
      // Considera override de fatura atual (se existir) para o mês/ano de hoje
      let effectiveClosingDay = null;
      if (
        typeof card.currentInvoiceYear === "number" &&
        typeof card.currentInvoiceMonthIndex === "number" &&
        card.currentInvoiceYear === today.getFullYear() &&
        card.currentInvoiceMonthIndex === today.getMonth() &&
        typeof card.currentInvoiceClosingDay === "number"
      ) {
        effectiveClosingDay = card.currentInvoiceClosingDay;
      } else if (typeof card.closingDay === "number") {
        effectiveClosingDay = card.closingDay;
      }

      if (typeof effectiveClosingDay !== "number") continue;

      // Consideramos "em aberto" enquanto não passou do dia de fechamento
      if (today.getDate() > effectiveClosingDay) continue;

      // Soma apenas despesas deste cartão que ainda não foram marcadas como pagas
      const openForCard = state.expenses
        .filter(
          (e) =>
            e.method === "credit" &&
            e.cardId === card.id &&
            e.paid !== true
        )
        .reduce((acc, e) => acc + toMoneyNumber(e.amount), 0);

      cardOpenInvoicesTotal += openForCard;
    }
  }

  // Resumo por categoria (para balanço de saídas)
  const expensesByCategory = {};
  // Para saídas à vista (pix, débito, dinheiro ou crédito sem cardId), usamos
  // a data da compra; para cartão de crédito com parcelado, usamos a mesma
  // lógica de fatura do mês (por competência da fatura).

  // 1) Saídas em cartão (competência de fatura)
  for (const card of []) {
    if (isInvoicePaid(state, card.id, monthIndex, year)) continue;
    const items = getCardInvoiceItemsForMonth(state, card.id, monthIndex, year);

    for (const e of items) {
      const categoryKey = e.category || "outros";
      const value = toMoneyNumber(e.installmentAmount);
      expensesByCategory[categoryKey] =
        (expensesByCategory[categoryKey] || 0) + value;
    }
  }

  // 2) Saídas à vista (pix, débito, dinheiro, crédito sem cardId)
  for (const e of state.expenses) {
    const createdAt = e.purchaseDate || e.createdAt;
    if (!isSameMonthYear(createdAt, monthIndex, year)) continue;

    const categoryKey = e.category || "outros";
    const value = toMoneyNumber(e.amount);
    expensesByCategory[categoryKey] =
      (expensesByCategory[categoryKey] || 0) + value;
  }

  const balance = totalIncomes - totalExpenses;

  return {
    totalExpenses,
    totalIncomes,
    balance,
    expensesByCard,
    incomesByType,
    expensesByCategory,
    openCreditDebt,
    cardOpenInvoicesTotal,
  };
}
