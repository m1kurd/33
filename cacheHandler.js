async function handleGuild(guild, sql) {

	await sql.all("REPLACE INTO Guilds (id, name, icon, owner_id, permissions, region, member_count) VALUES (?, ?, ?, ?, ?, ?, ?)", [guild.id, encodeURIComponent(guild.name), guild.icon, guild.owner_id, guild.permissions || 0, guild.region, guild.member_count])

	if (guild.members) {
		const batch = []

		for (const member of guild.members) {
			if (!member.user) continue
			batch.push(handleMember(member, member.user, guild.id))
		}

		await Promise.all(batch)
	}

	if (guild.channels) {
		const batch = []

		for (const channel of guild.channels) {
			batch.push(handleChannel(channel, guild.id))
		}

		await Promise.all(batch)
	}

	if (guild.roles) {
		const batch = []

		for (const role of guild.roles) {
			batch.push(sql.all("REPLACE INTO Roles (id, name, guild_id, permissions) VALUES (?, ?, ?, ?)", [role.id, encodeURIComponent(role.name), guild.id, role.permissions || 0]))
		}

		await Promise.all(batch)
	}
}

/**
 * @param {import("@amanda/discordtypings").ChannelData} channel
 * @param {string} guildID
 */
async function handleChannel(channel, guildID, sql) {
	sql.all("REPLACE INTO Channels (id, name, type, guild_id) VALUES (?, ?, ?, ?)", [channel.id, encodeURIComponent(channel.name), channel.type, guildID])

	if (channel.permission_overwrites) {
		const batch = []

		for (const overwrite of channel.permission_overwrites) {
			batch.push(sql.all("REPLACE INTO PermissionOverwrites (id, guild_id, channel_id, type, allow, deny) VALUES (?, ?, ?, ?, ?, ?)", [overwrite.id, guildID, channel.id, overwrite.type, overwrite.allow, overwrite.deny]))
		}

		await Promise.all(batch)
	}
}

/**
 * @param {string}
 * @param {import("@amanda/discordtypings").MemberData} member
 * @param {import("@amanda/discordtypings").UserData} user
 * @param {string} guildID
 */
async function handleMember(member, user, guildID, sql) {
	await sql.all("REPLACE INTO Members (id, nick, guild_id, joined_at) VALUES (?, ?, ?, ?)", [user.id, encodeURIComponent(member.nick || null), guildID, member.joined_at ? new Date(member.joined_at).getTime() : 0])
	if (member.roles) {
		for (const role of member.roles) {
			await sql.all("REPLACE INTO RoleRelations (id, user_id, guild_id) VALUES (?, ?, ?)", [role, user.id, guildID])
		}
	}
	await handleUser(user)
}

async function handleUser(user, sql) {
	if (!user) return
	await sql.all("REPLACE INTO Users (id, username, discriminator, bot, public_flags, avatar) VALUES (?, ?, ?, ?, ?, ?)", [user.id, encodeURIComponent(user.username), user.discriminator, user.bot ? 1 : 0, user.public_flags || 0, user.avatar || null])
}

module.exports = { handleGuild, handleChannel, handleMember, handleUser }
