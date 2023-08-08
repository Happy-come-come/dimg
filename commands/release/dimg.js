const {AttachmentBuilder,EmbedBuilder,ApplicationCommandType,ApplicationCommandOptionType} = require('discord.js');
const axios = require('axios');
require('dotenv').config();
const env = process.env;
const sharp = require('sharp');
const User_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0";
/*
READ ME!

環境変数に
Twitter_auth_token (graphqlのauth_token(多分共通だけど))
x_csrf_token_graphql (graphqlのx_csrf_token)
Twitter_Bearer_Token_graphql (graphqlのBearer_Token)
Pixiv_PHPSESSID (PixivのCookieの名前はPHPSESSID)
をセットしてください。全部ブラウザの通信のヘッダーとかから取れます。
*/

module.exports = {
	data: {
		name: "dimg",
		description: "画像チャンネルにポストします。",
		type: ApplicationCommandType.ChatInput,
		options: [{
			type: "STRING",
			name: "url",
			description: "ツイートかPixivのURL",
			required: true,
			type: ApplicationCommandOptionType.String
		},{
			type: "BOOLEAN",
			name: "post_to_gazou",
			description: "画像チャンネルに投稿するか",
			required: false,
			type: ApplicationCommandOptionType.Boolean
		},{
			type: "BOOLEAN",
			name: "page_all",
			description: "すべてのページ(最大4ページ(1～4ページ))をポスト",
			required: false,
			type: ApplicationCommandOptionType.Boolean
		},{
			type: "NUMBER",
			name: "win1",
			description: "ウィンドウ1指定の指定ページ(しなくてもOK)",
			required: false,
			type: ApplicationCommandOptionType.Number
		},{
			type: "NUMBER",
			name: "win2",
			description: "ウィンドウ2指定の指定ページ(しなくてもOK)",
			required: false,
			type: ApplicationCommandOptionType.Number
		},{
			type: "NUMBER",
			name: "win3",
			description: "ウィンドウ3指定の指定ページ(しなくてもOK)",
			required: false,
			type: ApplicationCommandOptionType.Number
		},{
			type: "NUMBER",
			name: "win4",
			description: "ウィンドウ4指定の指定ページ(しなくてもOK)",
			required: false,
			type: ApplicationCommandOptionType.Number
		},{
			type: "BOOLEAN",
			name: "dont_post_quoted",
			description: "引用元をポストしない",
			required: false,
			type: ApplicationCommandOptionType.Boolean
		},{
			type: "BOOLEAN",
			name: "use_graphql",
			description: "長いツイートをポストしたいとき等",
			required: false,
			type: ApplicationCommandOptionType.Boolean
		}],
	},
	async execute(interaction) {
		if(interaction.options.getString('url').match(/^(https?:\/\/.*twitter\.com\/.*\/.*\/[0-9]{15,}|https?:\/\/.*pixiv\.net\/artworks\/[0-9]{5,}(\/\?.*)?|https?:\/\/misskey.io\/notes\/[\w]*)(?!.*(\ |\<|\>|\*|\||\;|\[|\]|\{|\}|\"|\'|\(|\)|\$|\`|\\|\!).*).*$/)){
			//インタラクションを返しとかないとエラーが出るからなんかしらメッセージを送る。
			await interaction.reply({content: 'ちょっとまってな……', ephemeral: true});
			if (interaction.options.getBoolean('post_to_gazou') == true){
				if(interaction.guild.channels.cache.find((channel) => channel.name === "画像")){
					//インタラクションが発生したサーバーの「画像」というチャンネルのidを取得する。
					var channel = interaction.guild.channels.cache.find((channel) => channel.name === "画像").id;
				}else{
					//インタラクションが発生したチャンネルのidを取得する。
					var channel = interaction.channel.id;
				}
			}else{
				var channel = interaction.channel.id;
			}
			console.log(`\n${interaction.guild.name}:${interaction.user.username}: ${interaction.options.getString('url')}`);
			var select_media;
			if(interaction.options.getBoolean('page_all')){
				select_media = [0,1,2,3];
			}else{
				select_media = array_uniq(remove_null_from_array([if_exsit_return_text(interaction.options.getNumber('win1'),interaction.options.getNumber('win1')-1),if_exsit_return_text(interaction.options.getNumber('win2'),interaction.options.getNumber('win2')-1),if_exsit_return_text(interaction.options.getNumber('win3'),interaction.options.getNumber('win3')-1),if_exsit_return_text(interaction.options.getNumber('win4'),interaction.options.getNumber('win4')-1)]));
			}
			if(select_media.length == 0){
				select_media = [0];
			}
			var contents_for_post;
			try{
				switch(true){
					case /^https?:\/\/.*twitter\.com\/.*\/status\/[0-9]{1,}/.test(interaction.options.getString('url')):
						contents_for_post = await when_twitter(interaction.options.getString('url').match(/status\/[0-9]{1,}/)[0].split('/')[1],select_media,interaction.options.getBoolean('use_graphql'));
						if(interaction.options.getBoolean('dont_post_quoted') !== true && contents_for_post[contents_for_post.length - 1].quoted_tweet_data){
							//「when_twitter」関数に「1」を立てて引用ツイートかどうかを確かめている。
							let tmp_quoted_data = contents_for_post.pop().quoted_tweet_data;
							var tmp_quoted_embded = await when_twitter(tmp_quoted_data.id_str||tmp_quoted_data.result.rest_id,select_media,interaction.options.getBoolean('use_graphql'),1,tmp_quoted_data);
							if(tmp_quoted_embded && tmp_quoted_embded.length > 0){
								contents_for_post = contents_for_post.concat([{ content: '↓♻️引用元♻️↓'}],tmp_quoted_embded);
							}
						}
						break;
					case /^https?:\/\/.*pixiv\.net\/artworks\/[0-9]{1,}/.test(interaction.options.getString('url')):
						contents_for_post = await when_pixiv(interaction.options.getString('url').match(/artworks\/[0-9]{1,}/)[0].split('/')[1],select_media);
						break;
					case /^https?:\/\/misskey.io\/notes\/[\w]*/.test(interaction.options.getString('url')):
						contents_for_post = await when_misskey(interaction.options.getString('url').match(/notes\/[\w]*/)[0].split('/')[1],select_media);
						break;
					default:
						
						break;
				}
				for(target in contents_for_post){
					console.log(JSON.stringify(contents_for_post[target].embeds));
					//ここで送信している。
					await interaction.guild.channels.cache.get(channel).send(contents_for_post[target]);
				}
			}catch(err){
				console.error(err);
				await interaction.followUp({content:`んー、生成過程でエラーが出ちゃった。\ninput: ${interaction.options.getString('url')}`, ephemeral: true});
			}
		}else{
			//対応していないurlの場合これを送信する。
			await interaction.reply({ content: 'TwitterかPixivのURLを入れてくれ\n例:https ://twitter.com/xxxxxxx/0000000000000000000\n例:https ://', ephemeral: true})
		}
		
		
		async function when_twitter(Tweet_ID,select_pages = [0],use_graphQL,quoted_tweet_mode = 0,quoted_tweet_data = undefined,dont_convert_image_to_jpg){
			var response_data;
			var tweet_user_data_json;
			var tweet_tweet_data_json;
			var twitter_user_data = {};
			var twitter_tweet_data = {};
			//引用ツイート検索モードの処理。
			if(quoted_tweet_mode == "1"){
				response_data = quoted_tweet_data;
			}else{
				response_data = await get_Tweet_data(Tweet_ID);
			}
			if(response_data.APIsource == "graphql"){
				var twitter_qraphql_json;
				if(quoted_tweet_mode == "1"){
					twitter_qraphql_json = response_data;
				}else{
					twitter_qraphql_json = response_data.entries[response_data.entries.findIndex((tmp) => tmp.entryId == `tweet-${Tweet_ID}`)].content.itemContent.tweet_results;
				}
				//画像だけのツイートの場合と文字を含むツイートの場合でオブジェクトの構造が違うので対応する。
				tweet_user_data_json = twitter_qraphql_json.result.core?.user_results.result || twitter_qraphql_json.result.tweet.core.user_results.result;
				tweet_tweet_data_json = twitter_qraphql_json.result.legacy || twitter_qraphql_json.result.tweet.legacy;
				twitter_user_data.ID = tweet_user_data_json.rest_id;
				twitter_user_data.screen_name = tweet_user_data_json.legacy.screen_name;
				twitter_user_data.name = tweet_user_data_json.legacy.name;
				twitter_user_data.profile_image = tweet_user_data_json.legacy.profile_image_url_https.replace('_normal.','.');
				twitter_user_data.urls = tweet_user_data_json.legacy.entities;
				twitter_tweet_data.hashtags = get_only_particular_key_value(tweet_tweet_data_json.entities,"hashtags",[]);
				twitter_tweet_data.user_mentions = get_only_particular_key_value(tweet_tweet_data_json.entities,"user_mentions",[]);
				twitter_tweet_data.symbols = get_only_particular_key_value(tweet_tweet_data_json.entities,"symbols",[]);
			}else if(response_data.APIsource == "1_1"){
				var twitter_1_1_json = response_data;
				tweet_user_data_json = twitter_1_1_json.user;
				tweet_tweet_data_json = twitter_1_1_json;
				twitter_user_data.ID = tweet_user_data_json.id_str;
				twitter_user_data.screen_name = tweet_user_data_json.screen_name;
				twitter_user_data.name = tweet_user_data_json.name;
				twitter_user_data.profile_image = tweet_user_data_json.profile_image_url_https.replace('_normal.','.');
				twitter_user_data.urls = tweet_user_data_json.entities;
				twitter_tweet_data.hashtags = get_only_particular_key_value(tweet_tweet_data_json.entities,"hashtags",[]);
				twitter_tweet_data.user_mentions = get_only_particular_key_value(tweet_tweet_data_json.entities,"user_mentions",[]);
				twitter_tweet_data.symbols = get_only_particular_key_value(tweet_tweet_data_json.entities,"symbols",[]);
			}
			
			try{
				twitter_user_data.pixiv_url = await find_pixiv_url(twitter_user_data.urls);
			}catch(error){
				console.log("pixivのURLの取得に失敗しました。");
				console.log(error);
			}
			twitter_tweet_data.full_text = replace_null_to_something(tweet_tweet_data_json.full_text);
			twitter_tweet_data.extended_entities = tweet_tweet_data_json.extended_entities;
			twitter_tweet_data.retweet_count = tweet_tweet_data_json.retweet_count;
			twitter_tweet_data.favorite_count = tweet_tweet_data_json.favorite_count;
			twitter_tweet_data.id = tweet_tweet_data_json.id_str;
			twitter_tweet_data.created_at = new Date(tweet_tweet_data_json.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
			twitter_tweet_data.urls = tweet_tweet_data_json.entities.urls;
			twitter_tweet_data.media = make_media_list(twitter_tweet_data.extended_entities,select_pages);
			try{
				//文が長すぎるとエラーになるので一定の長さで切る。
				//普通のツイートではそんなことありえないが、Blueでは長いツイートが可能なのでそれに対応している。
				let note_tweet = twitter_qraphql_json.result.note_tweet?.note_tweet_results.result||twitter_qraphql_json.result.tweet.note_tweet.note_tweet_results.result;
				twitter_tweet_data.full_text = str_max_length(note_tweet.text,7000);
				twitter_tweet_data.urls = note_tweet.entity_set.urls;
				twitter_tweet_data.hashtags = get_only_particular_key_value(note_tweet.entity_set,"hashtags",[]);
				twitter_tweet_data.user_mentions = get_only_particular_key_value(note_tweet.entity_set,"user_mentions",[]);
				twitter_tweet_data.symbols = get_only_particular_key_value(note_tweet.entity_set,"symbols",[]);
			}catch{}
			function countSurrogatePairs(str){
				return Array.from(str).filter(char => char.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/)).length;
			}
			let combined = [].concat(
				twitter_tweet_data.hashtags.map(tag => ({
					type: 'hashtag',
					indices: tag.indices,
					text: tag.text
				})),
				twitter_tweet_data.user_mentions.map(mention => ({
					type: 'mention',
					indices: mention.indices,
					text: mention.screen_name
				})),
				twitter_tweet_data.symbols.map(symbol => ({
					type: 'symbol',
					indices: symbol.indices,
					text: symbol.text
				}))
			);


			// combinedをindicesの順にソート
			combined.sort((a, b) => b.indices[0] - a.indices[0]);
			let transformedText = twitter_tweet_data.full_text;

			combined.forEach(item => {
				let start = item.indices[0];
				let end = item.indices[1];

				// サロゲートペアの数をカウントして調整
				const adjustment = countSurrogatePairs(transformedText.slice(0, end));
				start += adjustment;
				end += adjustment;

				let replacement = '';
				switch(item.type){
					case 'hashtag':
						replacement = `[#${item.text}](https://twitter.com/hashtag/${item.text})`;
						break;
					case 'mention':
						replacement = `[@${item.text}](https://twitter.com/${item.text})`;
						break;
					case 'symbol':
						replacement = `[$${item.text}](https://twitter.com/search?q=%24${item.text}&src=cashtag_click)`;
						break;
				}
				transformedText = transformedText.slice(0, start) + replacement + transformedText.slice(end);
			});
			twitter_tweet_data.full_text = str_max_length(transformedText,7000);
			try{
				//複数メディアをつけるオプションのときに動画があるとうまくいかないので。
				if(select_pages.length > 1 && ! twitter_tweet_data.media.every(v => v.media_type == "photo")){return}
			}catch{}
			//embedsの作成。
			var to_send_embeds = await make_embeds(twitter_user_data,twitter_tweet_data,select_pages);
			try{
				//添付する画像のダウンロード。
				if(twitter_tweet_data.media[0].media_type == "photo"){
					var post_images = await download_images_twitter(get_only_particular_key_value(twitter_tweet_data.media,'url'),dont_convert_image_to_jpg);
					post_images = await check_attachment_size_sum(post_images);
				}
			}catch{}
			var return_object = [{"embeds":to_send_embeds}];
			try{
				if(post_images !== undefined){
					return_object[0].files = post_images;
				}
			}catch{}
			try{
				//メディアが動画だったときの処理。
				//embedsと一緒にリンクを送信することもできるが、そうするとプレビューしてくれないのでembdesを送ったあとにリンクだけを送信する。
				if(twitter_tweet_data.media[0].media_type.match(/(video|animated_gif)/)){
					return_object.push({"content": twitter_tweet_data.media[0].video_url});
				}
			}catch{}
			if(quoted_tweet_mode == 0 && (twitter_qraphql_json?.result.quoted_status_result||twitter_1_1_json?.quoted_status)){
				let tmp_quoted_data = twitter_qraphql_json?.result.quoted_status_result||twitter_1_1_json?.quoted_status;
				tmp_quoted_data.APIsource = response_data.APIsource
				return_object.push({"quoted_tweet_data": tmp_quoted_data})
				return return_object
			}else{
				return return_object
			}
			
			async function get_Tweet_data(ID){
				const requestFunctions = [
					async () => {
						let data = await send_request(new requestObject_twitter_graphql(ID))
						data = data.data.threaded_conversation_with_injections_v2.instructions[0];
						data.APIsource = 'graphql';
						return data;
					},
					async () => {
						let data = await send_request(new requestObject_twitter_graphql2(ID))
						data = data.data.threaded_conversation_with_injections_v2.instructions[0];
						data.APIsource = 'graphql';
						return data;
					},
					async () => {
						let data = await send_request(new requestObject_twitter_1_1(ID));
						data[0].APIsource = '1_1';
						return data[0];
					}
				];
				if(use_graphQL === true){
					var base = 0;
				}else{
					var base = 2;
				}
				for(let i=base; i<requestFunctions.length; i++){
					try {
						let response_data = await requestFunctions[i]();
						// リクエストが成功したらループを抜けます。
						return response_data;
					} catch (error) {
						// リクエストが失敗したら次の関数を試します。
						console.error(`Function ${i} failed: `, error);
					}
				}
			}
			async function make_embeds(user_data,tweet_data){
				var Dimg_twitter_Embed = [];
				try{
					Dimg_twitter_Embed[0] = new EmbedBuilder()
					.setColor(0xFFDDDD)
					.setTitle('Tweet')
					.setURL(`https://twitter.com/${user_data.screen_name}/status/${tweet_data.id}`)
					.setAuthor({ name: `${user_data.name} (@${user_data.screen_name})`, iconURL: user_data.profile_image, url: `https://twitter.com/${user_data.screen_name}` })
					.setDescription(replace_null_to_something(replace_t_co_to_original_url(tweet_data.full_text,tweet_data.urls,tweet_data.media)))
					.setThumbnail('https://pbs.twimg.com/profile_images/1488548719062654976/u6qfBBkF_400x400.jpg')
					.addFields({ name: '各種Link:link:', value: "[ツイートへ](https://twitter.com/"+ user_data.ID + "/status/" + tweet_data.id + ")\n[Twitter ID: " + user_data.ID + "](https://twitter.com/intent/user?user_id=" + user_data.ID +")" + if_exsit_return_text(tweet_data.media[0],`\n[画像へ](${image_url_to_original(tweet_data.media[0].url)})`) + if_exsit_return_text(user_data.pixiv_url,`\n[Pixivへ](${user_data.pixiv_url})`)})
					.addFields({ name: 'エンゲージメント', value: `リツイート ${round_half_up(tweet_data.retweet_count,10000,2,"万")}:recycle:    いいね ${round_half_up(tweet_data.favorite_count,10000,2,"万")}:heart:` })
					.addFields({ name: 'アップロード日', value: tweet_data.created_at })
					.setImage(`attachment://${tweet_data.media[0].url.split("/").pop()}`)
				}catch{
					Dimg_twitter_Embed[0] = new EmbedBuilder()
					.setColor(0xFFDDDD)
					.setTitle('Tweet')
					.setURL(`https://twitter.com/${user_data.screen_name}/status/${tweet_data.id}`)
					.setAuthor({ name: `${user_data.name} (@${user_data.screen_name})`, iconURL: user_data.profile_image, url: `https://twitter.com/${user_data.screen_name}` })
					.setDescription(replace_null_to_something(replace_t_co_to_original_url(tweet_data.full_text,tweet_data.urls,tweet_data.media)))
					.setThumbnail('https://pbs.twimg.com/profile_images/1488548719062654976/u6qfBBkF_400x400.jpg')
					.addFields({ name: '各種Link:link:', value: "[ツイートへ](https://twitter.com/"+ user_data.ID + "/status/" + tweet_data.id + ")\n[Twitter ID: " + user_data.ID + "](https://twitter.com/intent/user?user_id=" + user_data.ID +")\n"})
					.addFields({ name: 'エンゲージメント', value: `リツイート ${round_half_up(tweet_data.retweet_count,10000,2,"万")}:recycle:    いいね ${round_half_up(tweet_data.favorite_count,10000,2,"万")}:heart:` })
					.addFields({ name: 'アップロード日', value: tweet_data.created_at })
				}
				try{
					for(var i=1;i<tweet_data.media.length;i++){
						//URLを同じにすることでembdesに画像を複数枚つけることができる(最大4枚)。
						Dimg_twitter_Embed[i] = new EmbedBuilder()
							.setURL(`https://twitter.com/${user_data.screen_name}/status/${tweet_data.id}`)
							.setImage(`attachment://${tweet_data.media[i].url.split("/").pop()}`)
					}
				}catch{}
				return Dimg_twitter_Embed;
			}
			async function find_pixiv_url(urls){
				//プロフィールからPixivのURLを探す。
				//関数の名前がややこしいがこちらが実際にPixivのURLを探している。
				//PixivのURLはなんでこんなに多いんだ……
				const Pixiv_url_regex = /^https?:\/\/(((www|touch)\.)?pixiv\.(net\/([a-z]{2}\/)?((member(_illust)?\.php\?id\=|(users|u)\/)[0-9]*)|me\/.*))/;
				const Fanbox_url_regex = /^https?:(\/\/www\.pixiv\.net\/fanbox\/creator\/[0-9]*|\/\/.*\.fanbox\.cc\/?)/;
				return new Promise(async function(resolve,reject){
					var Pixiv_url;
					const urls_in_description = get_only_particular_key_value(urls,'description.urls.url',[]);
					const urls_in_description_expanded = get_only_particular_key_value(urls,'description.urls.expanded_url',[]);
					const urls_in_url_place = get_only_particular_key_value(urls,'url.urls.url',[]);
					const urls_in_url_place_expanded = get_only_particular_key_value(urls,'url.urls.expanded_url',[]);
					var tmp_urls = urls_in_description.concat(urls_in_description_expanded,urls_in_url_place,urls_in_url_place_expanded).filter(item => !/^https?:\/\/t\.co\//.test(item));
					if(tmp_urls.length > 0){
						Pixiv_url = await find_pixiv_link_from_profile_urls(tmp_urls);
						if(Pixiv_url === undefined || Pixiv_url === null || Pixiv_url === false){
							//短縮リンクでURLを貼っている馬鹿者のための処理。
							//短縮リンクのリダイレクト先がわからないためそのままアクセスしてしまうと危険なので、短縮リンクのリダイレクト先がわかるサービスのAPIを叩いている。
							tmp_urls = await expand_shortening_link(tmp_urls);
							Pixiv_url = await find_pixiv_link_from_profile_urls(tmp_urls);
						}
						if(Pixiv_url_regex.test(Pixiv_url)){
							return resolve(Pixiv_url.replace(/^https?/,'https').replace(/(\/|\\)$/,''));
						}
					}
					return reject(undefined);
				});
			}
			function image_url_to_original(image_url){
				//apiから帰ってくるURLをそのまま開くと小さい画像になってしまうので最大サイズの画像をダウンロードできるようにする。
				if(typeof image_url !== "undefined"){
					var extension = image_url.split(".").pop();
					return `${image_url.replace(`.${extension}`,"")}?format=${extension}&name=orig`
				}
			}
			function replace_t_co_to_original_url(full_text,urls,media_urls){
				//ツイート内のt.coで短縮されたリンクをもとにのリンクにもどす。
				try{
					if(typeof full_text !== "undefined"){
						full_text = full_text.replace(/\&amp\;/g,'&');
						full_text = full_text.replace(/\&gt\;/g,'\\>');
						full_text = full_text.replace(/\&lt\;/g,'\\<');
						if(typeof urls !== "undefined"){
							for(var i=0;i<=urls.length-1;i++){
								full_text = full_text.replace(urls[i].url,urls[i].expanded_url);
							}
						}
						//メディアがくっついてるツイートは末尾にメディアのURLが付随しているためそれを消す。
						if(typeof media_urls !== "undefined"){
							for(var i=0;i<=media_urls.length-1;i++){
								full_text = full_text.replace(media_urls[i].tco_url,"");
							}
						}
					}
				}catch{}
				return full_text;
			}
			function make_media_list(extended_entities,select_pages){
				var tmp_arr = [];
				var tmp_object = {};
				if(typeof extended_entities !== "undefined"){
					var j = 0;
					for(target in select_pages){
						try{
							if(extended_entities.media.length > select_pages[target]){
								tmp_object = {};
								tmp_object.media_type = extended_entities.media[select_pages[target]].type;
								tmp_object.tco_url = extended_entities.media[select_pages[target]].url
								if(tmp_object.media_type == "animated_gif" || tmp_object.media_type == "video"){
									//動画はTwitterのサーバー上に複数の解像度のものがあるためその中で最も大きいものを選択する。
									tmp_object.video_url = extended_entities.media[select_pages[target]].video_info.variants.filter(function(obj){return obj.content_type == "video/mp4"}).reduce((a, b) => a.bitrate > b.bitrate ? a:b).url.split('?')[0];
								}else if(tmp_object.media_type == "photo"){
									tmp_object.url = extended_entities.media[select_pages[target]].media_url_https;
								}
								tmp_arr[j] = tmp_object;
								j++;
							}
						}catch{}
					}
					return tmp_arr;
				}
				return undefined;
			}

			async function download_images_twitter(image_urls,dont_convert_image_to_jpg){
				//画像をダウンロードするための関数。
				return new Promise(async function(resolve,reject){
					if(image_urls && image_urls.length>=1){
						var return_images = [];
						var download_image;
						for(target in image_urls){
							download_image = await send_request(new requestObject_binary_data(image_url_to_original(image_urls[target])));
							download_image = await make_image_size_under_upper_limit(download_image,dont_convert_image_to_jpg);
							//discord.jsで扱いやすいいい感じにしてくれる。
							return_images[target] = new AttachmentBuilder(download_image, { name: image_urls[target].split("/").pop() });
						}
						console.log(return_images)
						return resolve(return_images);
					}else{
						return reject(undefined);
					}
				});
			}
		}
		
		async function when_pixiv(Pixiv_art_id,select_pages = [0],dont_convert_image_to_jpg){
			//https://www.pixiv.net/ajax/user/1/illusts?ids[]=${Pixiv_art_id}
			//「user」のあとの「1」は0以外の正の整数で数がでかすぎなければなんでもいい。
			//このAPIにアクセスするとユーザーのアイコンのURLと名前が取得できる。
			//余談だが、「pixiv事務局」というPixiv公式アカウントのIDは「11」なのだが、それより若い番号の現存するユーザーは「10」である。
			var pixiv_user_data_json = await send_request(new requestObject_pixiv(`https://www.pixiv.net/ajax/user/1/illusts?ids[]=${Pixiv_art_id}`));
			pixiv_user_data_json = pixiv_user_data_json.body;
			var pixiv_illust_data_json = await send_request(new requestObject_pixiv(`https://www.pixiv.net/ajax/illust/${Pixiv_art_id}`));
			pixiv_illust_data_json = pixiv_illust_data_json.body;
			var pixiv_author_data = {};
			var pixiv_illust_data = {};
			pixiv_author_data.name = pixiv_user_data_json[Pixiv_art_id].userName;
			pixiv_author_data.id = pixiv_user_data_json[Pixiv_art_id].userId;
			pixiv_author_data.profileImageUrl = pixiv_user_data_json[Pixiv_art_id].profileImageUrl;
			pixiv_author_data.url = `https://www.pixiv.net/users/${pixiv_author_data.id}`;
			var tmp = await send_request(new requestObject_pixiv(`https://www.pixiv.net/users/${pixiv_author_data.id}`));
			try{
				//プロフィールにTwitterのリンクがあればしゅとくする。
				pixiv_author_data.twitter = tmp.match(/\"social\":\{\"twitter\":\{\"url\":\"https?:\/\/twitter\.com\/.*\"\}\},/)[0].match(/https?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/)[0];
			}catch{}
			pixiv_illust_data.title = pixiv_illust_data_json.title;
			pixiv_illust_data.url = pixiv_illust_data_json.urls.original;
			pixiv_illust_data.pages = pixiv_illust_data_json.pageCount;
			try{
				//キャプションが長すぎるとエラーになるので適当な長さに切る。
				pixiv_illust_data.caption = str_max_length(pixiv_illust_data_json.extraData.meta.twitter.description.replace(/\r/g,''),1500);
			}catch{}
			pixiv_illust_data.tags = get_only_particular_key_value(pixiv_illust_data_json.tags.tags,"tag");
			pixiv_illust_data.created_at = new Date(pixiv_illust_data_json.createDate).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
			pixiv_illust_data.is_ai = pixiv_illust_data_json.aiType;
			var post_image_list = make_media_list(pixiv_illust_data.url,select_pages,pixiv_illust_data.pages);
			var pixiv_post_images
			if(post_image_list[0].match(/.*ugoira.*/)){
				return [{content: 'うごイラには対応していないんだ。すまんな。'}];
			}else{
				var pixiv_post_images = await download_images([...post_image_list,pixiv_author_data.profileImageUrl],dont_convert_image_to_jpg);
				pixiv_post_images = await check_attachment_size_sum(pixiv_post_images);
			}
			var Pixiv_post_embeds = await make_embeds(pixiv_author_data,pixiv_illust_data,post_image_list,Pixiv_art_id);
			return [{"embeds": Pixiv_post_embeds,"files": pixiv_post_images}];
			//console.log(pixiv_illust_data_json)
			async function make_embeds(author_data,illust_data,post_image_list,Pixiv_art_id){
				var return_embeds = [];
				return_embeds[0] = new EmbedBuilder()
					.setColor(0xFFDDDD)
					.setTitle('Pixiv')
					.setURL(`https://www.pixiv.net/artworks/${Pixiv_art_id}`)
					.setAuthor({ name: author_data.name, iconURL: `attachment://${author_data.profileImageUrl.split("/").pop()}`, url: `https://www.pixiv.net/users/${author_data.id}` })
					.setDescription(illust_data.title)
					.setThumbnail('https://s.pximg.net/common/images/apple-touch-icon.png')
					.addFields({ name: 'Caption', value: illust_data.caption })
					.addFields({ name: 'tags', value: make_tag(illust_data.tags) })
					.addFields({ name: 'アップロード日', value: illust_data.created_at })
					.addFields({ name: 'twitter:link:', value: replace_null_to_something(author_data.twitter,"なし")})
					.setImage(`attachment://${post_image_list[0].split("/").pop()}`)
				for(var i=1;i<post_image_list.length;i++){
					return_embeds[i] = new EmbedBuilder()
						.setURL(`https://www.pixiv.net/artworks/${Pixiv_art_id}`)
						.setImage(`attachment://${post_image_list[i].split("/").pop()}`)
				}
				return return_embeds;
			}
			function make_tag(tags){
				if(tags === null || tags === undefined || tags === ""){
					return "なし";
				}else{
					//aiTypeという値がAPIには設定されていて、AI生成とそうでないものが分けられていなかったときの作品は「0」、AI生成でない作品は「1」、AI生成の作品は「2」というなんともわかりにくい数字が割り当てられている。
					if(pixiv_illust_data.is_ai == 2){
						return `AI生成 #${tags.join(' #')}`;
					}else{
						return `#${tags.join(' #')}`;
					}
				}
			}
			function make_media_list(url,select_pages,max_page){
				list_tmp = [];
				var i=0;
				for(target in select_pages){
					if(!(select_pages[target] >= max_page)){
						//APIから取れるURLは「_p0」つまり一番最初のURLだけなので別のページを取りたいときはそれぞれの数字に書き換える。
						list_tmp[i] = url.replace(/_p[0-9]/,`_p${select_pages[target]}`);
						i++;
					}
				}
				return list_tmp;
			}
		}
		async function when_misskey(Note_ID,select_pages = [0]){
			const misskey_note_data_json = await send_request(new requestObject_misskey('https://misskey.io/api/notes/show',JSON.stringify({"noteId": Note_ID})));
			var note_data = {};
			var user_data = {};
			user_data.id = misskey_note_data_json.user.id;
			user_data.name =  misskey_note_data_json.user.name;
			user_data.username =  misskey_note_data_json.user.username;
			user_data.host = misskey_note_data_json.user.host;
			const misskey_user_data_json = await send_request(new requestObject_misskey('https://misskey.io/api/users/show',JSON.stringify({"username": user_data.username,"host": user_data.host})));
			user_data.urls = await get_only_particular_key_value(misskey_user_data_json.fields,"value",[]).concat(replace_null_to_something(misskey_user_data_json.description.match(/https?:\/\/([\w-]+\.)+[\w-]+(\/[\w\-\ .\/?%&=]*)?/g),[]));
			user_data.urls = user_data.urls.concat(await expand_shortening_link(user_data.urls));
			user_data.avatarUrl = misskey_user_data_json.avatarUrl;
			try{
				user_data.twitter = user_data.urls.filter(function(tmp){return tmp.match(/https:\/\/twitter.com\/[\w_]*/)})[0]?.match(/https:\/\/twitter.com\/[\w_]*/)[0];
			}catch{
				user_data.twitter = undefined;
			}
			user_data.pixiv = await find_pixiv_link_from_profile_urls(user_data.urls)
			note_data.text = misskey_note_data_json.text;
			note_data.files = misskey_note_data_json.files;
			note_data.tags = replace_null_to_something(misskey_note_data_json.tags,[]);
			note_data.created_at = new Date(misskey_note_data_json.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
			note_data.tags.forEach(target =>{
				note_data.text = note_data.text.replace(new RegExp(`#${target}(?=(\\s|$))`, 'g'), `[#${target}](https://misskey.io/tags/${target})`);
			});
			note_data.images_list = await make_media_list(note_data.files,select_pages,note_data.files.length);
			note_data.images_list.push({"url": user_data.avatarUrl.replace(/\&avatar\=[0-9]/,''), "name": "usericon.png"});
			note_data.images_list = note_data.images_list.filter(item => !item.url.endsWith(".mp4"));
			note_data.images = await download_images_misskey(note_data.images_list);
			note_data.images = await check_attachment_size_sum(note_data.images);
			var return_embeds = await make_embeds(user_data,note_data,note_data.images_list);
			return [{"embeds": return_embeds,"files": note_data.images}];
			async function make_embeds(author_data,note_data,post_image_list){
				var return_embeds = [];
				return_embeds[0] = new EmbedBuilder()
					.setColor(0xFFDDDD)
					.setTitle('Misskey.io')
					.setURL(`https://misskey.io/notes/${Note_ID}`)
					.setAuthor({ name: `${author_data.name} (@${author_data.username})`, iconURL: `attachment://usericon.png`, url: `https://misskey.io/@${author_data.username}` + if_exsit_return_text(author_data.host,`@${author_data.host}`)})
					.setDescription(note_data.text)
					.setThumbnail('https://s3.arkjp.net/misskey/webpublic-0c66b1ca-b8c0-4eaa-9827-47674f4a1580.png')
					.addFields({ name: 'アップロード日', value: note_data.created_at })
					.addFields({ name: '各種リンク:link:', value: if_exsit_return_text(author_data.twitter,`[Twitter](${author_data.twitter})\n`) + if_exsit_return_text(author_data.pixiv,`[Pixiv](${author_data.pixiv})`) + " "})
				if(post_image_list.length >= 2){
					return_embeds[0].setImage(`attachment://${post_image_list[0].name}`)
				}
				for(var i=1;i<post_image_list.length-1;i++){
					return_embeds[i] = new EmbedBuilder()
						.setURL(`https://misskey.io/notes/${Note_ID}`)
						.setImage(`attachment://${post_image_list[i].name}`)
				}
				return return_embeds;
			}
			function make_media_list(url,select_pages,max_page){
				list_tmp = [];
				for(target in select_pages){
					if(!(select_pages[target] >= max_page)){
						list_tmp[target] = {"url": url[select_pages[target]].url, "name": Note_ID + "_" + select_pages[target] + url[select_pages[target]].url.match(/\..{3,4}$/)};
					}
				}
				return list_tmp;
			}
			async function download_images_misskey(image_urls,dont_convert_image_to_jpg){
				return new Promise(async function(resolve){
					var return_images = [];
					var download_image;
					for(target in image_urls){
						download_image = await send_request(new requestObject_binary_data(image_urls[target].url));
						download_image = await make_image_size_under_upper_limit(download_image,dont_convert_image_to_jpg);
						return_images[target] = new AttachmentBuilder(download_image, { name: image_urls[target].name });
					}
					resolve(return_images);
				});
			}
		}


		//汎用関数
		async function find_pixiv_link_from_profile_urls(urls_in_profile){
			const Pixiv_url_regex = /^https?:\/\/(((www|touch)\.)?pixiv\.(net\/([a-z]{2}\/)?((member(_illust)?\.php\?id\=|(users|u)\/)[0-9]*)|me\/.*))/;
			const Fanbox_url_regex = /^https?:(\/\/www\.pixiv\.net\/fanbox\/creator\/[0-9]*|\/\/.*\.fanbox\.cc\/?)/;
			return new Promise(async function(resolve,reject){
				var tmp_pixiv_url;
				//PixivのURLがそのままある場合はそれを返す(みんなそうであれ)。
				tmp_pixiv_url = findMatch_from_array(urls_in_profile,Pixiv_url_regex,true);
				if (tmp_pixiv_url !== undefined) return resolve(tmp_pixiv_url);
				//fanboxはPixivのサービスなのでfanboxのURLがあれば確実にPixivのURLを取得することができる。
				if(findMatch_from_array(urls_in_profile,Fanbox_url_regex) !== undefined){
					tmp_pixiv_url = await when_fanbox(findMatch_from_array(urls_in_profile,Fanbox_url_regex,true));
					if (Pixiv_url_regex.test(tmp_pixiv_url)){
						return resolve(tmp_pixiv_url);
					}
				}else{
					var get_url_promise_list = [];
					//ここからはPixivのURLを直接書いていない愚か者のための処理。
					//リンクまとめサイトやほかのファンサイトないからPixivのURLを探す。
					urls_in_profile.forEach(target=>{
						switch(true){
							//|(html\.co\.jp)
							case /^https?:\/\/((skeb\.jp\/\@.*)|(fantia\.jp\/fanclubs\/[0-9].*)|(.*\.booth\.pm)|(.*linktr\.ee)|(.*profcard\.info)|(.*lit\.link)|(potofu\.me)|(.*\.carrd\.co)|(.*\.tumblr\.com$))\/?/.test(target):
								get_url_promise_list.push(new Promise(
									async function(resolve,reject){
										try{
											return resolve(await when_general(target,'request_key=bd919da0'));
										}catch(error){
											return reject(error);
										}
									}
								));
								break;
							case /^https?:\/\/.*\.creatorlink\.net(\/.*)?/.test(target):
								get_url_promise_list.push(new Promise(
									async function(resolve,reject){
										try{
											return resolve(await when_general(`${target.match(/^https?:\/\/.*\.creatorlink\.net/)[0]}\/Contact`));
										}catch(error){
											return reject(error);
										}
									}
								));
								break;
							case /^https?:\/\/sketch\.pixiv\.net\//.test(target):
								get_url_promise_list.push(new Promise(
									async function(resolve,reject){
										try{
											return resolve(await when_pixiv_sketch(target));
										}catch(error){
											return reject(error);
										}
									}
								));
								break;
							default:
								break;
						}
					});
					if(get_url_promise_list.length > 0){
						await Promise.any(get_url_promise_list).then((value) => {tmp_pixiv_url = value}).catch((error) => {console.error(`Pixivのリンクを見つけられませんでした: ${error}`);tmp_pixiv_url = undefined});
						return resolve(tmp_pixiv_url);
					}
				}
				return resolve(undefined);
				async function when_general(target_url,addtional_cookie){
					return new Promise(async function(resolve,reject){
						const response_data = await send_request(new requestObject(target_url,addtional_cookie));
						//便利なapiがないサイトはHTMLを要求し、それをバラバラにして探す。
						//このための正規表現
						var response_data_urls = response_data.split('"').filter(function(data_str){return data_str.match(/^https?:(\/\/(((www|touch)\.)?pixiv\.(net\/([a-z]{2}\/)?((member(_illust)?\.php\?id\=|(users|u|fanbox\/creator)\/)[0-9].*)|me\/.*))|.*\.fanbox\.cc\/?)$/)});
						if(response_data_urls.find(function(element){return element.match(Pixiv_url_regex)}) !== undefined){
							return resolve(response_data_urls.find(function(element){return element.match(Pixiv_url_regex)}));
						}else if(response_data_urls.find(function(element){return element.match(Fanbox_url_regex)}) !== undefined){
							//これらのサイトからPixivのリンクが見つかればそれが一番いいが、fanboxのURLがあった場合確実にPixivのURLが取れるのでそのための処理。
							return resolve(await when_fanbox(response_data_urls.find(function(element){return element.match(Fanbox_url_regex)})));
						}else{
							return reject(undefined);
						}
					});
				}
				async function when_pixiv_sketch(target_url){
					return new Promise(async function(resolve,reject){
						const response_data = await send_request(new requestObject(target_url));
						var User_id = response_data.split(',').filter(function(data_str){return data_str.match(/\\"pixiv_user_id\\":\\"[0-9]*\\"/)});
						if(User_id){
							return resolve("https://www.pixiv.net/users/" + User_id[0].split(/\"|\\/)[6]);
						}else{
							return reject(undefined);
						}
					});
				}
				async function when_fanbox(fanbox_url){
					if(fanbox_url.match(/^https:\/\/www\.fanbox\.cc\/?$/)) return undefined;
					return new Promise(async function(resolve){
						//この形式のfanboxのURLだとcreatorの後のIDがPixivのIDと同じなのでURLを書き換えるだけでOK。
						if(fanbox_url.match(/^https?:\/\/www\.pixiv\.net\/fanbox\/creator\/[0-9]*/)){
							return resolve(fanbox_url.replace('fanbox/creator', 'users'));
						}else{
							//そうでない場合APIを叩きURLを取得する。
							const fanbox_response = await send_request(new requestObject_fanbox(`https://api.fanbox.cc/creator.get?creatorId=${fanbox_url.replace(/(https?:\/\/|\.fanbox.*)/g,'')}`,fanbox_url.replace(/^http:/, 'https:').replace(/\/$/, '')));
							//console.log(fanbox_response)
							tmp_pixiv_url = findMatch_from_array(fanbox_response.body.profileLinks,Pixiv_url_regex,true);
							if(tmp_pixiv_url !== undefined){
								return resolve(tmp_pixiv_url);
							}else{
								return resolve(`https://www.pixiv.net/users/${fanbox_response.body.user.userId}`);
							}
						}
					})
				}
			});
		}
		async function check_attachment_size_sum(attachments){
			//Discord.jsで送信できるのは23Mibよりちょっとでかいくらいのサイズなので、添付画像のサイズの合計がそれ以下になるようにする。
			return new Promise(async function(resolve){
				var sum = 0;
				for(target in attachments){
					sum += attachments[target].attachment.byteLength;
				}
				if(sum > 24117248){
					console.log("画像の合計サイズが23MBを上回りました:" + sum)
					for(target in attachments){
						attachments[target].attachment = await sharp(attachments[target].attachment).resize(1700, null).toBuffer();
					}
				}
				return resolve(attachments);
			});
		}
		async function expand_shortening_link(urls_in_profile){
			//短縮リンクのリダイレクト先がわからないためそのままアクセスしてしまうと危険なので、短縮リンクのリダイレクト先がわかるサービスのAPIを叩いている。
			return new Promise(async function(resolve){
				var return_urls = [];
				if(urls_in_profile.length == 0 || urls_in_profile.length === null || urls_in_profile.length === undefined) return ;
				var promise_list = [];
				urls_in_profile.forEach(target => {
					switch(true){
						case /^https?:\/\/(bit\.ly|is\.gd)\/[\w]{1,9}$/.test(target):
							//lab.syncer.jp様 ありがとうございます。
							promise_list.push(send_request(new requestObject('https://lab.syncer.jp/api/32/' + target)));
							break;
						default:
							break;
					}
				});
				await Promise.allSettled(promise_list).then(results => {
					const res_tmp = get_only_particular_key_value(results, 'value', undefined);
					var tmp;
					for(let i=0;i<res_tmp.length;i++){
						if(res_tmp[i]){
							tmp = res_tmp[i].pop();
							tmp = tmp.pop();
							return_urls[i] = tmp[0];
						}
					}
				});
				return resolve(return_urls);
			});
		}
		async function send_request(request_options){
			try{
				const response = await axios(request_options);
				return response.data;
			}catch(err){
				console.log(`${request_options.url}のrequestに失敗しました`);
				console.log(`statusCode: ${err.response.status}`);
				console.log(err.message);
				throw err;
			}
		}
		function findMatch_from_array(arr, regex, is_strict = false){
			//配列に正規表現にマッチするテキストがあるかを調べる。
			//「is_strict」が「true」ならマッチした部分だけど返す。
			for(let i = 0; i < arr.length; i++){
				if(regex.test(arr[i])){
					if(is_strict === true){
						return arr[i].match(regex)[0];
					}else{
						return arr[i];
					}
				}
			}
			return undefined;
		}
		async function download_images(image_urls,dont_convert_image_to_jpg){
			return new Promise(async function(resolve){
				var return_images = [];
				var download_image;
				for(target in image_urls){
					download_image = await send_request(new requestObject_binary_data(image_urls[target]));
					download_image = await make_image_size_under_upper_limit(download_image,dont_convert_image_to_jpg);
					return_images[target] = new AttachmentBuilder(download_image, { name: image_urls[target].split("/").pop() });
				}
				resolve(return_images);
			});
		}
		function get_only_particular_key_value(object, path, defaultValue = undefined){
			//オブジェクトから任意のpathの値を取得する。
			//オブジェクト内に配列がある場合などに便利。
			/*
				{
					a: "1",
					b: [
						{hoge: "2"},
						{hoge: "3"}
					]
				}
				こんな感じになってるときに
				get_only_particular_key_value(object, "b.hoge")
				とやると
				>>[2,3]
				って帰ってくる。
				get_only_particular_key_value(object, "a")
				なら
				>> 1
				って帰ってくる。
			*/
			var isArray = Array.isArray;
			if(object == null || typeof object != 'object') return defaultValue;
			return (isArray(object)) ? object.map(createProcessFunction(path)) : createProcessFunction(path)(object);
			function createProcessFunction(path){
				if(typeof path == 'string') path = path.split('.');
				if(!isArray(path)) path = [path];
				return function(object){
					var index = 0,
						length = path.length;
					while(index < length){
						const key = toString_(path[index++]);
						if(object === undefined){
							return defaultValue;
						}
						// 配列に対する処理
						if(isArray(object)){
							object = object.map(item => item[key]);
						}else{
							object = object[key];
						}
					}
					return (index && index == length) ? object : void 0;
				};
			}
			function toString_(value){
				if(value == null) return '';
				if(typeof value == 'string') return value;
				if(isArray(value)) return value.map(toString) + '';
				var result = value + '';
				return '0' == result && 1 / value == -(1 / 0) ? '-0' : result;
			}
		}
		function round_half_up(original_value,where_round_off,decimal_place = 0,unit_str = ""){
			//四捨五入関数。
			/*
			original_valu: 元の値
			where_round_off: どこで四捨五入するか(0.1,1,10,100,1000など)
			decimal_place: 小数点以下を何桁にするか(1,2,3,4,5など)
			unit_str: 単位を末尾につける(千,万など)
			*/
			if(Number(original_value)>=Number(where_round_off)){
				var tmp_value;
				tmp_value = Math.round(Number(original_value) / Number(where_round_off) * Math.pow(10,Number(decimal_place))) / Math.pow(10,Number(decimal_place));
				if(unit_str == ""){
					return tmp_value;
				}else{
					return `${tmp_value}${unit_str}`
				}
			}else{
				return original_value;
			}
		}
		function if_exsit_return_text(variable,return_text){
			if(!(variable === null || variable === undefined || variable === "")){
				return return_text
			}
			return "";
		}
		function replace_null_to_something(input_character,replace_character = " "){
			if(input_character === null || input_character === undefined || input_character === ""){
				return replace_character;
			}else{
				return input_character;
			}
		}
		function array_uniq(arr){
			return Array.from(new Set(arr));
		}
		function remove_null_from_array(arr){
			return arr.filter(function(x){return !(x === null || x === undefined || x === "")});
		}
		function str_max_length(text, max_length){
			var r = 0;
			for(var i = 0; i < text.length; i++){
				var c = text.charCodeAt(i);
				if((c >= 0x0 && c < 0x81) || (c == 0xf8f0) || (c >= 0xff61 && c < 0xffa0) || (c >= 0xf8f1 && c < 0xf8f4)){
					r += 1;
				}else{
					r += 2;
				}
				if(r >= max_length){
					text = `${text.slice(0, i - 1)} ……以下Discordの字数オーバー。`;
					break;
				}
			}
			return text;
		}
		async function make_image_size_under_upper_limit(image_buffer,dont_convert_image_to_jpg){
			return new Promise(async function(resolve){
				var new_image,input_image_format;
				if(image_buffer.byteLength > 24117248){
					/*
					if(dont_convert_image_to_jpg == true){
						new_image = await sharp(image_buffer)
							.resize(1500, null)
							.toBuffer();
						
					}else{
						new_image = await sharp(image_buffer)
							.toFormat('jpg')
							.toBuffer();
					}
					*/
					new_image = await sharp(image_buffer)
						.resize(1500, null)
						.toBuffer();
					resolve(new_image);
				}else{
					resolve(image_buffer);
				}
			});
		}
	}
}



class requestObject_twitter_graphql{
	constructor(ID){
		this.method = 'GET';
		this.url = `https://api.twitter.com/graphql/NNiD2K-nEYUfXlMwGCocMQ/TweetDetail?variables=%7B%22focalTweetId%22%3A%22${ID}%22%2C%22with_rux_injections%22%3Afalse%2C%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withBirdwatchNotes%22%3Atrue%2C%22withSuperFollowsUserFields%22%3Atrue%2C%22withDownvotePerspective%22%3Afalse%2C%22withReactionsMetadata%22%3Afalse%2C%22withReactionsPerspective%22%3Afalse%2C%22withSuperFollowsTweetFields%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22responsive_web_twitter_blue_verified_badge_is_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Afalse%2C%22verified_phone_label_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22vibe_api_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Afalse%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Afalse%2C%22interactive_text_enabled%22%3Atrue%2C%22responsive_web_text_conversations_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D`;
		this.body = null;
		this.headers = {
			"Content-Type": "application/json",
			"Referer": "https://twitter.com/",
			"Host": 'api.twitter.com',
			"Authorization": `Bearer ${env.Twitter_Bearer_Token_graphql}`,
			"x-csrf-token": `${env.x_csrf_token_graphql}`,
			"x-twitter-client-language": 'ja',
			"Cookie": `auth_token=${env.Twitter_auth_token}; ct0=${env.x_csrf_token_graphql}`
		};
	}
}
class requestObject_twitter_graphql2{
	constructor(ID){
		this.method = 'GET';
		this.url = `https://twitter.com/i/api/graphql/TuC3CinYecrqAyqccUyFhw/TweetDetail?variables=%7B%22focalTweetId%22%3A%22${ID}%22%2C%22referrer%22%3A%22home%22%2C%22with_rux_injections%22%3Afalse%2C%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withArticleRichContent%22%3Atrue%2C%22withBirdwatchNotes%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22rweb_lists_timeline_redesign_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticleRichContentState%22%3Atrue%7D`;
		this.body = null;
		this.headers = {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${env.Twitter_Bearer_Token_graphql}`,
			"x-csrf-token": `${env.x_csrf_token_graphql}`,
			"x-twitter-client-language": 'ja',
			"Cookie": `auth_token=${env.Twitter_auth_token}; ct0=${env.x_csrf_token_graphql}`
		};
	}
}
class requestObject_twitter_1_1{
	constructor(ID){
		this.method = 'GET';
		this.url = "https://api.twitter.com/1.1/statuses/lookup.json?id=" + ID + "&tweet_mode=extended";
		this.body = null;
		this.headers = {
			"Content-Type": "application/json",
			"Referer": "https://twitter.com/",
			"Host": "api.twitter.com",
			"Authorization": `Bearer ${env.Twitter_Bearer_Token_1}`,
			"x-csrf-token": `${env.x_csrf_token}`,
			"Cookie": `auth_token=${env.Twitter_auth_token}; ct0=${env.x_csrf_token}`
		};
	}
}
class requestObject_fanbox{
	constructor(URL,fanbox_URL){
		this.method = 'GET';
		this.url = `${URL}`;
		this.body = null;
		this.headers = {
			'User-agent': User_agent,
			'origin': fanbox_URL,
			'Host': 'api.fanbox.cc',
			'cookie': '',
		};
	}
}
class requestObject{
	constructor(URL,addtional_cookie = undefined){
		this.method = 'GET';
		this.url = `${URL}`;
		this.headers = {
			"Content-Type": "text/html,application/xhtml+xml,application/xml",
			'User-agent': User_agent,
			'accept': '*/*',
			'Referer': URL,
			"Sec-Fetch-Mode": "navigate",
			"Sec-Fetch-Site": "cross-site",
			'cookie': `${addtional_cookie}`
		};
		this.package = null;
	}
}
class requestObject_binary_data{
	constructor(URL,addtional_cookie = undefined){
		this.method = 'GET';
		this.url = `${URL}`;
		this.body = null;
		this.responseType = 'arraybuffer';
		this.headers = {
			"Content-Type": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*",
			'User-agent': User_agent,
			'accept': '*/*',
			'Referer': URL,
			"Sec-Fetch-Mode": "navigate",
			'cookie': `${addtional_cookie}`
		};
		this.package = null;
	}
}
class requestObject_pixiv{
	constructor(URL){
		this.method = 'GET';
		this.url = `${URL}`;
		this.headers = {
			"Content-Type": "text/html,application/xhtml+xml,application/xml",
			'User-agent': User_agent,
			'accept': '*/*',
			"Referer": "https://www.pixiv.net/",
			"Sec-Fetch-Mode": "navigate",
			'cookie': `PHPSESSID=${env.Pixiv_PHPSESSID}`
		};
		this.package = null;
	}
}
class requestObject_misskey{
	constructor(URL,Body){
		this.method = 'POST';
		this.body = Body;
		this.url = URL;
		this.headers = {
			"Content-Type": "application/json",
			'User-agent': User_agent,
			'accept': '*/*',
			"Referer": "https://misskey.io/",
			'Origin': 'https://misskey.io',
			"Sec-Fetch-Mode": "navigate",
			'Sec-Fetch-Site': 'same-origin',
		};
		this.package = null;
	}
}
