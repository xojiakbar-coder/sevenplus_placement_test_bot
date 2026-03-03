require("dotenv").config();

const { Telegraf, Markup, session } = require("telegraf");
const questions = require("./questions");
const { placementLabel, chunkRows } = require("./utils");

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("Missing BOT_TOKEN. Create a .env file (see .env.example).");
}

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

const passageById = (() => {
  const map = new Map();
  for (const q of questions) {
    const p = q.passage;
    if (p?.id && p?.text) {
      map.set(p.id, { id: p.id, title: p.title, text: p.text });
    }
  }
  return map;
})();

function ensurePrivateChat(ctx) {
  return ctx.chat && ctx.chat.type === "private";
}

function resetSession(ctx) {
  ctx.session = {
    state: "ASK_NAME",
    name: null,
    phone: null,
    current: 0,
    score: 0,
    answers: [],
    lastPassageIdShown: null
  };
}

async function askName(ctx) {
  await ctx.reply(
    "Welcome to the English Placement Test.\n\nPlease type your full name (or the username you want to use)."
  );
}

async function askContact(ctx) {
  await ctx.reply(
    `Thanks, ${ctx.session.name}.\n\nNow share your phone number to start the test.`,
    Markup.keyboard([Markup.button.contactRequest("Share phone number")]).oneTime().resize()
  );
  await ctx.reply("If you can’t use the button, you can type your phone number (example: +12025550123).");
}

function formatQuestionHeader(ctx, q) {
  const idx = ctx.session.current + 1;
  const total = questions.length;
  return `Question ${idx}/${total} — ${q.section}`;
}

async function sendQuestion(ctx) {
  const q = questions[ctx.session.current];
  if (!q) return finishTest(ctx);

  if (q.passage?.id) {
    const p = q.passage.text ? q.passage : passageById.get(q.passage.id);
    if (p?.id && p?.text && ctx.session.lastPassageIdShown !== p.id) {
      ctx.session.lastPassageIdShown = p.id;
      const title = p.title ? `${p.title}\n\n` : "";
      await ctx.reply(`${title}${p.text}`);
    }
  }

  const header = formatQuestionHeader(ctx, q);
  const prompt = `${header}\n\n${q.question}`;

  const rows = chunkRows(
    q.options.map((opt, i) => Markup.button.callback(opt, `q:${ctx.session.current}:a:${i}`)),
    2
  );

  await ctx.reply(prompt, Markup.inlineKeyboard(rows));
}

async function startTest(ctx) {
  ctx.session.state = "TEST";
  ctx.session.current = 0;
  ctx.session.score = 0;
  ctx.session.answers = [];
  ctx.session.lastPassageIdShown = null;

  await ctx.reply(
    "Great. Starting the test now.\n\n- 50 multiple-choice questions\n- Tap the best answer button\n\nGood luck!",
    Markup.removeKeyboard()
  );
  await sendQuestion(ctx);
}

async function finishTest(ctx) {
  ctx.session.state = "DONE";
  const total = questions.length;
  const score = ctx.session.score;
  const level = placementLabel(score, total);

  await ctx.reply(
    `Test finished.\n\nName: ${ctx.session.name}\nPhone: ${ctx.session.phone}\n\nScore: ${score}/${total}\nLevel: ${level}\n\nYou can type /restart to take the test again.`
  );
}

bot.start(async (ctx) => {
  if (!ensurePrivateChat(ctx)) return;
  resetSession(ctx);
  await askName(ctx);
});

bot.command("restart", async (ctx) => {
  if (!ensurePrivateChat(ctx)) return;
  resetSession(ctx);
  await askName(ctx);
});

bot.command("status", async (ctx) => {
  if (!ensurePrivateChat(ctx)) return;
  if (!ctx.session) resetSession(ctx);
  const total = questions.length;
  const idx = ctx.session.current + 1;
  await ctx.reply(
    `State: ${ctx.session.state}\nName: ${ctx.session.name ?? "-"}\nPhone: ${ctx.session.phone ?? "-"}\nProgress: ${ctx.session.state === "TEST" ? `${idx}/${total}` : "-"}\nScore: ${ctx.session.score}/${total}`
  );
});

bot.on("contact", async (ctx) => {
  if (!ensurePrivateChat(ctx)) return;
  if (!ctx.session) resetSession(ctx);

  if (ctx.session.state !== "ASK_CONTACT") {
    await ctx.reply("Thanks. If you want to take the test, type /restart.");
    return;
  }

  const phone = ctx.message?.contact?.phone_number;
  if (!phone) {
    await ctx.reply("I couldn't read the phone number. Please try again.");
    return;
  }

  ctx.session.phone = phone;
  await startTest(ctx);
});

bot.action(/^q:(\d+):a:(\d+)$/, async (ctx) => {
  if (!ensurePrivateChat(ctx)) return;
  if (!ctx.session) resetSession(ctx);

  const qIndex = Number(ctx.match[1]);
  const aIndex = Number(ctx.match[2]);

  if (ctx.session.state !== "TEST") {
    await ctx.answerCbQuery("No active test.");
    return;
  }

  if (qIndex !== ctx.session.current) {
    await ctx.answerCbQuery("This question is no longer active.");
    return;
  }

  const q = questions[qIndex];
  const isCorrect = aIndex === q.answer;

  ctx.session.answers.push({ id: q.id, selected: aIndex, correct: q.answer, ok: isCorrect });
  if (isCorrect) ctx.session.score += 1;

  await ctx.answerCbQuery(isCorrect ? "Correct" : "Wrong");

  try {
    await ctx.editMessageReplyMarkup();
  } catch (_) {
    // ignore (message might be not editable)
  }

  if (!isCorrect) {
    await ctx.reply(`Correct answer: ${q.options[q.answer]}`);
  }

  ctx.session.current += 1;
  await sendQuestion(ctx);
});

bot.on("text", async (ctx) => {
  if (!ensurePrivateChat(ctx)) return;
  if (!ctx.session) resetSession(ctx);

  const text = (ctx.message?.text ?? "").trim();
  if (!text) return;

  if (ctx.session.state === "ASK_NAME") {
    ctx.session.name = text;
    ctx.session.state = "ASK_CONTACT";
    await askContact(ctx);
    return;
  }

  if (ctx.session.state === "ASK_CONTACT") {
    const phoneCandidate = text.replace(/\s+/g, "");
    const phoneOk = /^\+?[0-9]{7,15}$/.test(phoneCandidate);
    if (!phoneOk) {
      await ctx.reply("Please share your contact using the button, or type a valid phone number (example: +12025550123).");
      return;
    }
    ctx.session.phone = phoneCandidate;
    await startTest(ctx);
    return;
  }

  if (ctx.session.state === "TEST") {
    await ctx.reply("Please answer using the buttons under the question. You can type /status anytime.");
    return;
  }

  await ctx.reply("Type /restart to start the test.");
});

bot.catch((err) => {
  console.error("Bot error:", err);
});

bot.launch().then(() => console.log("Bot started."));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

