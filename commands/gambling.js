const Jimp = require("jimp");
const Discord = require("discord.js");

// @ts-ignore
require("../types.js");

const dailyCooldownHours = 20;
const dailyCooldownTime = dailyCooldownHours*60*60*1000;

/**
 * @param {PassthroughType} passthrough
 */
module.exports = function(passthrough) {
	let { client, commands, reloader } = passthrough;

	let utils = require("../modules/utilities.js")(passthrough);
	reloader.useSync("./modules/utilities.js", utils);
	
	let lang = require("../modules/lang.js")(passthrough);
	reloader.useSync("./modules/lang.js", lang);

	let imageStorage = new utils.JIMPStorage();
	imageStorage.save("font", "font", ".fonts/Whitney-20.fnt");
	imageStorage.save("slot-canvas", "file", "./images/slot.png");
	imageStorage.save("emoji-apple", "file", "./images/emojis/apple.png");
	imageStorage.save("emoji-cherries", "file", "./images/emojis/cherries.png");
	imageStorage.save("emoji-heart", "file", "./images/emojis/heart.png");
	imageStorage.save("emoji-pear", "file", "./images/emojis/pear.png");
	imageStorage.save("emoji-strawberry", "file", "./images/emojis/strawberry.png");
	imageStorage.save("emoji-watermelon", "file", "./images/emojis/watermelon.png");
	imageStorage.save("wheel-canvas", "file", "./images/wheel.png");
	imageStorage.save("emoji-triangle", "file", "./images/emojis/triangle.png");
	["apple", "cherries", "heart", "pear", "strawberry", "watermelon"].forEach( i => imageStorage.get(`emoji-${i}`).then(image => image.resize(85, 85)));
	imageStorage.get("emoji-triangle").then(image => image.resize(50, 50, Jimp.RESIZE_NEAREST_NEIGHBOR));

	commands.assign({
		"slot": {
			usage: "[amount: Number|all]",
			description: "Runs a random slot machine for a chance at Discoins",
			aliases: ["slot", "slots"],
			category: "gambling",
			process: async function(msg, suffix) {
				if (msg.channel.type == "dm") return msg.channel.send(lang.command.guildOnly(msg));
				let permissions;
				if (msg.channel instanceof Discord.TextChannel) permissions = msg.channel.permissionsFor(client.user);
				if (!permissions.has("ATTACH_FILES")) return msg.channel.send(lang.permissionDeniedGeneric("attach files"));
				msg.channel.sendTyping();
				let args = suffix.split(" ");
				let array = ['apple', 'cherries', 'watermelon', 'pear', "strawberry"]; // plus heart, which is chosen seperately
				const cooldownInfo = {
					max: 23,
					min: 10,
					step: 1,
					regen: {
						amount: 1,
						time: 3*60*1000
					}
				};
				let [money, winChance, images] = await Promise.all([
					utils.coinsManager.get(msg.author.id),
					utils.cooldownManager(msg.author.id, "slot", cooldownInfo),
					imageStorage.getAll(["slot-canvas", "emoji-apple", "emoji-cherries", "emoji-heart", "emoji-pear", "emoji-strawberry", "emoji-watermelon", "font"])
				]);
				let slots = [];
				for (let i = 0; i < 3; i++) {
					if (Math.random() < winChance/100) {
						slots[i] = "heart";
					} else {
						slots[i] = array.random();
					}
				}

				let canvas = images.get("slot-canvas").clone();
				let pieces = [];
				slots.forEach(i => pieces.push(images.get(`emoji-${i}`)));

				canvas.composite(pieces[0], 120, 360);
				canvas.composite(pieces[1], 258, 360);
				canvas.composite(pieces[2], 392, 360);

				let font = images.get("font");

				let buffer, image;
				if (!args[0]) {
					canvas.print(font, 130, 523, "Nothing");
					canvas.print(font, 405, 523, "Nothing");
					buffer = await canvas.getBufferAsync(Jimp.MIME_PNG);
					image = new Discord.Attachment(buffer, "slot.png");
					return msg.channel.send({ files: [image] });
				}
				let bet;
				if (args[0] == "all") {
					if (money == 0) return msg.channel.send(lang.external.money.insufficient(msg));
					bet = money;
				} else {
					bet = Math.floor(Number(args[0]));
					if (isNaN(bet)) return msg.channel.send(lang.input.invalid(msg, "bet"));
					if (bet < 2) return msg.channel.send(lang.input.money.small(msg, "bet", 2));
					if (bet > money) return msg.channel.send(lang.external.money.insufficient(msg));
				}
				let result;
				let winning;
				if (slots.every(s => s == "heart")) {
					winning = bet * 30;
					result = `WOAH! Triple :heart: You won ${bet * 30} ${lang.emoji.discoin}`;
				} else if (slots.filter(s => s == "heart").length == 2) {
					winning = bet * 4;
					result = `Wow! Double :heart: You won ${bet * 4} ${lang.emoji.discoin}`;
				} else if (slots.filter(s => s == "heart").length == 1) {
					winning = Math.floor(bet * 1.25);
					result = `A single :heart: You won ${Math.floor(bet * 1.25)} ${lang.emoji.discoin}`;
				} else if (slots.slice(1).every(s => s == slots[0])) {
					winning = bet * 10;
					result = `A triple. You won ${bet * 10} ${lang.emoji.discoin}`;
				} else {
					winning = 0;
					result = `Sorry. You didn't get a match. You lost ${bet} ${lang.emoji.discoin}`;
				}
				utils.coinsManager.award(msg.author.id, winning-bet);
				canvas.print(font, 115, 523, winning);
				canvas.print(font, 390, 523, bet);
				buffer = await canvas.getBufferAsync(Jimp.MIME_PNG);
				image = new Discord.Attachment(buffer, "slot.png");
				return msg.channel.send(result, {files: [image]});
			}
		},
		"flip": {
			usage: "None",
			description: "Flips a coin",
			aliases: ["flip"],
			category: "gambling",
			process: function(msg) {
				let flip = ['heads <:coinH:402219464348925954>', 'tails <:coinT:402219471693021196>'].random();
				return msg.channel.send(`You flipped ${flip}`);
			}
		},
		"betflip": {
			usage: "<amount: Number|all> [h|t]",
			description: "Place a bet on a random flip for a chance of Discoins",
			aliases: ["betflip", "bf"],
			category: "gambling",
			process: async function(msg, suffix) {
				if (msg.channel.type == "dm") return msg.channel.send(lang.command.guildOnly(msg));
				let args = suffix.split(" ");
				let money = await utils.coinsManager.get(msg.author.id);
				if (!args[0]) return msg.channel.send(`${msg.author.username}, you need to provide a bet and a side to bet on`);
				if (args[0] == "h" || args[0] == "t") {
					let t = args[0];
					args[0] = args[1];
					args[1] = t;
				}
				let bet;
				if (args[0] == "all") {
					if (money == 0) return msg.channel.send(lang.external.money.insufficient(msg));
					bet = money;
				} else {
					bet = Math.floor(Number(args[0]));
					if (isNaN(bet)) return msg.channel.send(lang.input.invalid(msg, "bet"));
					if (bet < 1) return msg.channel.send(lang.input.money.small(msg, "bet", 1));
					if (bet > money) return msg.channel.send(lang.external.money.insufficient(msg));
				}
				let selfChosenSide = false;
				if (!args[1]) {
					args[1] = Math.random() < 0.5 ? "h" : "t";
					selfChosenSide = true;
				}
				if (args[1] != "h" && args[1] != "t") return msg.channel.send(`${msg.author.username}, that's not a valid side to bet on`);
				const cooldownInfo = {
					max: 60,
					min: 36,
					step: 3,
					regen: {
						amount: 1,
						time: 60*1000
					}
				};
				let winChance = await utils.cooldownManager(msg.author.id, "bf", cooldownInfo);
				const strings = {
					h: ["heads", "<:coinH:402219464348925954>"],
					t: ["tails", "<:coinT:402219471693021196>"]
				};
				if (Math.random() < winChance/100) {
					msg.channel.send(
						(!selfChosenSide ? "" : "You didn't choose a side, so I picked one for you: "+strings[args[1]][0]+".\n")+
						`You guessed ${strings[args[1]][0]}.\n${strings[args[1]][1]} I flipped ${strings[args[1]][0]}.\nYou guessed it! You got ${bet * 2} ${lang.emoji.discoin}`
					);
					utils.coinsManager.award(msg.author.id, bet);
				} else {
					let pick = args[1] == "h" ? "t" : "h";
					msg.channel.send(
						(!selfChosenSide ? "" : "You didn't choose a side, so I picked one for you: "+strings[args[1]][0]+".\n")+
						`You guessed ${strings[args[1]][0]}.\n${strings[pick][1]} I flipped ${strings[pick][0]}.\nSorry but you didn't guess correctly. Better luck next time.`
					);
					return utils.coinsManager.award(msg.author.id, -bet);
				}
			}
		},
		"coins": {
			usage: "[user]",
			description: "Returns the amount of Discoins you or another user has",
			aliases: ["coins", "$"],
			category: "gambling",
			process: async function(msg, suffix) {
				if (msg.channel.type == "dm") return msg.channel.send(lang.command.guildOnly(msg));
				let member = await msg.guild.findMember(msg, suffix, true);
				if (!member) return msg.channel.send(lang.input.invalid(msg, "user"));
				let money = await utils.coinsManager.get(member.id);
				let embed = new Discord.RichEmbed()
					.setAuthor(`Coins for ${member.displayTag}`)
					.setDescription(`${money} Discoins ${lang.emoji.discoin}`)
					.setColor("F8E71C")
				return msg.channel.send(utils.contentify(msg.channel, embed));
			}
		},
		"daily": {
			usage: "None",
			description: "A daily command that gives a random amount of Discoins",
			aliases: ["daily"],
			category: "gambling",
			process: async function(msg) {
				if (msg.channel.type == "dm") return msg.channel.send(lang.command.guildOnly(msg));
				let [row, donor] = await Promise.all([
					utils.sql.get("SELECT lastClaim FROM DailyCooldown WHERE userID = ?", msg.author.id),
					utils.sql.get("SELECT * FROM Premium WHERE userID =?", msg.author.id)
				]);
				if (!row || row.lastClaim+dailyCooldownTime < Date.now()) {
					let amount;
					if (donor) amount = Math.floor(Math.random() * (750 - 500) + 500)+1;
					else amount = Math.floor(Math.random() * (500 - 100) + 100)+1;
					let embed = new Discord.RichEmbed()
						.setDescription(lang.external.money.dailyClaimed(msg, amount, dailyCooldownHours+" hours"))
						.setColor("F8E71C")
					msg.channel.send(utils.contentify(msg.channel, embed));
					utils.coinsManager.award(msg.author.id, amount);
					utils.sql.all("REPLACE INTO DailyCooldown VALUES (?, ?)", [msg.author.id, Date.now()]);
				} else {
					let timeRemaining = (row.lastClaim-Date.now()+dailyCooldownTime).humanize("ms");
					msg.channel.send(lang.external.money.dailyCooldown(msg, timeRemaining));
				}
			}
		},
		"leaderboard": {
			usage: "[page]",
			description: "Gets the leaderboard for people with the most coins",
			aliases: ["leaderboard", "lb"],
			category: "gambling",
			process: async function(msg, suffix) {
				let pagesize = 10;
				let pagenum = 1;
				if (suffix) {
					let inputnum = Number(suffix);
					inputnum = Math.min(Math.max(inputnum, 1), 50);
					if (!isNaN(inputnum)) pagenum = inputnum;
				}
				let offset = (pagenum-1)*pagesize;
				let all = await utils.sql.all("SELECT userID, coins FROM money WHERE userID != ? ORDER BY coins DESC LIMIT ? OFFSET ?", [client.user.id, pagesize, offset]);
				let embed = new Discord.RichEmbed()
				.setAuthor("Leaderboard")
				.setDescription(all.map((row, index) => {
					let ranking = (index+offset+1)+". ";
					let user = client.users.get(row.userID);
					let displayTag = user ? user.tag : row.userID;
					let botTag = user && user.bot ? lang.emoji.bot : "";
					return `${ranking} ${displayTag} ${botTag} :: ${row.coins} ${lang.emoji.discoin}`;
				}))
				.setFooter(`Page ${pagenum}`)
				.setColor("F8E71C")
				return msg.channel.send(utils.contentify(msg.channel, embed));
			}
		},
		"give": {
			usage: "<amount: Number|all> <user>",
			description: "Gives discoins to a user from your account",
			aliases: ["give"],
			category: "gambling",
			process: async function(msg, suffix) {
				if (msg.channel.type == "dm") return msg.channel.send(lang.command.guildOnly(msg));
				let args = suffix.split(" ");
				if (!args[0]) return msg.channel.send(`${msg.author.username}, you have to provide an amount to give and then a user`);
				let usertxt = suffix.slice(args[0].length + 1);
				if (!usertxt) return msg.channel.send(lang.input.invalid(msg, "user"));
				let member = await msg.guild.findMember(msg, usertxt);
				if (!member) return msg.channel.send(lang.input.invalid(msg, "user"));
				if (member.id == msg.author.id) return msg.channel.send(`You can't give coins to yourself, silly`);
				let [authorCoins, memsettings, guildsettings] = await Promise.all([
					utils.coinsManager.get(msg.author.id),
					utils.sql.get("SELECT * FROM SettingsSelf WHERE keyID =? AND setting =?", [member.id, "gamblingalert"]),
					utils.sql.get("SELECT * FROM SettingsGuild WHERE keyID =? AND setting =?", [msg.guild.id, "gamblingalert"])
				]);
				let gift;
				if (args[0] == "all") {
					if (authorCoins == 0) return msg.channel.send(lang.external.money.insufficient(msg));
					gift = authorCoins;
				} else {
					gift = Math.floor(Number(args[0]));
					if (isNaN(gift)) return msg.channel.send(lang.input.invalid(msg, "gift"));
					if (gift < 1) return msg.channel.send(lang.input.money.small(msg, "gift", 1));
					if (gift > authorCoins) return msg.channel.send(lang.external.money.insufficient(msg));
				}
				utils.coinsManager.award(msg.author.id, -gift);
				utils.coinsManager.award(member.id, gift);
				let embed = new Discord.RichEmbed()
					.setDescription(`${String(msg.author)} has given ${gift} Discoins to ${String(member)}`)
					.setColor("F8E71C")
				msg.channel.send(utils.contentify(msg.channel, embed));
				if (memsettings && memsettings.value == 0) return;
				if (guildsettings && guildsettings.value == 0) {
					if (memsettings && memsettings.value == 1) return member.send(`${String(msg.author)} has given you ${gift} ${lang.emoji.discoin}`).catch(() => msg.channel.send(lang.permissionOtherDMBlocked()));
					else return;
				}
				return member.send(`${String(msg.author)} has given you ${gift} ${lang.emoji.discoin}`).catch(() => msg.channel.send(lang.permissionOtherDMBlocked()));
			}
		},
		"wheel": {
			usage: "[amount: Number|all]",
			description: "A Wheel of Fortune for a chance at making more Discoins",
			aliases: ["wheel", "wof"],
			category: "gambling",
			async process(msg, suffix) {
				if (msg.channel.type == "dm") return msg.channel.send(lang.command.guildOnly(msg));
				let permissions;
				if (msg.channel instanceof Discord.TextChannel) permissions = msg.channel.permissionsFor(client.user);
				if (!permissions.has("ATTACH_FILES")) return msg.channel.send(lang.permissionDeniedGeneric("attach files"));
				msg.channel.sendTyping();
				let [money, canv, triangle] = await Promise.all([
					utils.coinsManager.get(msg.author.id),
					imageStorage.get("wheel-canvas"),
					imageStorage.get("emoji-triangle")
				]);

				if (!suffix) return msg.channel.send(`${msg.author.username}, you need to provide an amount to spin the wheel with`);
				let amount;
				if (suffix == "all") {
					if (money == 0) return msg.channel.send(lang.external.money.insufficient(msg));
					amount = money;
				} else {
					amount = Math.floor(Number(suffix));
					if (isNaN(amount)) return msg.channel.send(lang.input.invalid(msg, "amount"));
					if (amount < 2) return msg.channel.send(lang.input.money.small(msg, "amount", 2));
					if (amount > money) return msg.channel.send(lang.external.money.insufficient(msg));
				}

				let choices = ["0.1", "0.2", "0.3", "0.5", "1.2", "1.5", "1.7", "2.4"];
				let choice = choices.random();
				let coords;
				if (choice == "0.1") coords = [-125, 185, 230];
				else if (choice == "0.2") coords = [-50, 185, 200];
				else if (choice == "0.3") coords = [-80, 210, 250];
				else if (choice == "0.5") coords = [80, 230, 250];
				else if (choice == "1.2") coords = [8, 253, 233];
				else if (choice == "1.5") coords = [14, 208, 187];
				else if (choice == "1.7") coords = [-18, 230, 187];
				else if (choice == "2.4") coords = [50, 245, 200];

				let canvas = canv.clone();
				let arrow = triangle.clone();

				let [rotation, x, y] = coords;

				arrow.rotate(rotation);

				canvas.composite(arrow, x, y, Jimp.BLEND_MULTIPLY);

				let buffer = await canvas.getBufferAsync(Jimp.MIME_PNG);
				let image = new Discord.Attachment(buffer, "wheel.png");
				await utils.coinsManager.award(msg.author.id, Math.round((amount * Number(choice)) - amount));
				return msg.channel.send(`${msg.author.tag} bet ${amount} discoins and got ${Math.round(amount * Number(choice))} back ${lang.emoji.discoin}`, {files: [image]});
			}
		}
	});
}
