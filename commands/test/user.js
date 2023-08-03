const { ApplicationCommandType, ApplicationCommandOptionType } = require('discord.js');
module.exports = {
    data: {
    name: "user",
    description: "ユーザー情報の表示",
    type: ApplicationCommandType.ChatInput,
    options: [{
        type: "USER",
        name: "user",
        description: "表示したいユーザー",
        required: true,
        type: ApplicationCommandOptionType.User,
	}]
	},
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        await interaction.reply({content: `ユーザーの名前：${user.username}\nユーザーID：${user.id}\nアバター -> ${user.avatarURL({ format: 'png' })}`, ephemeral: true});
    }
};
