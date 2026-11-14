"""Language list (Cape Town tourism languages first) + core UI strings.
Strings not translated for a language fall back to English."""
LANGS_PRIMARY = [("en", "English"), ("de", "Deutsch"), ("nl", "Nederlands"),
                 ("fr", "Français"), ("zh", "中文 (Mandarin)")]
LANGS_OTHER = [("af", "Afrikaans"), ("zu", "isiZulu"), ("xh", "isiXhosa"), ("es", "Español"),
               ("pt", "Português"), ("it", "Italiano"), ("ar", "العربية"), ("hi", "हिन्दी"),
               ("ja", "日本語"), ("ru", "Русский")]
CODES = {c for c, _ in LANGS_PRIMARY + LANGS_OTHER}

S = {
 "payments": {"en": "Payments", "de": "Zahlungen", "nl": "Betalingen", "fr": "Paiements", "zh": "收款", "af": "Betalings"},
 "transactions": {"en": "Transactions", "de": "Umsätze", "nl": "Transacties", "fr": "Transactions", "zh": "交易", "af": "Transaksies"},
 "analytics": {"en": "Analytics", "de": "Analysen", "nl": "Analyse", "fr": "Analyses", "zh": "分析", "af": "Analise"},
 "settings": {"en": "Settings", "de": "Einstellungen", "nl": "Instellingen", "fr": "Réglages", "zh": "设置", "af": "Instellings"},
 "take_payment": {"en": "Let’s take a payment.", "de": "Zahlung entgegennehmen.", "nl": "Laten we een betaling aannemen.", "fr": "Encaissons un paiement.", "zh": "开始收款。", "af": "Kom ons neem ’n betaling."},
 "amount_to_charge": {"en": "AMOUNT TO CHARGE", "de": "BETRAG", "nl": "TE BETALEN BEDRAG", "fr": "MONTANT À ENCAISSER", "zh": "收款金额"},
 "enter_amount": {"en": "Enter amount to charge in ZAR", "de": "Betrag in ZAR eingeben", "nl": "Voer bedrag in ZAR in", "fr": "Saisissez le montant en ZAR", "zh": "输入收款金额（ZAR）"},
 "create_request": {"en": "Create payment request", "de": "Zahlungsanfrage erstellen", "nl": "Betaalverzoek maken", "fr": "Créer la demande de paiement", "zh": "创建收款请求"},
 "good_morning": {"en": "Good morning", "de": "Guten Morgen", "nl": "Goedemorgen", "fr": "Bonjour", "zh": "早上好", "af": "Goeie môre"},
 "language": {"en": "Language", "de": "Sprache", "nl": "Taal", "fr": "Langue", "zh": "语言", "af": "Taal"},
 "sales_analytics": {"en": "Sales analytics", "de": "Verkaufsanalyse", "nl": "Verkoopanalyse", "fr": "Analyse des ventes", "zh": "销售分析"},
}


def t(key: str, lang: str = "en") -> str:
    d = S.get(key, {})
    return d.get(lang) or d.get("en") or key
