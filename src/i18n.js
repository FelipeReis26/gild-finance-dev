export const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' }
]

const strings = {
  // Nav menu
  navDashboard: { en: 'Dashboard', fr: 'Tableau de bord', 'pt-BR': 'Painel', it: 'Dashboard', es: 'Panel' },
  navActivity: { en: 'Activity', fr: 'Activité', 'pt-BR': 'Atividade', it: 'Attività', es: 'Actividad' },
  navBills: { en: 'Bills', fr: 'Factures', 'pt-BR': 'Contas', it: 'Bollette', es: 'Facturas' },
  navBalances: { en: 'Balances', fr: 'Comptes', 'pt-BR': 'Saldos', it: 'Conti', es: 'Cuentas' },
  navScan: { en: 'Scan', fr: 'Scanner', 'pt-BR': 'Escanear', it: 'Scansiona', es: 'Escanear' },
  navSettings: { en: 'Settings', fr: 'Réglages', 'pt-BR': 'Configurações', it: 'Impostazioni', es: 'Ajustes' },

  // Dashboard
  overview: { en: 'Overview', fr: 'Aperçu', 'pt-BR': 'Visão geral', it: 'Panoramica', es: 'Resumen' },
  income: { en: 'Income', fr: 'Revenus', 'pt-BR': 'Renda', it: 'Entrate', es: 'Ingresos' },
  spent: { en: 'Spent', fr: 'Dépensé', 'pt-BR': 'Gasto', it: 'Speso', es: 'Gastado' },
  left: { en: 'Left', fr: 'Restant', 'pt-BR': 'Restante', it: 'Rimanente', es: 'Restante' },
  ofIncomeSpent: { en: 'of income spent', fr: 'des revenus dépensés', 'pt-BR': 'da renda gasta', it: 'del reddito speso', es: 'de ingresos gastado' },
  ofBudgetUsed: { en: 'of budget used', fr: 'du budget utilisé', 'pt-BR': 'do orçamento utilizado', it: 'del budget utilizzato', es: 'del presupuesto utilizado' },
  categories: { en: 'Categories', fr: 'Catégories', 'pt-BR': 'Categorias', it: 'Categorie', es: 'Categorías' },
  addTransaction: { en: 'Add transaction', fr: 'Ajouter une transaction', 'pt-BR': 'Adicionar transação', it: 'Aggiungi transazione', es: 'Añadir transacción' },
  previousMonth: { en: 'Previous month', fr: 'Mois précédent', 'pt-BR': 'Mês anterior', it: 'Mese precedente', es: 'Mes anterior' },
  nextMonth: { en: 'Next month', fr: 'Mois suivant', 'pt-BR': 'Próximo mês', it: 'Mese successivo', es: 'Mes siguiente' },

  // Add / Edit transaction
  editTransaction: { en: 'Edit transaction', fr: 'Modifier la transaction', 'pt-BR': 'Editar transação', it: 'Modifica transazione', es: 'Editar transacción' },
  expense: { en: 'Expense', fr: 'Dépense', 'pt-BR': 'Despesa', it: 'Spesa', es: 'Gasto' },
  amount: { en: 'Amount', fr: 'Montant', 'pt-BR': 'Valor', it: 'Importo', es: 'Monto' },
  category: { en: 'Category', fr: 'Catégorie', 'pt-BR': 'Categoria', it: 'Categoria', es: 'Categoría' },
  date: { en: 'Date', fr: 'Date', 'pt-BR': 'Data', it: 'Data', es: 'Fecha' },
  noteOptional: { en: 'Note (optional)', fr: 'Note (facultatif)', 'pt-BR': 'Nota (opcional)', it: 'Nota (facoltativo)', es: 'Nota (opcional)' },
  notePlaceholder: { en: 'Weekly shop', fr: 'Courses de la semaine', 'pt-BR': 'Compras da semana', it: 'Spesa settimanale', es: 'Compra semanal' },
  saveTransaction: { en: 'Save transaction', fr: 'Enregistrer la transaction', 'pt-BR': 'Salvar transação', it: 'Salva transazione', es: 'Guardar transacción' },
  deleteTransaction: { en: 'Delete transaction', fr: 'Supprimer la transaction', 'pt-BR': 'Excluir transação', it: 'Elimina transazione', es: 'Eliminar transacción' },
  save: { en: 'Save', fr: 'Enregistrer', 'pt-BR': 'Salvar', it: 'Salva', es: 'Guardar' },
  next: { en: 'Next', fr: 'Suivant', 'pt-BR': 'Próximo', it: 'Avanti', es: 'Siguiente' },
  enterValidAmount: { en: 'Enter a valid amount', fr: 'Entrez un montant valide', 'pt-BR': 'Insira um valor válido', it: 'Inserisci un importo valido', es: 'Introduce un importe válido' },
  chooseCategory: { en: 'Choose a category', fr: 'Choisissez une catégorie', 'pt-BR': 'Escolha uma categoria', it: 'Scegli una categoria', es: 'Elige una categoría' },

  // Activity
  thisMonth: { en: 'This month', fr: 'Ce mois-ci', 'pt-BR': 'Este mês', it: 'Questo mese', es: 'Este mes' },
  allTime: { en: 'All time', fr: 'Depuis toujours', 'pt-BR': 'Todo o período', it: 'Sempre', es: 'Todo el tiempo' },
  all: { en: 'All', fr: 'Tout', 'pt-BR': 'Tudo', it: 'Tutto', es: 'Todo' },
  clearFilter: { en: 'Clear filter', fr: 'Effacer le filtre', 'pt-BR': 'Limpar filtro', it: 'Cancella filtro', es: 'Borrar filtro' },
  noTransactionsHere: { en: 'No transactions here.', fr: 'Aucune transaction ici.', 'pt-BR': 'Nenhuma transação aqui.', it: 'Nessuna transazione qui.', es: 'No hay transacciones aquí.' },
  confirmDeleteTransaction: { en: 'Delete this transaction?', fr: 'Supprimer cette transaction ?', 'pt-BR': 'Excluir esta transação?', it: 'Eliminare questa transazione?', es: '¿Eliminar esta transacción?' },
  transactionDeleted: { en: 'Transaction deleted', fr: 'Transaction supprimée', 'pt-BR': 'Transação excluída', it: 'Transazione eliminata', es: 'Transacción eliminada' },
  billPayment: { en: 'Bill payment', fr: 'Paiement de facture', 'pt-BR': 'Pagamento de conta', it: 'Pagamento bolletta', es: 'Pago de factura' },
  uncategorized: { en: 'Uncategorized', fr: 'Sans catégorie', 'pt-BR': 'Sem categoria', it: 'Senza categoria', es: 'Sin categoría' },

  // Bills
  stillDue: { en: 'Still due', fr: 'Encore dû', 'pt-BR': 'Ainda pendente', it: 'Ancora da pagare', es: 'Aún pendiente' },
  totalMonthly: { en: 'Total monthly', fr: 'Total mensuel', 'pt-BR': 'Total mensal', it: 'Totale mensile', es: 'Total mensual' },
  bills: { en: 'Bills', fr: 'Factures', 'pt-BR': 'Contas', it: 'Bollette', es: 'Facturas' },
  addBill: { en: 'Add bill', fr: 'Ajouter une facture', 'pt-BR': 'Adicionar conta', it: 'Aggiungi bolletta', es: 'Añadir factura' },
  markPaid: { en: 'Mark paid', fr: 'Marquer payé', 'pt-BR': 'Marcar como pago', it: 'Segna come pagato', es: 'Marcar como pagado' },
  undo: { en: 'Undo', fr: 'Annuler', 'pt-BR': 'Desfazer', it: 'Annulla', es: 'Deshacer' },
  paid: { en: 'Paid', fr: 'Payé', 'pt-BR': 'Pago', it: 'Pagato', es: 'Pagado' },
  dueThe: { en: 'Due the', fr: 'Échéance le', 'pt-BR': 'Vence dia', it: 'Scade il', es: 'Vence el' },
  noBillsYet: { en: 'No bills yet. Add your recurring fixed expenses.', fr: "Aucune facture pour l'instant. Ajoutez vos dépenses fixes récurrentes.", 'pt-BR': 'Nenhuma conta ainda. Adicione suas despesas fixas recorrentes.', it: 'Nessuna bolletta ancora. Aggiungi le tue spese fisse ricorrenti.', es: 'Aún no hay facturas. Añade tus gastos fijos recurrentes.' },
  confirmDeleteBill: { en: 'Remove this bill entirely? This deletes the recurring bill.', fr: 'Supprimer entièrement cette facture ? Cela supprime la facture récurrente.', 'pt-BR': 'Remover esta conta completamente? Isso exclui a conta recorrente.', it: 'Rimuovere completamente questa bolletta? Questo elimina la bolletta ricorrente.', es: '¿Eliminar esta factura por completo? Esto elimina la factura recurrente.' },
  billName: { en: 'Name', fr: 'Nom', 'pt-BR': 'Nome', it: 'Nome', es: 'Nombre' },
  dueDayOfMonth: { en: 'Due day of month', fr: "Jour d'échéance du mois", 'pt-BR': 'Dia de vencimento do mês', it: 'Giorno di scadenza del mese', es: 'Día de vencimiento del mes' },
  saveBill: { en: 'Save bill', fr: 'Enregistrer la facture', 'pt-BR': 'Salvar conta', it: 'Salva bolletta', es: 'Guardar factura' },
  billsRecurNote: { en: "Bills repeat every month, so this recurs automatically, no need to re-add it next month.", fr: 'Les factures se répètent chaque mois, donc cela revient automatiquement, pas besoin de la rajouter le mois prochain.', 'pt-BR': 'As contas se repetem todo mês, então isso recorre automaticamente, sem precisar adicionar de novo no próximo mês.', it: 'Le bollette si ripetono ogni mese, quindi questa ricorre automaticamente, non serve riaggiungerla il mese prossimo.', es: 'Las facturas se repiten cada mes, así que esto se repite automáticamente, no hace falta añadirla de nuevo el próximo mes.' },

  // Balances
  debt: { en: 'Debt', fr: 'Dette', 'pt-BR': 'Dívida', it: 'Debito', es: 'Deuda' },
  savings: { en: 'Savings', fr: 'Épargne', 'pt-BR': 'Poupança', it: 'Risparmi', es: 'Ahorros' },
  owedToYou: { en: 'Owed to you', fr: 'On vous doit', 'pt-BR': 'Devem a você', it: 'Ti devono', es: 'Te deben' },
  accounts: { en: 'Accounts', fr: 'Comptes', 'pt-BR': 'Contas', it: 'Conti', es: 'Cuentas' },
  addAccount: { en: 'Add account', fr: 'Ajouter un compte', 'pt-BR': 'Adicionar conta', it: 'Aggiungi conto', es: 'Añadir cuenta' },
  updateBalance: { en: 'Update balance', fr: 'Mettre à jour le solde', 'pt-BR': 'Atualizar saldo', it: 'Aggiorna saldo', es: 'Actualizar saldo' },
  logRepayment: { en: 'Log repayment', fr: 'Enregistrer un remboursement', 'pt-BR': 'Registrar pagamento', it: 'Registra un rimborso', es: 'Registrar un pago' },
  theirName: { en: 'Their name', fr: 'Son nom', 'pt-BR': 'Nome da pessoa', it: 'Il suo nome', es: 'Su nombre' },
  type: { en: 'Type', fr: 'Type', 'pt-BR': 'Tipo', it: 'Tipo', es: 'Tipo' },
  currentBalance: { en: 'Current balance', fr: 'Solde actuel', 'pt-BR': 'Saldo atual', it: 'Saldo attuale', es: 'Saldo actual' },
  amountTheyOweYou: { en: 'Amount they owe you', fr: 'Montant qu\'ils vous doivent', 'pt-BR': 'Valor que devem a você', it: 'Importo che ti devono', es: 'Importe que te deben' },
  sinceLastUpdate: { en: 'since last update', fr: 'depuis la dernière mise à jour', 'pt-BR': 'desde a última atualização', it: "dall'ultimo aggiornamento", es: 'desde la última actualización' },
  vsLastMonth: { en: 'vs last month', fr: 'vs le mois dernier', 'pt-BR': 'vs mês passado', it: 'vs mese scorso', es: 'vs el mes pasado' },
  searchTransactions: { en: 'Search notes...', fr: 'Rechercher des notes...', 'pt-BR': 'Buscar notas...', it: 'Cerca note...', es: 'Buscar notas...' },
  spendTrend: { en: 'Last 3 months', fr: 'Les 3 derniers mois', 'pt-BR': 'Últimos 3 meses', it: 'Ultimi 3 mesi', es: 'Últimos 3 meses' },
  categoryBreakdown: { en: 'Category breakdown', fr: 'Répartition par catégorie', 'pt-BR': 'Detalhamento por categoria', it: 'Ripartizione per categoria', es: 'Desglose por categoría' },
  categorySingular: { en: 'category', fr: 'catégorie', 'pt-BR': 'categoria', it: 'categoria', es: 'categoría' },
  categoriesPlural: { en: 'categories', fr: 'catégories', 'pt-BR': 'categorias', it: 'categorie', es: 'categorías' },
  noAccountsYet: { en: 'No accounts yet. Add a loan, savings pot, or money someone owes you.', fr: "Aucun compte pour l'instant. Ajoutez un prêt, une épargne, ou de l'argent qu'on vous doit.", 'pt-BR': 'Nenhuma conta ainda. Adicione um empréstimo, poupança, ou dinheiro que alguém te deve.', it: 'Nessun conto ancora. Aggiungi un prestito, un fondo risparmio, o denaro che qualcuno ti deve.', es: 'Aún no hay cuentas. Añade un préstamo, un fondo de ahorro, o dinero que alguien te debe.' },
  saveAccount: { en: 'Save account', fr: 'Enregistrer le compte', 'pt-BR': 'Salvar conta', it: 'Salva conto', es: 'Guardar cuenta' },

  // Scan
  scanTitle: { en: 'Scan a screenshot', fr: 'Scanner une capture', 'pt-BR': 'Escanear uma captura', it: 'Scansiona uno screenshot', es: 'Escanear una captura' },
  scanSubtitle: { en: 'Upload a payment notification or receipt screenshot. Text is read on your device, nothing is sent anywhere.', fr: 'Téléchargez une capture de notification de paiement ou de reçu. Le texte est lu sur votre appareil, rien n\'est envoyé ailleurs.', 'pt-BR': 'Envie uma captura de notificação de pagamento ou recibo. O texto é lido no seu aparelho, nada é enviado a lugar nenhum.', it: 'Carica uno screenshot di notifica di pagamento o scontrino. Il testo viene letto sul tuo dispositivo, nulla viene inviato altrove.', es: 'Sube una captura de notificación de pago o recibo. El texto se lee en tu dispositivo, nada se envía a ningún sitio.' },
  chooseScreenshot: { en: 'Choose screenshot', fr: 'Choisir une capture', 'pt-BR': 'Escolher captura', it: 'Scegli screenshot', es: 'Elegir captura' },
  readingScreenshot: { en: 'Reading screenshot', fr: "Lecture de la capture", 'pt-BR': 'Lendo a captura', it: 'Lettura dello screenshot', es: 'Leyendo la captura' },
  tryAnother: { en: 'Try another screenshot', fr: 'Essayer une autre capture', 'pt-BR': 'Tentar outra captura', it: 'Prova un altro screenshot', es: 'Probar otra captura' },
  confirmTransaction: { en: 'Confirm transaction', fr: 'Confirmer la transaction', 'pt-BR': 'Confirmar transação', it: 'Conferma transazione', es: 'Confirmar transacción' },
  confirmSubtitle: { en: 'Detected from screenshot, check these before saving', fr: 'Détecté depuis la capture, vérifiez avant d\'enregistrer', 'pt-BR': 'Detectado a partir da captura, confira antes de salvar', it: 'Rilevato dallo screenshot, controlla prima di salvare', es: 'Detectado en la captura, revisa antes de guardar' },
  merchant: { en: 'Merchant', fr: 'Commerçant', 'pt-BR': 'Estabelecimento', it: 'Commerciante', es: 'Comercio' },
  discard: { en: 'Discard', fr: 'Ignorer', 'pt-BR': 'Descartar', it: 'Scarta', es: 'Descartar' },
  confirm: { en: 'Confirm', fr: 'Confirmer', 'pt-BR': 'Confirmar', it: 'Conferma', es: 'Confirmar' },
  couldNotRead: { en: 'Could not read that screenshot. Try another one.', fr: "Impossible de lire cette capture. Essayez-en une autre.", 'pt-BR': 'Não foi possível ler essa captura. Tente outra.', it: 'Impossibile leggere questo screenshot. Provane un altro.', es: 'No se pudo leer esa captura. Prueba con otra.' },
  rawRecognizedText: { en: 'Raw recognized text', fr: 'Texte brut reconnu', 'pt-BR': 'Texto reconhecido bruto', it: 'Testo grezzo riconosciuto', es: 'Texto reconocido sin procesar' },
  scanInstead: { en: 'Scan', fr: 'Scanner', 'pt-BR': 'Escanear', it: 'Scansiona', es: 'Escanear' },
  learnedFromHistory: { en: 'from your history', fr: 'depuis votre historique', 'pt-BR': 'do seu histórico', it: 'dalla tua cronologia', es: 'de tu historial' },

  // Settings
  settingsTitle: { en: 'Settings', fr: 'Réglages', 'pt-BR': 'Configurações', it: 'Impostazioni', es: 'Ajustes' },
  currency: { en: 'Currency', fr: 'Devise', 'pt-BR': 'Moeda', it: 'Valuta', es: 'Moneda' },
  language: { en: 'Language', fr: 'Langue', 'pt-BR': 'Idioma', it: 'Lingua', es: 'Idioma' },
  expenseCategories: { en: 'Expense categories', fr: 'Catégories de dépenses', 'pt-BR': 'Categorias de despesas', it: 'Categorie di spesa', es: 'Categorías de gastos' },
  incomeCategories: { en: 'Income categories', fr: 'Catégories de revenus', 'pt-BR': 'Categorias de renda', it: 'Categorie di reddito', es: 'Categorías de ingresos' },
  newCategoryName: { en: 'New category name', fr: 'Nom de la nouvelle catégorie', 'pt-BR': 'Nome da nova categoria', it: 'Nome nuova categoria', es: 'Nombre de la nueva categoría' },
  icon: { en: 'Icon', fr: 'Icône', 'pt-BR': 'Ícone', it: 'Icona', es: 'Icono' },
  addCategory: { en: 'Add category', fr: 'Ajouter une catégorie', 'pt-BR': 'Adicionar categoria', it: 'Aggiungi categoria', es: 'Añadir categoría' },
  noMonthlyLimit: { en: 'No monthly limit', fr: 'Aucune limite mensuelle', 'pt-BR': 'Sem limite mensal', it: 'Nessun limite mensile', es: 'Sin límite mensual' },
  rolloverLabel: { en: 'Roll over unused budget to next month', fr: 'Reporter le budget non utilisé au mois suivant', 'pt-BR': 'Transferir orçamento não usado para o próximo mês', it: 'Riporta il budget non utilizzato al mese successivo', es: 'Trasladar el presupuesto sin usar al mes siguiente' },
  backup: { en: 'Backup', fr: 'Sauvegarde', 'pt-BR': 'Backup', it: 'Backup', es: 'Copia de seguridad' },
  backupNote: { en: "Your data lives only on this device. Export a backup file before switching phones or clearing browser data, and restore it the same way afterwards.", fr: "Vos données ne vivent que sur cet appareil. Exportez un fichier de sauvegarde avant de changer de téléphone ou d'effacer les données du navigateur, et restaurez-le de la même façon ensuite.", 'pt-BR': 'Seus dados existem apenas neste aparelho. Exporte um arquivo de backup antes de trocar de celular ou limpar os dados do navegador, e restaure da mesma forma depois.', it: 'I tuoi dati vivono solo su questo dispositivo. Esporta un file di backup prima di cambiare telefono o cancellare i dati del browser, e ripristinalo allo stesso modo in seguito.', es: 'Tus datos viven solo en este dispositivo. Exporta un archivo de copia de seguridad antes de cambiar de teléfono o borrar los datos del navegador, y restáuralo de la misma forma después.' },
  exportBackup: { en: 'Export backup', fr: 'Exporter la sauvegarde', 'pt-BR': 'Exportar backup', it: 'Esporta backup', es: 'Exportar copia' },
  restoreBackup: { en: 'Restore backup', fr: 'Restaurer la sauvegarde', 'pt-BR': 'Restaurar backup', it: 'Ripristina backup', es: 'Restaurar copia' },
  backupRestored: { en: 'Backup restored', fr: 'Sauvegarde restaurée', 'pt-BR': 'Backup restaurado', it: 'Backup ripristinato', es: 'Copia restaurada' },
  couldNotReadBackup: { en: 'Could not read that backup file', fr: 'Impossible de lire ce fichier de sauvegarde', 'pt-BR': 'Não foi possível ler o arquivo de backup', it: 'Impossibile leggere il file di backup', es: 'No se pudo leer el archivo de copia' },
  importTransactionsTitle: { en: 'Import transactions', fr: 'Importer des transactions', 'pt-BR': 'Importar transações', it: 'Importa transazioni', es: 'Importar transacciones' },
  importTransactionsNote: { en: "Adds transactions on top of what's already here, unlike Restore backup this never overwrites your existing data. Use this for a batch pulled from a bank statement or screenshots.", fr: "Ajoute des transactions à celles déjà présentes, contrairement à Restaurer la sauvegarde cela n'écrase jamais vos données existantes. À utiliser pour un lot provenant d'un relevé bancaire ou de captures.", 'pt-BR': 'Adiciona transações às que já existem, ao contrário de Restaurar backup isso nunca sobrescreve seus dados existentes. Use para um lote de um extrato bancário ou capturas.', it: 'Aggiunge transazioni a quelle già presenti, a differenza di Ripristina backup questo non sovrascrive mai i tuoi dati esistenti. Usalo per un lotto da un estratto conto o screenshot.', es: 'Añade transacciones a las que ya existen, a diferencia de Restaurar copia esto nunca sobrescribe tus datos existentes. Úsalo para un lote de un extracto bancario o capturas.' },
  addedTransactions: { en: 'Added', fr: 'Ajouté', 'pt-BR': 'Adicionadas', it: 'Aggiunte', es: 'Añadidas' },
  couldNotReadFile: { en: 'Could not read that file', fr: 'Impossible de lire ce fichier', 'pt-BR': 'Não foi possível ler o arquivo', it: 'Impossibile leggere il file', es: 'No se pudo leer el archivo' },
  restorePreviewTitle: { en: "What's in this backup", fr: 'Contenu de cette sauvegarde', 'pt-BR': 'O que tem neste backup', it: 'Cosa contiene questo backup', es: 'Qué contiene esta copia' },
  restoreSafetyNote: { en: 'A backup of your current data downloads automatically before this replaces anything.', fr: 'Une sauvegarde de vos données actuelles se télécharge automatiquement avant que ceci ne remplace quoi que ce soit.', 'pt-BR': 'Um backup dos seus dados atuais é baixado automaticamente antes que isso substitua qualquer coisa.', it: 'Un backup dei tuoi dati attuali viene scaricato automaticamente prima che questo sostituisca qualcosa.', es: 'Se descarga automáticamente una copia de tus datos actuales antes de que esto reemplace nada.' },
  importReadyTitle: { en: 'ready to import', fr: 'prêtes à importer', 'pt-BR': 'prontas para importar', it: 'pronte per l\'importazione', es: 'listas para importar' },
  importDuplicatesNote: { en: 'of these look like transactions you already have (same date, amount, and note).', fr: "d'entre elles ressemblent à des transactions que vous avez déjà (même date, montant et note).", 'pt-BR': 'delas parecem transações que você já tem (mesma data, valor e nota).', it: 'di queste sembrano transazioni che hai già (stessa data, importo e nota).', es: 'de estas parecen transacciones que ya tienes (misma fecha, importe y nota).' },
  importSkipDuplicates: { en: 'Import only new', fr: "Importer seulement les nouvelles", 'pt-BR': 'Importar só as novas', it: 'Importa solo le nuove', es: 'Importar solo las nuevas' },
  importAllAnyway: { en: 'Import all anyway', fr: 'Tout importer quand même', 'pt-BR': 'Importar tudo mesmo assim', it: 'Importa tutto comunque', es: 'Importar todo de todos modos' },
  importNoDuplicates: { en: "None of these look like duplicates of what's already here.", fr: "Aucune ne ressemble à un doublon de ce qui est déjà présent.", 'pt-BR': 'Nenhuma parece ser duplicata do que já existe aqui.', it: 'Nessuna sembra un duplicato di ciò che è già presente.', es: 'Ninguna parece un duplicado de lo que ya hay aquí.' },
  versionHistory: { en: 'Version history', fr: 'Historique des versions', 'pt-BR': 'Histórico de versões', it: 'Cronologia versioni', es: 'Historial de versiones' },
  privacyNote: { en: "Data stays on this device only. Sharing this app's link never shares your numbers with anyone else.", fr: "Les données restent uniquement sur cet appareil. Partager le lien de cette application ne partage jamais vos chiffres avec qui que ce soit d'autre.", 'pt-BR': 'Os dados ficam apenas neste aparelho. Compartilhar o link deste app nunca compartilha seus números com mais ninguém.', it: 'I dati restano solo su questo dispositivo. Condividere il link di questa app non condivide mai i tuoi numeri con nessun altro.', es: 'Los datos permanecen solo en este dispositivo. Compartir el enlace de esta app nunca comparte tus números con nadie más.' },
  back: { en: 'Back', fr: 'Retour', 'pt-BR': 'Voltar', it: 'Indietro', es: 'Atrás' },
  categoriesSettings: { en: 'Categories', fr: 'Catégories', 'pt-BR': 'Categorias', it: 'Categorie', es: 'Categorías' },
  archivedCategories: { en: 'Archived categories', fr: 'Catégories archivées', 'pt-BR': 'Categorias arquivadas', it: 'Categorie archiviate', es: 'Categorías archivadas' },
  archivedCategoriesNote: { en: "Hidden from new transactions, but old ones still show their name and icon correctly.", fr: "Masquées pour les nouvelles transactions, mais les anciennes affichent toujours leur nom et icône correctement.", 'pt-BR': 'Ocultas para novas transações, mas as antigas ainda mostram o nome e ícone corretamente.', it: 'Nascoste per le nuove transazioni, ma quelle vecchie mostrano ancora nome e icona correttamente.', es: 'Ocultas para nuevas transacciones, pero las antiguas siguen mostrando su nombre e icono correctamente.' },
  restore: { en: 'Restore', fr: 'Restaurer', 'pt-BR': 'Restaurar', it: 'Ripristina', es: 'Restaurar' },
  archiveCategoryConfirm: { en: '"{name}" has existing transactions. Archiving it hides it from new transactions but keeps old ones showing correctly, and you can restore it later. Archive anyway?', fr: '« {name} » a des transactions existantes. L\'archiver la masque pour les nouvelles transactions mais les anciennes continuent de s\'afficher correctement, et vous pourrez la restaurer plus tard. Archiver quand même ?', 'pt-BR': '"{name}" tem transações existentes. Arquivá-la a oculta de novas transações mas as antigas continuam mostrando corretamente, e você pode restaurá-la depois. Arquivar mesmo assim?', it: '"{name}" ha transazioni esistenti. Archiviarla la nasconde dalle nuove transazioni ma quelle vecchie continuano a essere mostrate correttamente, e potrai ripristinarla più avanti. Archiviare comunque?', es: '"{name}" tiene transacciones existentes. Archivarla la oculta de nuevas transacciones pero las antiguas siguen mostrándose correctamente, y podrás restaurarla después. ¿Archivar de todos modos?' },
  dataAndBackup: { en: 'Data & backup', fr: 'Données et sauvegarde', 'pt-BR': 'Dados e backup', it: 'Dati e backup', es: 'Datos y copia' },
  about: { en: 'About', fr: 'À propos', 'pt-BR': 'Sobre', it: 'Informazioni', es: 'Acerca de' },
  security: { en: 'Security', fr: 'Sécurité', 'pt-BR': 'Segurança', it: 'Sicurezza', es: 'Seguridad' },
  enterPasscode: { en: 'Enter passcode', fr: 'Entrez le code', 'pt-BR': 'Digite a senha', it: 'Inserisci il codice', es: 'Introduce el código' },
  unlock: { en: 'Unlock', fr: 'Déverrouiller', 'pt-BR': 'Desbloquear', it: 'Sblocca', es: 'Desbloquear' },
  incorrectPasscode: { en: 'Incorrect passcode', fr: 'Code incorrect', 'pt-BR': 'Senha incorreta', it: 'Codice errato', es: 'Código incorrecto' },
  passcodeNote: { en: 'A local passcode asked for each time you open the app. This is a privacy screen, not encryption, your data is still stored the same way on this device.', fr: "Un code local demandé à chaque ouverture de l'application. C'est un écran de confidentialité, pas un chiffrement, vos données restent stockées de la même façon sur cet appareil.", 'pt-BR': 'Uma senha local pedida toda vez que você abre o app. Isso é uma tela de privacidade, não criptografia, seus dados continuam armazenados da mesma forma neste aparelho.', it: 'Un codice locale richiesto ogni volta che apri l\'app. Questa è una schermata di privacy, non crittografia, i tuoi dati restano archiviati allo stesso modo su questo dispositivo.', es: 'Un código local pedido cada vez que abres la app. Esto es una pantalla de privacidad, no cifrado, tus datos siguen almacenados igual en este dispositivo.' },
  currentPasscode: { en: 'Current passcode', fr: 'Code actuel', 'pt-BR': 'Senha atual', it: 'Codice attuale', es: 'Código actual' },
  newPasscode: { en: 'New passcode (4+ digits)', fr: 'Nouveau code (4 chiffres min.)', 'pt-BR': 'Nova senha (4+ dígitos)', it: 'Nuovo codice (min. 4 cifre)', es: 'Nuevo código (4+ dígitos)' },
  confirmPasscode: { en: 'Confirm passcode', fr: 'Confirmez le code', 'pt-BR': 'Confirme a senha', it: 'Conferma il codice', es: 'Confirma el código' },
  setPasscode: { en: 'Set passcode', fr: 'Définir le code', 'pt-BR': 'Definir senha', it: 'Imposta codice', es: 'Establecer código' },
  changePasscode: { en: 'Change passcode', fr: 'Changer le code', 'pt-BR': 'Alterar senha', it: 'Cambia codice', es: 'Cambiar código' },
  removePasscode: { en: 'Remove passcode', fr: 'Supprimer le code', 'pt-BR': 'Remover senha', it: 'Rimuovi codice', es: 'Quitar código' },
  passcodeSet: { en: 'Passcode set', fr: 'Code défini', 'pt-BR': 'Senha definida', it: 'Codice impostato', es: 'Código establecido' },
  passcodeRemoved: { en: 'Passcode removed', fr: 'Code supprimé', 'pt-BR': 'Senha removida', it: 'Codice rimosso', es: 'Código eliminado' },
  passcodeTooShort: { en: 'Use at least 4 digits', fr: 'Utilisez au moins 4 chiffres', 'pt-BR': 'Use pelo menos 4 dígitos', it: 'Usa almeno 4 cifre', es: 'Usa al menos 4 dígitos' },
  passcodesDontMatch: { en: "Passcodes don't match", fr: 'Les codes ne correspondent pas', 'pt-BR': 'As senhas não coincidem', it: 'I codici non corrispondono', es: 'Los códigos no coinciden' },
  a2hsMessage: { en: 'Tap the Share icon below, then "Add to Home Screen" so this opens like a real app next time.', fr: "Appuyez sur l'icône Partager ci-dessous, puis « Sur l'écran d'accueil » pour que ça s'ouvre comme une vraie application la prochaine fois.", 'pt-BR': 'Toque no ícone Compartilhar abaixo e depois em "Adicionar à Tela de Início" para abrir como um app de verdade da próxima vez.', it: 'Tocca l\'icona Condividi qui sotto, poi "Aggiungi alla schermata Home" così si aprirà come un\'app vera la prossima volta.', es: 'Toca el icono Compartir de abajo y luego "Añadir a pantalla de inicio" para que se abra como una app real la próxima vez.' },
  openOnPhone: { en: 'Open on your phone', fr: 'Ouvrez sur votre téléphone', 'pt-BR': 'Abra no seu celular', it: 'Apri sul tuo telefono', es: 'Abre en tu teléfono' },
  openOnPhoneNote: { en: "This app is built for a phone screen. Scan this with your phone's camera to open it there, or continue here anyway.", fr: "Cette application est conçue pour un écran de téléphone. Scannez ce code avec l'appareil photo de votre téléphone pour l'ouvrir là-bas, ou continuez ici quand même.", 'pt-BR': 'Este app foi feito para a tela de um celular. Escaneie com a câmera do seu celular para abrir lá, ou continue aqui mesmo assim.', it: "Questa app è pensata per lo schermo di un telefono. Scansiona con la fotocamera del telefono per aprirla lì, oppure continua qui comunque.", es: 'Esta app está hecha para la pantalla de un teléfono. Escanéalo con la cámara de tu teléfono para abrirlo ahí, o continúa aquí de todos modos.' },
  continueAnyway: { en: 'Continue here anyway', fr: 'Continuer ici quand même', 'pt-BR': 'Continuar aqui mesmo assim', it: 'Continua qui comunque', es: 'Continuar aquí de todos modos' },
  payDay: { en: 'Pay day', fr: 'Jour de paie', 'pt-BR': 'Dia do pagamento', it: 'Giorno di paga', es: 'Día de pago' },
  payDayField: { en: 'Day of month you get paid', fr: 'Jour du mois où vous êtes payé', 'pt-BR': 'Dia do mês em que você recebe', it: 'Giorno del mese in cui vieni pagato', es: 'Día del mes en que te pagan' },
  payDayNote: { en: "Your budget month runs from this day to the day before it next month, instead of the 1st to the end of the calendar month. Set this to 1 to use plain calendar months.", fr: "Votre mois budgétaire va de ce jour jusqu'à la veille de ce jour le mois suivant, au lieu du 1er à la fin du mois calendaire. Réglez sur 1 pour utiliser les mois calendaires normaux.", 'pt-BR': 'Seu mês de orçamento vai deste dia até o dia anterior no mês seguinte, em vez do dia 1 até o fim do mês do calendário. Defina como 1 para usar meses de calendário normais.', it: "Il tuo mese di budget va da questo giorno al giorno prima nel mese successivo, invece che dal 1° alla fine del mese di calendario. Imposta 1 per usare i normali mesi di calendario.", es: 'Tu mes de presupuesto va desde este día hasta el día anterior al mes siguiente, en lugar del día 1 al final del mes calendario. Pon 1 para usar meses de calendario normales.' },
  payDayCurrent: { en: 'Current period', fr: 'Période actuelle', 'pt-BR': 'Período atual', it: 'Periodo attuale', es: 'Período actual' },
  payDayModeDay: { en: 'A day of the month', fr: 'Un jour du mois', 'pt-BR': 'Um dia do mês', it: 'Un giorno del mese', es: 'Un día del mes' },
  payDayModeLastWeekday: { en: 'Last weekday of the month', fr: 'Dernier jour de semaine du mois', 'pt-BR': 'Último dia da semana do mês', it: 'Ultimo giorno della settimana del mese', es: 'Último día de la semana del mes' },
  payDayModeLastWorking: { en: 'Last working day of the month', fr: 'Dernier jour ouvré du mois', 'pt-BR': 'Último dia útil do mês', it: 'Ultimo giorno lavorativo del mese', es: 'Último día laborable del mes' },
  weekday: { en: 'Weekday', fr: 'Jour de la semaine', 'pt-BR': 'Dia da semana', it: 'Giorno della settimana', es: 'Día de la semana' },

  // Dashboard burn-down hero + progressive disclosure (v2.1)
  leftToSpend: { en: 'Left to spend', fr: 'Reste à dépenser', 'pt-BR': 'Disponível para gastar', it: 'Ancora da spendere', es: 'Disponible para gastar' },
  overspent: { en: 'Overspent this period', fr: 'Dépassement ce mois', 'pt-BR': 'Gasto excedido no período', it: 'Speso in eccesso', es: 'Gasto excedido en el período' },
  daysLeft: { en: 'days left', fr: 'jours restants', 'pt-BR': 'dias restantes', it: 'giorni rimasti', es: 'días restantes' },
  dayLeft: { en: 'day left', fr: 'jour restant', 'pt-BR': 'dia restante', it: 'giorno rimasto', es: 'día restante' },
  perDay: { en: 'day', fr: 'jour', 'pt-BR': 'dia', it: 'giorno', es: 'día' },
  periodEnded: { en: 'Period ended', fr: 'Période terminée', 'pt-BR': 'Período encerrado', it: 'Periodo terminato', es: 'Período terminado' },
  upcoming: { en: 'Upcoming', fr: 'À venir', 'pt-BR': 'Em breve', it: 'In arrivo', es: 'Próximamente' },
  spentOfIncome: { en: 'spent of', fr: 'dépensé sur', 'pt-BR': 'gasto de', it: 'speso su', es: 'gastado de' },
  insights: { en: 'Insights', fr: 'Analyses', 'pt-BR': 'Análises', it: 'Analisi', es: 'Análisis' },
  showUnused: { en: 'Show unused', fr: 'Afficher inutilisées', 'pt-BR': 'Mostrar não usadas', it: 'Mostra inutilizzate', es: 'Mostrar sin usar' },
  hideUnused: { en: 'Hide unused', fr: 'Masquer inutilisées', 'pt-BR': 'Ocultar não usadas', it: 'Nascondi inutilizzate', es: 'Ocultar sin usar' },
  lastMonthWas: { en: 'last month', fr: 'le mois dernier', 'pt-BR': 'mês passado', it: 'mese scorso', es: 'el mes pasado' },
  more: { en: 'More', fr: 'Plus', 'pt-BR': 'Mais', it: 'Altro', es: 'Más' },
  navigation: { en: 'Navigation', fr: 'Navigation', 'pt-BR': 'Navegação', it: 'Navigazione', es: 'Navegación' }
}

export function t(lang, key) {
  const entry = strings[key]
  if (!entry) return key
  return entry[lang] || entry.en || key
}

// --- Locale-aware formatting -------------------------------------------
// The app supports five languages and EUR/USD/GBP. Numbers, currency
// symbol placement, and month names must follow the reader's locale, not
// a hardcoded en-US one, so amounts read naturally for a family member in
// any of the five languages.
const LOCALE_BY_LANG = {
  en: 'en-IE', // euro-first English formatting (€1,045) — the app's default currency
  fr: 'fr-FR',
  'pt-BR': 'pt-BR',
  it: 'it-IT',
  es: 'es-ES'
}

export function localeFor(lang) {
  return LOCALE_BY_LANG[lang] || 'en-US'
}

// Format a decimal amount as localized currency. Defaults to whole units
// (no cents) to stay glanceable, matching the app's existing display, but
// now with correct thousands separators and per-locale symbol placement.
export function formatMoney(lang, currency, amount, { decimals = 0 } = {}) {
  const value = typeof amount === 'number' ? amount : 0
  const code = currency?.code || 'EUR'
  try {
    return new Intl.NumberFormat(localeFor(lang), {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      currencyDisplay: 'narrowSymbol'
    }).format(value)
  } catch {
    const sym = currency?.symbol || ''
    return `${sym}${value.toFixed(decimals)}`
  }
}

// Short month name in the reader's language (replaces a hardcoded en-US
// call). `monthKey` is a 'YYYY-MM' string.
export function formatMonthShort(lang, monthKey) {
  try {
    return new Date(monthKey + '-02T00:00:00').toLocaleDateString(localeFor(lang), { month: 'short' })
  } catch {
    return monthKey
  }
}
