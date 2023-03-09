# shopee-coins-collector 蝦皮自動簽到機器人

A crawler inspired by [wdzeng/shopee-coins-bot](https://github.com/wdzeng/shopee-coins-bot) uses [puppeteer](https://www.npmjs.com/package/puppeteer) and [github actions](https://docs.github.com/en/actions) instead of selenium and docker.
Therefore, it can lower the users' entry barrier and speed up.

## Usage

1. Fork this repo under your account
   ![click fork button](https://i.imgur.com/ZXeD4Vo.png)
   ![createa fork](https://i.imgur.com/Om9YURQ.png)   
1. Add `SHOPEE_USR`, `SHOPEE_PWD` and `AES_KEY` (which is used to encrypt your cookie) in actions secrets
   ![new a repo secret](https://i.imgur.com/eSiiyzo.png)  
   ![add secret](https://i.imgur.com/2MrFs2D.png)
1. Run actions mannualy for the first time
   ![run actions](https://i.imgur.com/VHCSost.png)  
2. In most situations, you will receive an SMS authentication in the initial run. After that, github actions will cache your encryted cookie and use it to login derictly in the future.

## Update (2023/03/09)

The workflow would update the cache every time.  
The machanism behind is to use a key which is unique for every run (suffixing by `github.run_id`) and use restore-keys to restore the nearest cache.  
If there is already an old cache named `cache-{hash}` (without run_id suffix), it would always be used because of the exact match.  
Therefore, you need to delete it first to activate this feature.  
[reference](https://github.com/actions/cache/blob/main/tips-and-workarounds.md#update-a-cache)

## Reference

- [wdzeng/shopee-coins-bot](https://github.com/wdzeng/shopee-coins-bot) (source code)
- [wdzeng/bot-automate](https://github.com/wdzeng/shopee-coins-bot/network/dependents?package_id=UGFja2FnZS0zMTgxNjcyNTgy) (github actions version)  
  I found the original author has also written a github actions version during writing this doc. XD

## Contact

Addie Tsai-Yun, Chung @ addiechung.tyc@gmail.com
