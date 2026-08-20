// Zweisprachigkeit (Deutsch/Englisch) für die komplette isybee-Oberfläche.
//
// Funktionsweise:
// - LangProvider umschließt die ganze App (siehe main.tsx) und stellt per Context
//   die aktuelle Sprache + das Übersetzungswörterbuch (t) bereit.
// - Erkennung beim ersten Start: gespeicherte Wahl in localStorage > Systemsprache
//   des Geräts/Browsers (navigator.language) > Fallback Deutsch.
// - Die Wahl wird in localStorage gemerkt (Key "isybee:lang") und übersteuert danach
//   die automatische Erkennung dauerhaft, bis der/die Nutzer:in erneut umschaltet.
// - useT() gibt direkt das Wörterbuch der aktuellen Sprache zurück, useLang() zusätzlich
//   die Sprache selbst und setLang() zum Umschalten (siehe LanguageSwitch-Button in App.tsx).
//
// WICHTIG zu gespeicherten/persistierten Werten (siehe Kommentare weiter unten bei
// HIVE_CATEGORIES/COLOR_PALETTE-Übersetzung sowie STOCK_CHANGE_PREFIX in App.tsx):
// Alles, was als Wert in der Datenbank landet (Kategorie-Auswahl, Volksstärke,
// der Änderungsprotokoll-Präfix), bleibt intern IMMER auf Deutsch/kanonisch, egal
// welche Anzeigesprache gerade aktiv ist - nur die ANZEIGE wird übersetzt. Sonst
// würde z. B. das Umschalten der Sprache alte Datensätze unlesbar für die
// Stammdaten-Änderungserkennung machen oder dazu führen, dass in einem
// zweisprachigen Haushalt (z. B. Bernhard Deutsch, ein Familienmitglied Englisch)
// dieselbe Kategorie je nach Gerät als unterschiedlicher Text gespeichert wird.

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "de" | "en";

const STORAGE_KEY = "isybee:lang";

function detectInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "de" || stored === "en") return stored;
  } catch {
    // localStorage nicht verfügbar - einfach mit der Geräte-Spracherkennung weitermachen
  }
  const nav = (navigator.language || "de").toLowerCase();
  return nav.startsWith("de") ? "de" : "en";
}

// Locale für Date.toLocaleDateString() & Co., passend zur jeweiligen Anzeigesprache.
export function dateLocale(lang: Lang): string {
  return lang === "de" ? "de-DE" : "en-GB";
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

const de = {
  common: {
    cancel: "Abbrechen",
    close: "Schließen",
    delete: "Löschen",
    edit: "Bearbeiten",
    save: "Speichern",
    saving: "Speichere…",
    none: "–",
    yes: "Ja",
    no: "Nein",
    moment: "Einen Moment …",
    genericSaveError: "Fehler beim Speichern",
    hiveFallback: (n: number) => `Stock ${n}`,
    langSwitchLabel: "Sprache wechseln",
  },
  app: {
    title: "🐝 isybee",
    subtitleLogin: "Dein digitales Bienentagebuch",
    subtitleDiary: (n: number) => `Kontrollen für deine ${n} Bienenstöcke`,
    hiveCountToggle: "Anzahl Bienenstöcke ändern",
    hiveCountLabel: "Anzahl Bienenstöcke",
    hiveCountError: "Bitte eine Zahl zwischen 1 und 60 eingeben.",
    hiveCountSaveError: "Speichern fehlgeschlagen. Bitte Internetverbindung prüfen.",
    userGreeting: (name: string) => `👤 ${name}`,
    adminOnlyHint: "Nur für dich als Admin sichtbar",
    totalUsers: (n: number) => `👥 ${n} ${plural(n, "Nutzer", "Nutzer:innen")} insgesamt`,
    manageUsers: "Nutzer verwalten",
    manageSubscription: "Abo verwalten",
    switchUser: "Nutzer wechseln",
    online: "🟢 Online",
    offline: "🔴 Kein Internet",
    pendingInfo: (n: number) => `${n} ${plural(n, "Eintrag wartet", "Einträge warten")} auf Upload`,
    syncing: "Synchronisiere…",
    syncNow: "Jetzt synchronisieren",
    tabAll: "Alle",
    harvestEnter: "🍯 Ertrag eingeben",
    harvestYearBadge: (kg: number, year: number) => `🍯 ${kg} kg (${year})`,
    hintPickHive: "Wähle oben einen Stock aus, um einen neuen Eintrag anzulegen.",
    dailyEntries: "Tageseinträge",
    newEntryToggleClose: "Neuer Tageseintrag ✕",
    newEntryToggleFirst: "+ Den ersten Tagebucheintrag machen",
    newEntryToggleNormal: "+ Neuer Tageseintrag",
    eula: "Nutzungsbedingungen",
    privacy: "Datenschutzerklärung",
    confirmDeleteEntry: "Diesen Eintrag wirklich löschen?",
    // Auto-generierte Stammdaten-Änderungsprotokolle (siehe App.tsx describeStockPatch/logStockChange) -
    // der Erkennungs-Präfix selbst bleibt bewusst invariant/deutsch, siehe Kommentar oben im Dateikopf.
    stockChangeName: (name: string) => `Name: ${name || "–"}`,
    stockChangeColor: "Markierungsfarbe geändert",
    stockChangeCategory: (cat: string) => `Kategorie: ${cat || "–"}`,
    stockChangeQueenYear: (text: string) => `Königin-Zuchtjahr: ${text}`,
    stockChangeStrength: (val: string) => `Volksstärke: ${val || "–"}`,
  },
  welcome: {
    claim: "Dein digitales Bienentagebuch",
    bullet1: "📋 Stockkontrollen digital erfassen",
    bullet2: "📴 Funktioniert offline",
    bullet3: "🍯 Ernte & Auswertung im Überblick",
    trialInfo: "30 Tage kostenlos testen, danach 0,99 € / Monat",
    cta: "Los geht's",
  },
  paywall: {
    subtitle: "Deine kostenlose Testphase ist abgelaufen",
    intro: (name: string) => (
      <>
        Um isybee als <strong>{name}</strong> weiter zu nutzen, brauchst du das
        isybee-Monatsabo.
      </>
    ),
    benefit1: "Unbegrenzt Tagebucheinträge und Fotos für alle deine Bienenstöcke",
    benefit2: "Offline-Nutzung mit automatischer Synchronisierung",
    benefit3: "Jahresauswertung und Erntestatistik",
    price: "0,99 € / Monat, automatische Verlängerung",
    terms: "isybee Monatsabo · Laufzeit: 1 Monat · jederzeit kündbar",
    subscribeNative: "Jetzt abonnieren",
    subscribeWeb: "Jetzt abonnieren (Stripe)",
    restore: "Käufe wiederherstellen",
    switchAccount: "Anderes Konto verwenden",
  },
  admin: {
    heading: "Admin: Nutzer verwalten",
    unlockHint: "Bitte deinen PIN bestätigen, um die Nutzerliste zu sehen.",
    pinLabel: "4-stelliger PIN",
    checking: "Prüfe…",
    unlock: "Entsperren",
    errAuth: "PIN falsch oder keine Admin-Berechtigung.",
    errAction: "Aktion fehlgeschlagen.",
    colName: "Name",
    colSince: "Dabei seit",
    colHives: "Stöcke",
    colSubscription: "Abo",
    colTrial: "Test",
    giftRevoke: "🎁 Geschenkt – entziehen",
    giftGrant: "Abo schenken",
    expireConfirm: (name: string) =>
      `Testphase von "${name}" künstlich auf abgelaufen setzen (Beitrittsdatum wird um 40 Tage zurückgesetzt)? Nur für Demo-/Testkonten verwenden, z. B. für die Apple-App-Prüfung.`,
    expireTrialBtn: "Trial ablaufen lassen",
    expireTrialTitle:
      "Nur für Demo-/Testkonten: Beitrittsdatum um 40 Tage zurücksetzen, damit die Testphase sofort abgelaufen ist.",
  },
  userPicker: {
    heading: "Wer bist du?",
    nameLabel: "Name",
    namePlaceholder: "z.B. Bernhard",
    pinLabel: "4-stelliger PIN",
    pinRepeatLabel: "PIN wiederholen",
    newUser: "Neuer Nutzer",
    login: "Anmelden",
    checking: "Prüfe…",
    back: "Zurück",
    create: "Nutzer anlegen",
    creating: "Lege an…",
    deleteUser: "Diesen Nutzer löschen",
    deleting: "Lösche…",
    errNameRequired: "Bitte deinen Namen eingeben.",
    errLoginFailed: "Name oder PIN falsch",
    errNoConnectionLogin: "Keine Verbindung – Anmeldung braucht einmalig Internet.",
    errNameRequiredDelete: "Bitte zuerst deinen Namen eingeben.",
    errPinRequiredDelete: "Bitte zuerst den 4-stelligen PIN eingeben.",
    confirmDelete: (name: string) =>
      `Nutzer "${name}" wirklich löschen? Alle Stöcke, Einträge und Fotos dieses Nutzers werden dabei unwiderruflich gelöscht.`,
    infoDeleted: "Nutzer wurde gelöscht.",
    errNoConnectionDelete: "Keine Verbindung – zum Löschen brauchst du einmal Internet.",
    errNameRequiredCreate: "Bitte einen Namen eingeben.",
    errPinFormat: "Der PIN muss aus genau 4 Ziffern bestehen.",
    errPinMismatch: "Die beiden PINs stimmen nicht überein.",
    errNameTaken: "Dieser Name ist schon vergeben.",
    errNoConnectionCreate: "Keine Verbindung – zum Anlegen eines neuen Nutzers brauchst du einmal Internet.",
  },
  entryForm: {
    date: "Datum",
    today: (d: string) => `Heute · ${d}`,
    customDate: (d: string, isCustom: boolean) => `📅 ${isCustom ? d : "Individuelles Datum"}`,
    sightings: "Sichtungen:",
    sightingQueen: "Königin",
    sightingLarvae: "Larven",
    sightingEggs: "Stifte",
    sightingBrood: "Brut",
    occupiedCombs: "Besetzte Waben",
    queenCells: "Weiselzellen",
    varroaMites: "Varroamilben",
    varroaTreatment: "Varroabefallbehandlung",
    varroaTreatmentPlaceholder: "z.B. gering, behandelt",
    feeding: "Fütterung",
    feedingPlaceholder: "z.B. 2L Sirup",
    weight: "Stockgewicht (kg)",
    weightPlaceholder: "z.B. 24.5",
    notes: "Notizen",
    photos: "Fotos",
    saveEntry: "Eintrag speichern",
    newEntryHeading: (hiveLabel: string) => `Neuer Tageseintrag – ${hiveLabel}`,
    closeNoSave: "Schließen, ohne zu speichern",
    offlineSaved:
      "Kein Internet – Eintrag wurde lokal gespeichert und wird automatisch hochgeladen, sobald du wieder online bist.",
    saveFailedTotal: "Eintrag konnte weder gesendet noch lokal gespeichert werden.",
    editHeading: "Eintrag bearbeiten",
    queenYear: "Königin – Zuchtjahr",
    colonyStrength: "Volksstärke",
    strengthWeak: "schwach",
    strengthMedium: "mittel",
    strengthStrong: "stark",
    existingPhotos: "Vorhandene Fotos",
    restorePhoto: "Zurückholen",
    removePhoto: "Entfernen",
    addMorePhotos: "Weitere Fotos hinzufügen",
    saveChanges: "Änderungen speichern",
  },
  entryList: {
    loading: "Lade Einträge…",
    empty: "Noch keine Einträge.",
    syncPending: "⏳ wird synchronisiert",
    queen: (year: number | null) => `👑 Königin${year ? ` ${year}` : ""}:`,
    strength: (v: string) => `🐝 ${v}`,
    varroa: (v: string) => `🔬 Varroa: ${v}`,
    feeding: (v: string) => `🍯 Fütterung: ${v}`,
    weight: (v: string | number) => `⚖️ Stockgewicht: ${v} kg`,
    sightingsLabel: (list: string) => `👁️ Sichtungen: ${list}`,
    combs: (v: number) => `🧱 Waben: ${v}`,
    cells: (v: number) => `👑 Weiselzellen: ${v}`,
    mites: (v: boolean) => `🔬 Varroamilben: ${v ? "Ja" : "Nein"}`,
    lightboxAlt: "Foto vergrößert",
    photoAlt: "Stockkontrolle",
  },
  harvestPanel: {
    heading: "🍯 Ertrag eingeben",
    modeTotal: "Ertrag gesamt",
    modePerHive: "Ertrag pro Stock",
    dateLabel: (d: string) => `Datum: ${d}`,
    totalAmount: "Menge gesamt (kg)",
    totalPlaceholder: "z.B. 12.5",
    perHiveHint: "Menge je Stock eintragen – leere Felder werden nicht gespeichert.",
    errTotalPositive: "Bitte eine Menge größer 0 eingeben.",
    errAnyPositive: "Bitte für mindestens einen Stock eine Menge größer 0 eingeben.",
    confirmDelete: "Diesen Ertragseintrag wirklich löschen?",
    history: "Historie",
    noHistory: "Noch keine Erträge erfasst.",
    total: "Gesamt",
    stockSum: (kg: string) => `Summe Stöcke: ${kg} kg`,
    hiveYieldLabel: (label: string) => `Ertrag für ${label} (kg)`,
  },
  harvestSummary: {
    heading: "🍯 Auswertung",
    loading: "Lade…",
    loadError: "Auswertung konnte nicht geladen werden.",
    empty: (year: number) => `Für ${year} sind noch keine Erträge erfasst.`,
    totalNoHive: "Gesamt (ohne Stock)",
    yearTotal: (year: number, kg: string) => `Summe ${year}: ${kg} kg`,
  },
  yearlyHarvest: {
    heading: "🍯 Gesamtertrag pro Jahr",
    intro: "Trage hier die insgesamt geerntete Honigmenge für ein Jahr ein – über alle Bienenstöcke zusammen.",
    yearLabel: "Jahr",
    totalLabel: "Ertrag gesamt (kg)",
    totalPlaceholder: "z.B. 42.5",
    loadError: "Erträge konnten nicht geladen werden.",
    empty: "Noch keine Erträge erfasst.",
    confirmDelete: (y: number) => `Ertrag für ${y} wirklich löschen?`,
  },
  colorPicker: {
    heading: "Stock-Stammdaten",
    hint: "Diese Angaben gelten dauerhaft für diesen Stock, bis du sie hier änderst.",
    nameLabel: (n: number) => `Name für Stock ${n}:`,
    categoryLabel: (n: number) => `Kategorie für Stock ${n}:`,
    strengthLabel: "Volksstärke:",
    queenLabel: "Königin (Zuchtjahr):",
    varroaBadgeTitle: "Wird im Tageseintrag erfasst, verschwindet automatisch bei Varroamilben = Nein",
    varroaBadge: "🔬 Varroamilben: Ja",
    weightBadgeTitle: "Wird im Tageseintrag erfasst, bleibt bis zu einem neuen Wert stehen",
    weightBadge: (kg: number) => `⚖️ Stockgewicht: ${kg} kg`,
    markLabel: (n: number) => `Stock ${n} markieren:`,
    noMark: "Keine Markierung",
    recentChanges: "Letzte Änderungen",
    noChanges: "Noch keine Änderungen.",
  },
  datePicker: {
    weekdays: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    prevMonth: "Vorheriger Monat",
    nextMonth: "Nächster Monat",
  },
  stockChangeList: {
    loading: "Lade Änderungen…",
    empty: "Noch keine Änderungen an den Stammdaten.",
  },
  queenColorField: {
    yearLabel: "Jahr eingeben",
    placeholder: "z.B. 2026",
    titleWithColor: (name: string) => `Markierungsfarbe: ${name}`,
    titleNoColor: "Noch kein Zuchtjahr eingegeben",
  },
  // Fehler-/Statusmeldungen aus subscription.ts - liegen dort außerhalb von React-
  // Komponenten, deshalb wird dieser Ausschnitt des Wörterbuchs explizit als Parameter
  // durchgereicht (siehe Aufrufe in Paywall.tsx/App.tsx).
  subscriptionMsg: {
    notAvailable: "Abo derzeit nicht verfügbar. Bitte später erneut versuchen.",
    noOffer: "Kein Abo-Angebot gefunden. Bitte später erneut versuchen.",
    purchasedNotActiveYet: "Kauf abgeschlossen, aber Abo noch nicht aktiv. Bitte kurz warten.",
    purchaseFailed: "Kauf fehlgeschlagen. Bitte später erneut versuchen.",
    restoreNotAvailable: "Wiederherstellung derzeit nicht verfügbar.",
    noActivePurchases: "Keine aktiven Käufe für dieses Konto gefunden.",
    restoreFailed: "Wiederherstellung fehlgeschlagen. Bitte später erneut versuchen.",
    billingPortalNotAvailable: "Abo-Verwaltung derzeit nicht verfügbar.",
  },
  // Anzeige-Übersetzungen für die kanonischen (immer deutschen) gespeicherten Werte -
  // siehe Kommentar am Dateikopf. Schlüssel = Wert, wie er in types.ts/DB steht.
  categories: {
    Wirtschaftsvolk: "Wirtschaftsvolk",
    Ableger: "Ableger",
    Schwarm: "Schwarm",
    Zuchtvolk: "Zuchtvolk",
    Sonstiges: "Sonstiges",
  } as Record<string, string>,
  colorNames: {
    Blau: "Blau",
    Weiß: "Weiß",
    Hellblau: "Hellblau",
    Grün: "Grün",
    Rot: "Rot",
    Gelb: "Gelb",
  } as Record<string, string>,
  strengthLabels: {
    schwach: "schwach",
    mittel: "mittel",
    stark: "stark",
  } as Record<string, string>,
};

type Dict = typeof de;

const en: Dict = {
  common: {
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    edit: "Edit",
    save: "Save",
    saving: "Saving…",
    none: "–",
    yes: "Yes",
    no: "No",
    moment: "One moment …",
    genericSaveError: "Error while saving",
    hiveFallback: (n: number) => `Hive ${n}`,
    langSwitchLabel: "Switch language",
  },
  app: {
    title: "🐝 isybee",
    subtitleLogin: "Your digital beekeeping diary",
    subtitleDiary: (n: number) => `Track your ${n} beehives`,
    hiveCountToggle: "Change number of hives",
    hiveCountLabel: "Number of hives",
    hiveCountError: "Please enter a number between 1 and 60.",
    hiveCountSaveError: "Saving failed. Please check your internet connection.",
    userGreeting: (name: string) => `👤 ${name}`,
    adminOnlyHint: "Only visible to you as admin",
    totalUsers: (n: number) => `👥 ${n} ${plural(n, "user", "users")} in total`,
    manageUsers: "Manage users",
    manageSubscription: "Manage subscription",
    switchUser: "Switch user",
    online: "🟢 Online",
    offline: "🔴 No internet",
    pendingInfo: (n: number) => `${n} ${plural(n, "entry", "entries")} waiting to upload`,
    syncing: "Syncing…",
    syncNow: "Sync now",
    tabAll: "All",
    harvestEnter: "🍯 Log harvest",
    harvestYearBadge: (kg: number, year: number) => `🍯 ${kg} kg (${year})`,
    hintPickHive: "Select a hive above to create a new entry.",
    dailyEntries: "Daily entries",
    newEntryToggleClose: "New daily entry ✕",
    newEntryToggleFirst: "+ Make the first diary entry",
    newEntryToggleNormal: "+ New daily entry",
    eula: "Terms of use",
    privacy: "Privacy policy",
    confirmDeleteEntry: "Really delete this entry?",
    stockChangeName: (name: string) => `Name: ${name || "–"}`,
    stockChangeColor: "Marker color changed",
    stockChangeCategory: (cat: string) => `Category: ${cat || "–"}`,
    stockChangeQueenYear: (text: string) => `Queen year: ${text}`,
    stockChangeStrength: (val: string) => `Colony strength: ${val || "–"}`,
  },
  welcome: {
    claim: "Your digital beekeeping diary",
    bullet1: "📋 Log hive inspections digitally",
    bullet2: "📴 Works offline",
    bullet3: "🍯 Harvest & stats at a glance",
    trialInfo: "30 days free, then 0.99 € / month",
    cta: "Get started",
  },
  paywall: {
    subtitle: "Your free trial has ended",
    intro: (name: string) => (
      <>
        To keep using isybee as <strong>{name}</strong>, you need the isybee
        monthly subscription.
      </>
    ),
    benefit1: "Unlimited diary entries and photos for all your beehives",
    benefit2: "Offline use with automatic sync",
    benefit3: "Yearly overview and harvest statistics",
    price: "€0.99 / month, auto-renewing",
    terms: "isybee monthly subscription · Term: 1 month · cancel anytime",
    subscribeNative: "Subscribe now",
    subscribeWeb: "Subscribe now (Stripe)",
    restore: "Restore purchases",
    switchAccount: "Use a different account",
  },
  admin: {
    heading: "Admin: manage users",
    unlockHint: "Please confirm your PIN to view the user list.",
    pinLabel: "4-digit PIN",
    checking: "Checking…",
    unlock: "Unlock",
    errAuth: "Wrong PIN or no admin permission.",
    errAction: "Action failed.",
    colName: "Name",
    colSince: "Joined",
    colHives: "Hives",
    colSubscription: "Subscription",
    colTrial: "Trial",
    giftRevoke: "🎁 Gifted – revoke",
    giftGrant: "Gift subscription",
    expireConfirm: (name: string) =>
      `Artificially expire the trial for "${name}" (join date will be moved back 40 days)? Only use this for demo/test accounts, e.g. for Apple's app review.`,
    expireTrialBtn: "Expire trial",
    expireTrialTitle: "Demo/test accounts only: moves the join date back 40 days so the trial expires immediately.",
  },
  userPicker: {
    heading: "Who are you?",
    nameLabel: "Name",
    namePlaceholder: "e.g. Bernhard",
    pinLabel: "4-digit PIN",
    pinRepeatLabel: "Repeat PIN",
    newUser: "New user",
    login: "Log in",
    checking: "Checking…",
    back: "Back",
    create: "Create user",
    creating: "Creating…",
    deleteUser: "Delete this user",
    deleting: "Deleting…",
    errNameRequired: "Please enter your name.",
    errLoginFailed: "Wrong name or PIN",
    errNoConnectionLogin: "No connection – logging in requires internet once.",
    errNameRequiredDelete: "Please enter your name first.",
    errPinRequiredDelete: "Please enter the 4-digit PIN first.",
    confirmDelete: (name: string) =>
      `Really delete user "${name}"? All hives, entries and photos for this user will be permanently deleted.`,
    infoDeleted: "User was deleted.",
    errNoConnectionDelete: "No connection – deleting requires internet once.",
    errNameRequiredCreate: "Please enter a name.",
    errPinFormat: "The PIN must be exactly 4 digits.",
    errPinMismatch: "The two PINs don't match.",
    errNameTaken: "This name is already taken.",
    errNoConnectionCreate: "No connection – creating a new user requires internet once.",
  },
  entryForm: {
    date: "Date",
    today: (d: string) => `Today · ${d}`,
    customDate: (d: string, isCustom: boolean) => `📅 ${isCustom ? d : "Custom date"}`,
    sightings: "Observations:",
    sightingQueen: "Queen",
    sightingLarvae: "Larvae",
    sightingEggs: "Eggs",
    sightingBrood: "Brood",
    occupiedCombs: "Occupied combs",
    queenCells: "Queen cells",
    varroaMites: "Varroa mites",
    varroaTreatment: "Varroa treatment",
    varroaTreatmentPlaceholder: "e.g. mild, treated",
    feeding: "Feeding",
    feedingPlaceholder: "e.g. 2L syrup",
    weight: "Hive weight (kg)",
    weightPlaceholder: "e.g. 24.5",
    notes: "Notes",
    photos: "Photos",
    saveEntry: "Save entry",
    newEntryHeading: (hiveLabel: string) => `New daily entry – ${hiveLabel}`,
    closeNoSave: "Close without saving",
    offlineSaved:
      "No internet – entry was saved locally and will upload automatically once you're back online.",
    saveFailedTotal: "Entry could not be sent or saved locally.",
    editHeading: "Edit entry",
    queenYear: "Queen – year raised",
    colonyStrength: "Colony strength",
    strengthWeak: "weak",
    strengthMedium: "medium",
    strengthStrong: "strong",
    existingPhotos: "Existing photos",
    restorePhoto: "Restore",
    removePhoto: "Remove",
    addMorePhotos: "Add more photos",
    saveChanges: "Save changes",
  },
  entryList: {
    loading: "Loading entries…",
    empty: "No entries yet.",
    syncPending: "⏳ syncing",
    queen: (year: number | null) => `👑 Queen${year ? ` ${year}` : ""}:`,
    strength: (v: string) => `🐝 ${v}`,
    varroa: (v: string) => `🔬 Varroa: ${v}`,
    feeding: (v: string) => `🍯 Feeding: ${v}`,
    weight: (v: string | number) => `⚖️ Hive weight: ${v} kg`,
    sightingsLabel: (list: string) => `👁️ Observations: ${list}`,
    combs: (v: number) => `🧱 Combs: ${v}`,
    cells: (v: number) => `👑 Queen cells: ${v}`,
    mites: (v: boolean) => `🔬 Varroa mites: ${v ? "Yes" : "No"}`,
    lightboxAlt: "Enlarged photo",
    photoAlt: "Hive inspection",
  },
  harvestPanel: {
    heading: "🍯 Log harvest",
    modeTotal: "Total harvest",
    modePerHive: "Harvest per hive",
    dateLabel: (d: string) => `Date: ${d}`,
    totalAmount: "Total amount (kg)",
    totalPlaceholder: "e.g. 12.5",
    perHiveHint: "Enter an amount per hive – empty fields are not saved.",
    errTotalPositive: "Please enter an amount greater than 0.",
    errAnyPositive: "Please enter an amount greater than 0 for at least one hive.",
    confirmDelete: "Really delete this harvest entry?",
    history: "History",
    noHistory: "No harvest recorded yet.",
    total: "Total",
    stockSum: (kg: string) => `Hive total: ${kg} kg`,
    hiveYieldLabel: (label: string) => `Harvest for ${label} (kg)`,
  },
  harvestSummary: {
    heading: "🍯 Summary",
    loading: "Loading…",
    loadError: "Summary could not be loaded.",
    empty: (year: number) => `No harvest recorded for ${year} yet.`,
    totalNoHive: "Total (no hive assigned)",
    yearTotal: (year: number, kg: string) => `Total ${year}: ${kg} kg`,
  },
  yearlyHarvest: {
    heading: "🍯 Total harvest per year",
    intro: "Enter the total amount of honey harvested for a year here – across all your beehives.",
    yearLabel: "Year",
    totalLabel: "Total harvest (kg)",
    totalPlaceholder: "e.g. 42.5",
    loadError: "Harvest could not be loaded.",
    empty: "No harvest recorded yet.",
    confirmDelete: (y: number) => `Really delete the harvest for ${y}?`,
  },
  colorPicker: {
    heading: "Hive master data",
    hint: "These settings apply permanently to this hive until you change them here.",
    nameLabel: (n: number) => `Name for hive ${n}:`,
    categoryLabel: (n: number) => `Category for hive ${n}:`,
    strengthLabel: "Colony strength:",
    queenLabel: "Queen (year raised):",
    varroaBadgeTitle: "Recorded in the daily entry, disappears automatically once varroa mites = No",
    varroaBadge: "🔬 Varroa mites: Yes",
    weightBadgeTitle: "Recorded in the daily entry, stays until a new value is entered",
    weightBadge: (kg: number) => `⚖️ Hive weight: ${kg} kg`,
    markLabel: (n: number) => `Mark hive ${n}:`,
    noMark: "No marking",
    recentChanges: "Recent changes",
    noChanges: "No changes yet.",
  },
  datePicker: {
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    prevMonth: "Previous month",
    nextMonth: "Next month",
  },
  stockChangeList: {
    loading: "Loading changes…",
    empty: "No changes to the master data yet.",
  },
  queenColorField: {
    yearLabel: "Enter year",
    placeholder: "e.g. 2026",
    titleWithColor: (name: string) => `Marker color: ${name}`,
    titleNoColor: "No year entered yet",
  },
  subscriptionMsg: {
    notAvailable: "Subscription currently unavailable. Please try again later.",
    noOffer: "No subscription offer found. Please try again later.",
    purchasedNotActiveYet: "Purchase completed, but subscription not active yet. Please wait a moment.",
    purchaseFailed: "Purchase failed. Please try again later.",
    restoreNotAvailable: "Restore currently unavailable.",
    noActivePurchases: "No active purchases found for this account.",
    restoreFailed: "Restore failed. Please try again later.",
    billingPortalNotAvailable: "Subscription management currently unavailable.",
  },
  categories: {
    Wirtschaftsvolk: "Production colony",
    Ableger: "Nucleus colony",
    Schwarm: "Swarm",
    Zuchtvolk: "Breeding colony",
    Sonstiges: "Other",
  },
  colorNames: {
    Blau: "Blue",
    Weiß: "White",
    Hellblau: "Light blue",
    Grün: "Green",
    Rot: "Red",
    Gelb: "Yellow",
  },
  strengthLabels: {
    schwach: "weak",
    mittel: "medium",
    stark: "strong",
  },
};

const dictionaries: Record<Lang, Dict> = { de, en };

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectInitialLang());

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "de" ? "isybee – Bienentagebuch" : "isybee – Beekeeping diary";
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Speicher nicht verfügbar - die Wahl gilt dann nur für diese Sitzung
    }
  }

  return <LangContext.Provider value={{ lang, setLang, t: dictionaries[lang] }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang() muss innerhalb von <LangProvider> verwendet werden.");
  return ctx;
}

// Kurzform für Komponenten, die nur das Wörterbuch brauchen, nicht Sprache/Umschalter.
export function useT() {
  return useLang().t;
}

// Kleiner DE/EN-Umschalter, oben rechts auf jedem App-Screen (siehe .lang-switch in
// index.css) - überall dort eingebunden, wo <div className="app"> die Wurzel ist
// (App.tsx, Paywall.tsx), damit er auch vor dem Login sichtbar/erreichbar ist.
export function LanguageSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="lang-switch" role="group" aria-label={t.common.langSwitchLabel}>
      <button type="button" className={lang === "de" ? "active" : ""} onClick={() => setLang("de")}>
        DE
      </button>
      <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
        EN
      </button>
    </div>
  );
}
