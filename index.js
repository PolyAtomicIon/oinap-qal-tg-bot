var tokens = require("./_token.js");
var fs = require("fs");
var Telegraf = require("telegraf");
var express = require("express");
var bodyParser = require("body-parser");
var path = require("path");

const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const gamesFolder = path.resolve(__dirname, "./");
const gamesToUploadFolder = path.resolve(__dirname, "./games");
const unzipper = require("unzipper");

var bot = new Telegraf(tokens.BOT_TOKEN);
var app = express();

app.set("port", tokens.PORT || tokens.DEFAULT_PORT);
app.use(express.static(path.join(__dirname + "/html")));
app.use(bot.webhookCallback("/bot" + tokens.BOT_TOKEN));

bot.telegram.setWebhook(tokens.WEBHOOK + "bot" + tokens.BOT_TOKEN);

bot.gameQuery((ctx) => {
  var uid = ctx.from.id;
  var url;

  if (ctx.callbackQuery.message) {
    var msgid = ctx.callbackQuery.message.message_id;
    var chatid = ctx.chat.id;
    url =
      tokens.GAME_URL + "?uid=" + uid + "&chatid=" + chatid + "&msgid=" + msgid;
  } else if (ctx.callbackQuery.inline_message_id) {
    var iid = ctx.callbackQuery.inline_message_id;
    url = tokens.GAME_URL + "?uid=" + uid + "&iid=" + iid;
  } else {
    console.log("No detail for update from callback query.");
    url = tokens.GAME_URL;
  }

  ctx.answerGameQuery(url);
});

bot.command(["/start", "/help"], (ctx) => {
  var reply =
    "Hi! This is the bot for Three Tap Heroes.\n" +
    "Commands:\n" +
    "- /help Shows this message\n" +
    "- /instructions Prints the instructions for the game\n" +
    "- /credits Shows the credits\n" +
    "- /game Sends the game";
  ctx.reply(reply);
});

bot.command("/instructions", (ctx) => {
  var reply =
    "Three young heroes are standing between an army of monsters and " +
    "the innocent villagers! Help them coordinating their attacks to repel " +
    "the enemies. But beware! Only the frontmost enemy can be damaged. " +
    "If you miss and hit another target, you will loose hearts! If you run " +
    "out of hearts or the enemy reaches the heroes, it's Game Over!";
  ctx.reply(reply);
});

bot.command("/credits", (ctx) => {
  fs.readFile("./CREDITS.md", "utf8", (err, data) => {
    var answer = err
      ? "Somebody stole the CREDITS! Please wait while we call the Web Police"
      : data;
    ctx.reply(answer);
  });
});

bot.command("/game", (ctx) => {
  ctx.replyWithGame(tokens.GAME_NAME);
});

app.get("/games/:game_id/*", (req, res) => {
  res.sendFile(path.resolve(gamesFolder, `./${req.path}`));
});

app.get(
  "/setscore/uid/:user_id/chat/:chat_id/msg/:msg_id/score/:score",
  (req, res) => {
    bot.telegram.setGameScore(
      req.params.user_id,
      req.params.score,
      null,
      req.params.chat_id,
      req.params.msg_id
    );
    res.sendStatus(200);
  }
);

app.get("/setscore/uid/:user_id/iid/:iid/score/:score", (req, res) => {
  bot.telegram.setGameScore(
    req.params.user_id,
    req.params.score,
    req.params.iid
  );
  res.sendStatus(200);
});

app.listen(process.env.PORT || app.get("port"), () => {
  console.log("Listening on port:" + app.get("port"));
});

// GAME LOADER

var assign = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, gamesToUploadFolder);
  },
  filename: function (request, file, cb) {
    cb(null, uuidv4() + ".zip");
  },
});
var upload = multer({ storage: assign });

app.post("/upload-game/", upload.any(), async (req, res) => {
  let filePath = null;
  let fileName = null;

  req.files.forEach((file) => {
    filePath = file.path;
    fileName = file.filename.split(".")[0];
  });

  if (!filePath) {
    res.sendStatus(400);
    return;
  }

  fs.createReadStream(filePath)
    .pipe(
      unzipper.Extract({ path: path.resolve(gamesToUploadFolder, fileName) })
    )
    .promise()
    .then(() => fs.unlink(filePath, () => {}));

  res.sendStatus(200);
});
