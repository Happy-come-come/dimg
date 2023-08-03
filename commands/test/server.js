const { ApplicationCommandType, ApplicationCommandOptionType } = require('discord.js');
const {Client,Collection,GatewayIntentBits,Partials} = require('discord.js');
const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages], partials: [Partials.Channel]});
module.exports = {
    data: {
        name: 'server',
        description: 'サーバーの情報を表示します。',
        type: ApplicationCommandType.ChatInput
	},
    async execute(interaction) {
      const channel = interaction.channel;
      const server = interaction.guild; //コマンドを入力したサーバーを取得
      await interaction.reply({content: `サーバーの名前：${server.name}\nメンバー数：${server.memberCount}\nサーバーアイコン -> ${server.iconURL({ format: 'png' })}`, ephemeral: true});
      //await interaction.channel.send({ embeds :[ emb_te ]})
      //console.log(`server:${interaction.channel}`)
    },
};
