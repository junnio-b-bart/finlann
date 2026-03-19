// Estruturas básicas de dados do Finlann

export function createInitialState() {
  // Estado inicial vazio; usamos um helper separado para simulações de teste
  return {
    cards: [], // cartões de crédito
    expenses: [], // saídas
    incomes: [], // entradas
  };
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

export function getCardInvoiceForMonth(state, cardId, monthIndex, year) {
  const expensesForCard = state.expenses.filter(
    (e) => e.method === "credit" && e.cardId === cardId
  );

  const items = [];
  let total = 0;

  for (const e of expensesForCard) {
    const totalInstallments = e.totalInstallments || 1;
    const firstMonth =
      typeof e.firstInvoiceMonthIndex === "number"
        ? e.firstInvoiceMonthIndex
        : new Date(e.purchaseDate || e.createdAt).getMonth();
    const firstYear = e.firstInvoiceYear || new Date(e.purchaseDate || e.createdAt).getFullYear();

    const diff = monthsBetween(firstMonth, firstYear, monthIndex, year);

    if (diff < 0 || diff >= totalInstallments) continue; // não cai nesta fatura

    const installmentNumber = totalInstallments === 1 ? 1 : diff + 1;
    const perInstallmentAmount = totalInstallments === 1
      ? e.amount
      : e.amount / totalInstallments;

    total += perInstallmentAmount;

    items.push({
      ...e,
      installmentNumber,
      totalInstallments,
      installmentAmount: perInstallmentAmount,
    });
  }

  return { total, items };
}

export function getMonthlySummary(state, monthIndex, year) {
  const filteredIncomes = state.incomes.filter((i) =>
    isSameMonthYear(i.createdAt, monthIndex, year)
  );

  const totalIncomes = filteredIncomes.reduce((acc, i) => acc + i.amount, 0);

  const incomesByType = filteredIncomes.reduce((acc, i) => {
    const key = i.type || "outros";
    acc[key] = (acc[key] || 0) + i.amount;
    return acc;
  }, {});

  // Para despesas, usamos a lógica de fatura por cartão, respeitando parcelado.
  const expensesByCard = {};

  for (const card of state.cards) {
    const { total } = getCardInvoiceForMonth(state, card.id, monthIndex, year);
    if (total > 0) {
      expensesByCard[card.id] = total;
    }
  }

  const totalExpenses = Object.values(expensesByCard).reduce(
    (acc, v) => acc + v,
    0
  );

  // Resumo por categoria (para balanço de saídas)
  const expensesByCategory = {};

  for (const e of state.expenses) {
    const createdAt = e.purchaseDate || e.createdAt;
    if (!isSameMonthYear(createdAt, monthIndex, year)) continue;
    const categoryKey = e.category || "outros";
    expensesByCategory[categoryKey] = (expensesByCategory[categoryKey] || 0) + e.amount;
  }

  const balance = totalIncomes - totalExpenses;

  return {
    totalExpenses,
    totalIncomes,
    balance,
    expensesByCard,
    incomesByType,
    expensesByCategory,
  };
}
