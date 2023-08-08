# dimg
twitterやpixivの投稿をdiscordにポストするdiscordbot

## パッケージのインストール
```shell
npm install
```
でオケ。

## 設定
.envに必要な情報を書き込む
- DISCORD_TOKEN
  - discordの[Developer Portal](https://discord.com/developers/applications)でBotを作り取得する
- Twitter_auth_token
  - ブラウザの検証ツールを使い適当な通信のヘッダーから取得する
- x_csrf_token
  - ブラウザの検証ツールを使いapi1.1を使っている通信のヘッダーから取得する
- x_csrf_token_graphql
  - ブラウザの検証ツールを使いgraphqlを使っている通信のヘッダーから取得する
- Pixiv_PHPSESSID
  - ブラウザの検証ツールを使い適当な通信のヘッダーから取得する

ブラウザから自身のトークンを取ってくる理由は自分のフォローしている鍵垢のツイートをポストするためです。

必要ない場合 platform.twitter.com/embed のAPIなどを使うといいかと思います。

## 起動方法
linuxの場合
```sh
node index.js 2>&1|tee -a logs.txt
```
で起動するとログも取れていいのではないかと思います。

windowsの場合はよくわかりませんが、
```sh
node index.js
```
とやれば起動はできます。
## botの操作
```
/dimg
```
とdiscordで入力することで使うことができます。
基本的にはコマンドを使用したチャンネルにポストします。
### オプション
- url
  - 送信したいツイートなどのURLを入力します
  - これは入力必須オプションです(そりゃそうだ)
- post_to_gazou
  - サーバー内の「画像」というチャンネルにポストするためのオプションです
- page_all
  - TwitterやPixivの画像を最大4枚まで1枚目から順番に並べて送信します
- win1~4
  - 添付する画像をそれぞれ決めることができます
  - page_allとの違いは順番を変えることができるのと、送りたくない画像は送らない選択ができるところです
  - 同じ画像を重複して選択することはできません
- dont_post_quote
  - Twitterの引用ツイートはデフォルトで引用元も合わせてポストするのでそれを阻止するオプションです
- use_graphql
  - twitterのapi1.1はNote TweetというTwitter Blue加入者ができる長いツイートを全文取得できないので長いツイートを送信したいときに使います
  - なぜデフォルトでgraphqlを使わないかと言うと、閲覧制限のあるようなときそのapiを使ってしまうと閲覧数をしょうひしてしまうからです。しかしapi1.1は前回の閲覧制限のとき制限がかかっておらず閲覧数を消費しないため使っています。
## dimgの名前の由来
昔はdiscordに画像を共有するためのものとして開発していて、そのときの名前が「discord_image」だったので名残でこのようになっています。

そのような経緯があるのでTweetをdiscordにポストするとき、ツイートの作成者のプロフィールを見てPixivのリンクをfanboxやfantiaなどのファンサイトの中からでも探して見つかった場合はdiscordの投稿に記載するようになっています。
